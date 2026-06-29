# QA — practices for the individual contributor

Practical guide for getting your PR through review and into preprod with the least friction. Written for the person actually writing the code, not for a team policy doc.

The single most valuable rule on this list, if you only adopt one: **keep PRs under 1000 lines initially**. Everything else amplifies the value of that one.

---

## TL;DR — the rules of thumb

1. **Keep PRs under 1000 lines** (insertions + deletions counted from the diff). Three 800-line PRs are reviewed faster than one 2400-line PR, by a wide margin. See "Why under 1000 lines" below.
2. **Run `/qa` before you open the PR.** One slash command in Claude Code runs the full QE fleet (coverage + regression) with the architecture-aware preamble baked in. See "Running `/qa`" below.
3. **Run a ruflo / claude-flow hivemind swarm review for non-trivial changes** — multi-agent review catches what one reviewer (human or AI) misses. See "Running the ruflo swarm" below.
4. **Land slices, not features.** Big features should land as 4-8 PRs of 200-800 lines each, sequenced so each is independently mergeable.
5. **Inherited baseline failures are not your problem.** If the pre-commit hook fails on a violation you didn't introduce, use `--no-verify` with explicit operator authorization and reference the tracking ticket. Don't try to fix unrelated baseline in your PR.

---

## Quick decision map — `/qa` vs ruflo swarm

| Tool | Speed | When |
|---|---|---|
| **`/qa`** | 1-3 min | **EVERY PR** before opening — mechanical coverage + regression check |
| **ruflo swarm** | 10-30 min | PR > 1500 lines, **OR** crossing 3+ architectural layers, **OR** security/invariant-critical (auth, audit, hash, lockouts), **OR** PR rejected and you're unsure why, **OR** introducing a brand-new architectural pattern |

### Where each fits in the workflow

```
write code
  ↓
/qa                          ← cheap, mechanical (coverage + regression)
  ↓
address /qa findings
  ↓
ruflo swarm (only if triggered per the table above)   ← expensive, design-level
  ↓
address swarm findings
  ↓
git push + open PR
  ↓
human reviewer
```

### The distinction

- **`/qa`** asks "*did I forget to test something? regression risk?*" — mechanical, fast, every PR.
- **Ruflo swarm** asks "*is this design right? does this conflict with an ADR? what did I miss that tests can't catch?*" — judgment-level, slow, only when the size / risk / novelty warrants it.

Most PRs only need `/qa`. The PRs that need ruflo are the ones where you can already feel the risk while writing — "this is touching 5 layers, I should get a second pair of eyes." That's the trigger.

### For HUGE features (>3000 lines, can't split below 1000)

Inverted ordering — swarm **first**, then code, then `/qa` per slice:

```
ruflo swarm on the design     ← validate architecture before coding
  ↓
write code in slices
  ↓
/qa per slice
  ↓
ruflo swarm one more time on the final diff (if anything substantial changed)
  ↓
push + PR
```

### Skip ruflo when

- Small PR, single layer (just `/qa` is enough)
- Routine bug fix on an existing pattern
- Doc-only or comment-only changes
- You've already done 3+ swarm rounds on this PR — diminishing returns; fix the findings, don't keep re-reviewing

---

## Why under 1000 lines

Empirical pattern from this codebase's recent PRs:

- PRs under 1000 lines: typically reviewed within 1-4 hours, merged the same day, low rework rate
- PRs between 1000-2500 lines: typically 6-12 hours in review, often need ruflo / verification-round rework cycles (see PR #1345 ADR-152 with 6 rework rounds — `round-2`, `round-3`, `round-4`, `round-5`, `verification-round`, `swarm-review` findings each adding a fix commit)
- PRs over 2500 lines: review fatigue sets in; reviewers miss things; AC sweeps get cursory; the same total time produces lower-quality review

The 1000-line bar is **not a hard rule** — some slices legitimately need more (a new DB table + migration + Drizzle schema + tests + service routes can run 1200+ lines for one cohesive change). The rule is: **default to splitting when you cross 1000, justify staying together when you don't**.

### How to split a big feature

For a feature that naturally runs 3000+ lines, split by **architectural layer**, not by "first half / second half":

- PR 1: domain schema + pure builder (~300-500 lines, type-only contract)
- PR 2: persistence layer (migration + Drizzle schema + schema tests) (~400-600 lines)
- PR 3: service layer + repository (~500-700 lines)
- PR 4: route handlers + functional tests (~400-600 lines)
- PR 5: contract YAML invariants + UI integration (~200-400 lines)

Each PR is independently reviewable. Each can merge to preprod without breaking the others. The dependency direction (domain → persistence → service → route → contract) is the natural order.

For an example of this layering done well, see #1361 ROOF-EST-EXPLAINABILITY (7 slices, ~116 tests, multicheck-reviewed slice-by-slice). For an example of NOT doing this and paying the cost, see PR #1345 ADR-152 (single PR with 6 review rework rounds).

---

## Running `/qa`

In any Claude Code session inside the `claims-monorepo` checkout, type:

```
/qa
```

That's it. The slash command runs the full QE fleet workflow:

1. Reads the architecture-context preamble (so the QE fleet doesn't hallucinate monorepo boundaries)
2. Diffs your branch vs `origin/main` (or pass a base ref: `/qa origin/preprod`)
3. Groups changed files by workspace
4. Spawns `qe-coverage-specialist` + `qe-regression-analyzer` in parallel with the preamble baked into each invocation
5. **Spot-checks every file:line citation by re-reading the file from disk** (see callout below — this step is non-negotiable)
6. Combines surviving findings, drops false positives, returns ONLY A-class findings
7. Reports GREEN / YELLOW / RED + file:line gaps + minimum test re-run set
8. Asks if you want to address any findings now or save them for the next iteration

It does NOT modify code. It's a read-only review. You decide what to act on.

### ⚠️ Spot-check before posting — non-negotiable

The QE subagents are high-signal but **hallucinate the same way builders do**: they fabricate literals the file doesn't contain, miss inline design comments above the cited line, or cite the wrong file entirely. The `/qa` workflow (step 5) borrows the multicheck reviewer protocol's "never trust the builder's paste" rule and applies it to subagent findings:

- **Read the cited file at the cited line yourself.** Never trust the subagent's paste.
- **Check the 20 lines above the cited line for design comments** — intentional patterns are often documented inline ("drift below the visible checklist is acceptable; drift above it isn't") and subagents miss them.
- For "no test exists for Y" claims, grep for Y's identifier across the test tree before accepting the gap as real.
- If the claim doesn't hold up, **drop it silently**. Don't pad the report with corrections.

Self-check before posting: *Did I accept any finding because the subagent said it was true? If yes, verify independently or drop it.*

This is the difference between `/qa` output the team trusts and `/qa` output the team starts ignoring. In a reference session, 2 of 3 regression findings on a single PR were hallucinated — the literal the agent claimed was hard-coded had already been fixed, and a "label drift" finding sat 8 lines below a design comment explaining the drift was intentional. Both would have been caught by 30 seconds of spot-checking.

### Optional argument

```
/qa <base-ref>    # diff against a specific base ref
/qa               # default: origin/main
/qa origin/preprod
/qa origin/roof-pricing-restore
```

### One-time setup if `/qa` doesn't appear in autocomplete

- The slash command lives at `claims-monorepo/.claude/commands/qa.md`. It's project-scoped (this repo only).
- If it doesn't appear after pulling latest, run `/reload-plugins` in Claude Code.
- If the QE fleet plugin isn't installed (the slash command will tell you), run once: `/plugin marketplace add https://github.com/proffesor-for-testing/agentic-qe.git` then `/plugin install agentic-qe-fleet` then `/reload-plugins`.

---

## Building the `/qa` command (one-time setup for a new repo)

If you're adding `/qa` to a new repo (or recreating it after a `multicheck/` rotation lost the file), here's the setup. Two files, ~20 min total.

### Prerequisites

1. Claude Code installed and configured.
2. The agentic-qe-fleet plugin installed in your Claude Code (see the setup note above).
3. A git repo with branches you want to QA.

### Step 1 — Drop the preamble file

Put the architecture-context + output-classification template at:

```
docs/qa/qe-prompt-preamble.md
```

Use the canonical content from this folder's `qe-prompt-preamble.md` as a starting point. **Edit the ARCHITECTURE CONTEXT block to match your repo's actual layout** — specifically:

- The "Workspaces" section listing all `apps/` and `packages/` (each app's role, what it's allowed to import, what it's allowed to bundle)
- The "Rules the QE fleet routinely violates" list (most rules carry over verbatim; some are repo-specific, e.g., "INV-001 domain isolation" only matters if your domain layer enforces such an invariant)
- The ADR references section (point at your repo's `docs/ard/` or wherever architecture decisions live)

If you're in the `claims-monorepo`, the file already exists — no edit needed.

### Step 2 — Drop the slash command file

Put the command at:

```
.claude/commands/qa.md
```

The file structure:

```markdown
---
description: Run a QA review on the current branch (QE fleet coverage + regression with architecture-aware preamble)
---

Run a QA review on the current branch in this repo. Arguments (optional): the base ref to diff against (default: `origin/main`).

If the user passed an argument, treat that as the base ref. Otherwise default to `origin/main`. The user's argument is: $ARGUMENTS

Workflow:

1. Read `docs/qa/qe-prompt-preamble.md` from the repo root.
2. Determine the diff scope (HEAD vs base-ref, enumerate changed files, get the size).
3. If diff is empty/trivial, surface that and stop.
4. If the diff crosses multiple workspaces, group changed files by workspace.
5. Spawn `qe-coverage-specialist` + `qe-regression-analyzer` subagents IN PARALLEL with the preamble blocks injected around each invocation.
6. Combine A-class findings into a single GREEN/YELLOW/RED report.
7. Ask the user (once) whether to address findings now or save them.

Constraints:
- Read-only review; never auto-applies changes.
- Per-workspace invocation when the diff is workspace-scoped.
- Surface a clear error if the agentic-qe-fleet plugin is missing.
```

The full canonical content lives at `claims-monorepo/.claude/commands/qa.md`. Copy that file verbatim if you want the exact behavior described in this README.

**Key design rules for the command file:**

- The `description:` front-matter field must be present — that's the text Claude Code shows in autocomplete.
- The body is the prompt template the model receives when the user types `/qa`. `$ARGUMENTS` is the variable expansion for any text the user passes after the command name.
- Reference the preamble by path (relative to the repo root). The command opens the file at invocation time, not at build time — so updating the preamble doesn't require rebuilding the command.

### Step 3 — Commit, or decide to keep ignored

Project-level slash commands are normally checked into git so the whole team gets them. The two files you created (`docs/qa/qe-prompt-preamble.md` + `.claude/commands/qa.md`) should be **COMMITTED**.

If `.claude/` is in your repo's `.gitignore` already, three options:

1. **Remove `.claude/` from gitignore so commands are shared (recommended for team commands like `/qa`)**
2. Keep `.claude/` ignored but add an allowlist: `!.claude/commands/qa.md`
3. Keep everything ignored and have each developer create the file from a template stored elsewhere (high-friction; not recommended)

### Step 4 — Test the command

Restart Claude Code (or run `/reload-plugins`) so the new command is discovered. Type `/q` and look for `/qa` in the autocomplete list. Then run it on a branch with some changes — confirm it produces an A-class findings report.

### Step 5 — Iterate on the preamble (not the command)

After running `/qa` a few times, you'll see false positives leak through. Update the ARCHITECTURE CONTEXT block in `docs/qa/qe-prompt-preamble.md` with the patterns you keep seeing. Re-run `/qa` to confirm the new context catches them.

**The preamble is the lever — the command itself rarely needs editing.** That's why the command references the preamble by path: you tune the static context once and the command picks it up on every invocation.

### Customizing the QE invocation

To change WHICH subagents the command spawns, edit step 5 of the workflow in `.claude/commands/qa.md`. The command is just a prompt template; the model executes whatever you tell it to.

Common variants you might want, by adding a second/third command file at `.claude/commands/qa-<variant>.md`:

- **`/qa-coverage`** — coverage only (faster, lighter; just spawn `qe-coverage-specialist`)
- **`/qa-deep`** — coverage + regression + mutation testing (slower, deeper; spawn all three)
- **`/qa-security`** — coverage + regression + a security-focused agent prompt (e.g., `qe-security-scanner` or a custom prompt)

Each variant is its own ~50-line markdown file; they all share the same preamble.

---

## Manual / advanced QE fleet invocation

Use this when you want a finer-grained QE check than `/qa` provides — e.g., just coverage, or just a specific workspace, or with custom analysis questions.

The architecture-aware preamble lives at `claims-monorepo/docs/qa/qe-prompt-preamble.md` (canonical) with a mirror at `gmh-docs/QA/qe-prompt-preamble.md` (this folder).

Workflow:

1. Open the preamble file
2. Copy the ARCHITECTURE CONTEXT block — prepend to your QE prompt
3. Copy the OUTPUT CLASSIFICATION INSTRUCTION block — append to your QE prompt
4. Put your specific task in between (file paths, diff range, what to analyze)
5. Invoke per workspace, not monorepo-wide

The QE fleet skills + subagents you can invoke directly:

| Use case | Skill or subagent |
|---|---|
| Coverage gap detection (risk-weighted) | `qe-coverage-analysis` skill OR `qe-coverage-specialist` subagent |
| Regression risk on a diff + intelligent test selection | `qe-regression-analyzer` subagent |
| Auto-generate tests for new code | `qe-test-generation` skill OR `qe-test-architect` subagent |
| Mutation testing (proves tests catch bugs) | `mutation-testing` skill |
| Deployment-readiness scoring | `qe-quality-gate` subagent |
| Test execution with parallel sharding | `qe-test-execution` skill |

### Example manual invocation

```
{paste ARCHITECTURE CONTEXT block from qe-prompt-preamble.md}

Analyze test coverage gaps for my changes on branch codex/1361-foo against base c824d280.

Files touched:
- packages/domains/src/.../bar.ts (215 lines)
- packages/infrastructure/db/drizzle/00NN_bar.sql (70 lines)

Tests added: 14 in packages/domains/__tests__/.../bar.test.ts

Specifically check: <your specific question>

{paste OUTPUT CLASSIFICATION INSTRUCTION block from qe-prompt-preamble.md}
```

The OUTPUT CLASSIFICATION block forces the agent to return ONLY A-class findings (genuine defects) — dropping B (monorepo hallucinations) and C (generic best-practice that doesn't apply). "NO GENUINE FINDINGS" is a valid output and means your code is clean.

### When to run QE fleet (before-PR checklist)

For any PR over ~300 lines OR touching a critical path (DB schemas, auth, payment, audit trail):

1. Pre-PR: `/qa` (or `qe-coverage-specialist` manually). Address the A-class findings before opening the PR.
2. Pre-PR: confirm the "minimum re-run test set" from the regression analyzer all pass.
3. Post-PR (optional, for crypto / invariant-critical code): `mutation-testing` to prove the tests actually catch bugs.

---

## Running the ruflo / claude-flow swarm review

[ruflo / claude-flow](https://github.com/ruvnet/claude-flow) is the multi-agent coordination framework this codebase uses for swarm reviews. The "hivemind" pattern spawns specialized agents (coder, reviewer, tester, security, etc.) that operate with shared memory and consensus.

Use a swarm review when:

- The PR crosses multiple architectural layers (e.g., domain + infra + route + UI)
- The PR touches security or invariant-critical code (auth, audit, hash, lockouts)
- A single-reviewer pass missed something and you want a second-opinion (multiple, actually)
- You're trying to catch what tests can't — naming, boundary placement, ADR-fit, missing-but-not-yet-asserted constraints

### How to invoke

Type a natural-language directive in Claude Code:

```
Use the hivemind to review the PR diff on branch codex/1361-roof-est-explainability
against base c824d280. Specifically:
- Check that the chain-of-custody hash logic correctly handles edge cases (Date in array, undefined in array, circular refs)
- Check that the DB triggers in 0038 + 0039 enforce the locked-row + append-only invariants
- Verify ADR-043 boundary on the new explainability domain code
- Verify mount-order in apps/claims-management-server/src/index.ts vs ADR-XXX (router ordering)

Run with 4-6 specialist agents (coder, security, architecture, test-coverage).
```

Claude-flow handles the orchestration. The swarm operates in parallel via MCP tools — `swarm_init`, `agent_spawn`, `hive-mind_broadcast`, `memory_store`/`memory_search`.

### Output interpretation

The swarm produces:

- A consolidated findings list categorized as CRITICAL / IMPORTANT / NIT
- Recommendations per-agent (sometimes conflicting — that's where consensus mechanisms help)
- A "verification round" output if you ask for one (re-checks the prior findings after you applied fixes)

The naming you'll see on commit messages: `round-2`, `round-3`, `verification-round`, `swarm-review` (these are the iterative review cycles). Each round addresses the prior round's findings.

### Recent example commits to look at

| Commit | Pattern |
|---|---|
| `5d757881 fix(adr-152): round-4 findings — query-route normaliseSqlBool + shared helper + doc/type cleanup` | Sequential ruflo rounds applied to PR #1345 |
| `5f0f7c23 fix(adr-152): round-5 findings — complete normaliseSqlBool audit + ADR ref + dead-fallback removal` | Same PR, round 5 |
| `bbf95cd0 chore(#1334): resolve ruflo swarm review findings on PR #1340` | Single-PR ruflo swarm review |
| `b7dca13f fix(loss-alerts): address ruflo + bot review findings on PR #1345` | Combined ruflo + GitHub bot review |

### Cost-benefit

Swarm reviews take ~10-30 minutes of wall-clock time and consume meaningful inference budget. The threshold for invoking them is roughly:

- PR < 500 lines, single layer → solo reviewer is fine, skip swarm
- PR 500-1500 lines → consider swarm if any layer is security/invariant-critical
- PR > 1500 lines OR security/invariant-critical → swarm review is worth the cost
- Inherited-baseline regression suspected → swarm review will tell you fast whether the baseline failure overlaps your changes

---

## Related practices that compound

- **spec-build (start here — plain-English intro)**: what spec-build is, the two pillars (adversary + Specflow), the two ways in, how to set it up and run it, an example, and when it's worth it. New team members read [`spec-build.md`](./spec-build.md) first.

- **Spec-build loop (idea → defensible tickets)**: the upstream loop — discovery → draft PRD → adversarial review → specflow uplift → pre-flight sim → journey-contracted tickets. Runs in gmh-docs (PRDs/journeys live here), drives the [adversarial-prd-reviewer](https://github.com/Hulupeep/adversarial-prd-reviewer) + Specflow pipeline, and stops at a human-approved SHIP verdict before tickets are created. Contract + driver in [`spec-build-loop.md`](./spec-build-loop.md).

- **Feature-build loop (run the gates, don't hand-prompt them)**: the downstream loop — instead of nudging an agent through build → `/qa` → fix → swarm by hand, hand it a *ready* ticket and it walks the stages, routes failures into repair, holds the slice under 1000 lines, and stops at one human review point with an evidence pack. Contract + driver in [`feature-build-loop.md`](./feature-build-loop.md). (Input = the spec-build loop's output.)

- **Runnable kit (run the whole pipeline)**: ready-to-paste prompts + the YAML paths + a worked example live in [`loops/`](./loops/) — start at [`loops/README.md`](./loops/README.md).

- **Journeys (Definition of Done)**: a feature is "done" when its CRITICAL journeys are green against the **real** backend — not when a button works. How we design, contract, and prove them (the CSV → spec → `journey_*.yml` → e2e ladder, with a full worked example) is in [`journeys-how-to.md`](./journeys-how-to.md).

- **Specflow contract gates**: every feature defines invariants in `docs/contracts/feature_*.yml` and corresponding tests in `tests/contracts/`. Run `npm run specflow:verify` before opening a PR. Inherited baseline failures (NOL-SNAP-002, INV-STORM-ALERT-004, INV-ADDRESS-CENTRAL-001 etc.) are tracked in their own remediation tickets — don't let them block your PR.

- **Multicheck protocol**: for complex slices, use the [multicheck](https://github.com/Hulupeep/multicheck) multi-agent reviewer protocol where a second LLM (different model, different blind spots) gates each slice. See `multicheck/.framework/REVIEWER.md` + `BUILDER.md` in the target repo.

- **ADR discipline**: when a PR introduces or revises an architectural pattern, add an ADR at `docs/ard/ADR-NNN-<topic>.md`. The ADR index is at `docs/ard/INDEX.md`. Future reviewers (human or AI) will read the ADR as ground truth — it's how the QE fleet and ruflo swarm avoid second-guessing intentional decisions.

- **Audit-trail thinking**: when you write code that mutates persistent state, ask "where does the audit row go?" The codebase enforces this via `propertyActivityLog` + `caseEvents` (ADR-115). Every status transition writes one. If your code doesn't have a corresponding activity log entry, it probably has a gap.

---

## Files in this folder + canonical paths

This `gmh-docs/QA/` folder mirrors the QA tooling. The canonical copies live in the code repo where they're actually invoked:

| Artifact | This mirror (gmh-docs) | Canonical (claims-monorepo) |
|---|---|---|
| Practices README (this file) | `gmh-docs/QA/README.md` | n/a — docs live in gmh-docs |
| Spec-build loop (contract + driver) | `gmh-docs/QA/spec-build-loop.md` | n/a — runs in gmh-docs, emits tickets |
| Feature-build loop (contract + driver) | `gmh-docs/QA/feature-build-loop.md` | n/a — practice doc, runs against claims-monorepo |
| QE prompt preamble | `gmh-docs/QA/qe-prompt-preamble.md` | `claims-monorepo/docs/qa/qe-prompt-preamble.md` |
| `/qa` slash command | n/a — code only | `claims-monorepo/.claude/commands/qa.md` |

When the preamble or practices change, update both copies (gmh-docs for the team-docs reference, claims-monorepo for the working invocation). The `/qa` slash command itself lives only in the code repo.

When new patterns emerge (new QE skill, new ruflo pattern, new repeated false-positive class), update this README + the preamble.
