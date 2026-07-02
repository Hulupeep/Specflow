# Changelog

All notable changes to `@colmbyrne/specflow`.

**Update:** `npx @colmbyrne/specflow update . --ci` then `npx @colmbyrne/specflow verify`

---

## 0.11.0 (2026-07-02)

**Enforced runtime verifier + long-run trust primitives.** The trust layer that decides what ships is now enforced end-to-end, not just described. Fable can carry the work; Specflow carries the trust.

- **Runtime verifier lifecycle** — a maker persists a slice-local verification proposal *before* implementation; an independent verifier accepts/rejects it (fed artifact + spec + accepted contract + rubric, never the maker's reasoning trace); runtime checks (`playwright`/`api`/`db-reread`/`console`/`network`/`screenshot`/`custom-script`) write `verifier-findings.jsonl`. A missing executable surface yields a **blocked** finding, never fabricated evidence. Provider output and exit codes are never a gate verdict.
- **Enforced verifier rail** — `feature-build` runs the verifier stage before the gate for runtime-required slices (`ui`, `workflow`, `api_behavior`, `integration`, `data_mutation`, `auth`, `billing`, `runtime_required`). A missing/blocked/failed required finding **blocks gate advancement** (`blocked_verifier_stage`). Strict default with a human-only, ledgered skip. Screenshot-only evidence can't satisfy a value-bearing slice. **Done is decided by the gate, using verifier evidence.**
- **`specflow run trace`** — groups maker claim vs verifier finding vs mechanical gate result and flags divergence (maker-claimed-done-but-verifier-failed, verifier-passed-but-gate-failed, missing evidence, human-gated action attempted). Never sends transcripts to a provider.
- **Safe durable re-entry** — on resume the durable run-contract position is authoritative; a caller-assumed stage that conflicts is overridden and ledgered (`reentry_conflict`), never silently trusted. Surfaced in `specflow run status`.
- **Isolated delegated worktrees** — `prepareWorktree` refuses a path resolving to the main working tree and ledgers branch/base/path/cleanup; `releaseWorktree` tracks cleanup; auto-merge/auto-push stay false.
- **Honest subordinate controls** — a silent model downgrade (effective ≠ requested, no reason) is a **failed contract**; missing usage is recorded as `unknown` with cost-per-accepted-change in `run status`; a vision verdict is evidence (`gate_result: pending`), never a gate pass; routine manifests must call `specflow run` with no auto human-gated action.
- **Invariant** — *"Frontier-model scaffolding is disposable. Gates, ledger, state, verifier evidence, and human boundaries are not."*

847 tests across 35 suites.

---

## 0.10.0 (2026-07-01)

**Specflow loop runtime controls + Fable-class adapter accounting.**

- **Contracted loop runner controls** — `specflow run` now carries richer adapter policy metadata for role, effort, requested model, effective/reported model, fallback, budget, usage, and cost-per-gate accounting. Silent model downgrade is no longer acceptable evidence: unknown provider metadata is recorded as `unknown`, not guessed.
- **Compounding state memory** — loop runs can write `.specflow/STATE.md` and one-lesson-per-file memory under `.specflow/lessons/`; generated stage prompts include a bounded state digest so later runs resume from durable facts instead of chat memory.
- **Delegation and routines** — added isolated worktree preparation metadata and `specflow routine <slug>` manifest scaffolding for cron/GitHub/hosted loops. Generated routines call `specflow run` and preserve `never_without_human`.
- **Gate D vision evidence** — `teardown-gate check-gate-d` accepts screenshot plus vision-verifier finding evidence while still requiring value-bearing `.txt`/`.json` oracle re-reads for value hops.
- **Install/package fix** — `js-yaml` is now a production dependency because the published CLI loads YAML at runtime.

---

## 0.9.1 (2026-06-12)

**Conditional ADR-conformance + universal component-reuse check (#68).**

- **`verify-adr.cjs`** — model-free, **conditional**: detects an ADR folder (`docs/adr|adrs|ard|architecture/decisions`, or a CLAUDE.md `ADR Location`) and **exits 0 silently when there isn't one**. When present, GATE B requires each ticket to cite a **resolving** ADR id (or `adrNone: <reason>`) and declare `reuses` (or a justified new component); a phantom ADR citation is an ERROR. IDs normalize (`ADR-006 ≡ ADR-6 ≡ 0006-foo.md`).
- **adversary-mandate@v3** — universal *reuse-don't-reinvent* (reinventing an existing component is FATAL) + conditional ADR conformance.
- spec-build tickets declare `adrs`/`reuses`; `init` scaffolds the script; `CLAUDE-MD-TEMPLATE.md` gains an optional **ADR Location** field.

---

## 0.9.0 (2026-06-12)

**Pipeline hardening (EPIC) + docs overhaul.** The integration-gate / seam-awareness / falsification work, plus a README + CLI-help refresh so the front door matches reality.

- **GATE D — persona-walk integration gate** (`feature-build.yaml` `epic_gate`, `prompts/gate-d.prompt.md`): per-slice green is blind to seam bugs (vertical slices, horizontal collisions); GATE D walks personas across the *merged* tree. Red hops are dispositioned `bug` (last-merged writer reopens) or a **human-countersigned** `stale-oracle` — the agent can't reconcile its own oracle. An epic isn't done until D is green.
- **Hop tables at GATE A** — pinned, value-bearing (re-read oracle) integration oracle in `PRDs/<slug>-hops.md`, human-signed; amendments countersigned.
- **Falsification folded into adversary-mandate@v2** — a required falsification artifact (parallel fresh-context sub-run), `verify-falsification.cjs` (rejects a stub), hash-bound PASS at GATE A (`teardown-gate.cjs check-sign`).
- **Seam-lite** — tickets declare `writes/reads`; `verify-seams.cjs` computes writer×writer + writer×reader seams at GATE B (errors on unresolved surfaces) and derives GATE D hops.
- **Hardening rules** — inherited-baseline *proof* (run on base branch first), DB-verification serialization, stacked-merge note, stable-key assertions (`journey-tester`, `contract-test-generator`).
- **Docs** — README overhaul (the three loops named; gate list current; GATE D in the table; persona two-touch; absolute links so they resolve on npm); CLI `help` now describes what `init` actually delivers.
- Drive-by: fixed long-standing invalid YAML in `feature-build.yaml` rails.

---

## 0.8.2 (2026-06-10)

**Teardown gets a method: `teardown-walkthrough-mandate@v1` (JTBD personas + cognitive walkthrough).**

The investigate/deep-dive stages now reference a versioned UX method by id (same pattern as the adversary's mandate): personas are constructed as **JTBD jobs**, not demographic profiles; every walk step answers the **4 cognitive-walkthrough questions** (knows the goal? action visible? action↔goal connection? feedback?); findings are named with a fixed vocabulary (discoverability / affordance / feedback / mental-model / slip-vs-mistake / dead-end) — so a CONFUSING verdict says *which* question failed instead of vibes. A richer local UX skill may exceed this floor; it never replaces the output discipline. Ships via `specflow init`.

---

## 0.8.1 (2026-06-10)

**daily-use-teardown hardened after adversarial review — DO NOT SHIP → fixed.**

An independent fresh-context adversary attacked the 0.8.0 loop and found the design self-attesting:

- **F1 — the HITL gate was self-signable**: "confirmation written into the journey map" is a line the *agent* writes. Fixed with `scripts/teardown-gate.cjs`: the human runs `sign`, which writes a **hash-bound sign-off** (SHA of the map at confirmation time) — a forged `confirmed-by` line counts for nothing, and editing the map after sign-off fails `check`. Tested both attacks.
- **F2 — every gate was prose checked by the entity it constrains**: `teardown-gate check` is now the deep-dive/done gate — mechanical: valid sign-offs (map *and* do-list), every mapped journey has findings (none silently skipped), every finding references evidence files that exist.
- **S-fixes**: committed Playwright walk script required (reproducible, not narrated); URL bar visible in screenshots; env named + human-confirmed at sign-off; `bugs.md` so found bugs land immediately; CONFUSING verdicts marked **[hypothesis]** (a simulated persona is not a real user); do-list approval is a signed artifact, not chat; the example's precedent claim corrected (timebreez #673 ran *spec-build* with walkthrough discovery — the teardown's distinctive stages are new and unproven until a first real run).

`specflow init` now ships `teardown-gate.cjs` with the rest of the gate scripts.

---

## 0.8.0 (2026-06-10)

**New loop: `daily-use-teardown` — the front door for products that are already built.**

For a shipped product, the question isn't "what should we build" — it's *"are the journeys confusing, and are they doing the right thing?"* The new loop (`QA/loops/daily-use-teardown.yaml` + prompt + a filled Claim Alert example):

1. **INVESTIGATE** — map the live app's main routes, each with its *purpose* + proposed personas. Inventory, not critique.
2. **⛔ GATE HITL (hard, human)** — *you* confirm/correct the journey map before any judging. The agent can only infer what the product is for; you know. A teardown of the wrong journeys is worse than none.
3. **DEEP DIVE** — top-thinker persona walks of the live app (real backend), judging clarity *and* correctness per journey: **WORKS / CONFUSING / BROKEN**, every verdict with screenshot evidence.
4. **DO-LIST** — prioritized observations (not solutions), each traceable to a screenshot; you approve priorities.
5. **HANDOFF** — the do-list becomes spec-build's `grounding_ref`: PRD → adversary → tickets → done.

Schedulable (monthly/quarterly): the product re-generates its own backlog from observed friction. Precedent: timebreez EPIC #673 (3-persona walkthrough → PRD survived Gate A → 9 sliced tickets + a live bug found mid-walk).

---

## 0.7.6 (2026-06-10)

**spec-build: two-touch personas — a persona/simulation lens joins the adversary panel.**

Persona walkthroughs now run **twice**: (1) at the adversary stage, in parallel with the structural review, walking real personas through the *PRD's* journeys on paper — design flaws get caught while only the PRD exists (the lens informs the verdict; the adversary still decides); (2) Gate B.5 unchanged, walking the *tickets* — catches ticketization flaws (a journey sliced wrong, a missing step). Both are top-thinker work: a shallow persona walk launders design gaps into a green check. Encoded in `templates/loops/spec-build.yaml` + the PROCESS docs.

(Note for upgraders: re-run `specflow init .` to refresh `QA/loops/` — it's refreshed on every init.)

---

## 0.7.5 (2026-06-10)

**The CLI now self-heals CRLF at runtime — works on Linux/Mac even if the tarball shipped with Windows line endings.**

0.7.3/0.7.4 still shipped CRLF because the publisher's npm skipped the normalize hooks *and* the manual step wasn't run. Rather than keep depending on a clean publish, `bin/specflow.js` (which always runs — it's the node entry point, not an npm lifecycle script) now strips CR from the shell scripts **right before it invokes bash**. So `npx @colmbyrne/specflow init/update/verify` works on Linux/Mac regardless of how the package was published. The publish-time hooks remain as a secondary measure.

---

## 0.7.4 (2026-06-10)

**Make the LF fix actually stick — 0.7.3's `prepack` didn't run on the publisher's machine, so it still shipped CRLF.**

`prepack` is unreliable if the publisher has `ignore-scripts` set (or an npm that skips it on publish), so 0.7.3 was published with CRLF anyway and still broke Linux/Mac. Now: `normalize-eol` runs as **`prepack` *and* `prepublishOnly`** (redundant hooks), is exposed as **`npm run normalize`** to run by hand, and **aborts the publish (exit 1) if any CR survives** — so a CRLF tarball can't be published silently again.

**Publishing this package:** `npm run normalize` then `npm publish` (the manual normalize guarantees LF even if your npm skips lifecycle scripts).

---

## 0.7.3 (2026-06-10)

**Fix: shell scripts shipped with CRLF, breaking `init`/`update` on Linux & Mac.**

`bash` on Linux/Mac chokes on Windows line endings — `setup-project.sh: line 17: $'\r': command not found`, `syntax error near unexpected token $'do\r'`. The scripts are LF in git, but `npm publish` packs from the working tree, so publishing from a Windows checkout (autocrlf) shipped CRLF. Two fixes: a `.gitattributes` forcing `*.sh`/hooks to LF on checkout, and a `prepack` step (`scripts/normalize-eol.cjs`) that strips CR from the shell scripts at pack time on **any** OS — so the published tarball is always LF regardless of who publishes from where.

If you hit this on 0.7.2: install from a fresh Linux/Mac clone (`git clone … && bash setup-project.sh .`) until 0.7.3 is published.

---

## 0.7.2 (2026-06-10)

**`init` now installs the adversary skill too — one command, not two.**

Setting up spec-build used to be two steps: `specflow init` *and* a separate `git clone` of the adversarial-prd-reviewer skill. Now `init` clones/updates the adversary into your skills dir (`~/.claude/skills/`, and `~/.codex/skills/` if present) as part of setup. The adversary stays its **own repo** (Gate A is still owned outside Specflow — not forked in); `init` just installs it for you. Idempotent (pulls if already there), never fails the install (warns + prints the manual clone if offline), and opt-out with `--no-adversary`.

---

## 0.7.1 (2026-06-10)

**Fix: `verify-setup` falsely reported every contract as "invalid YAML" when PyYAML wasn't installed.**

Section 3 ran `python3 -c "import yaml; ..."` gated only on `command -v python3` — so a python3 without PyYAML made `import yaml` throw, and (with stderr swallowed) every contract was flagged invalid. Meanwhile the jest contract-schema suite parsed the same files fine. Now `verify-setup` prefers **node + js-yaml** (which the project depends on), falls back to python3 **only if PyYAML actually imports**, and **warns instead of failing** when neither parser is available. No more false "invalid YAML syntax."

---

## 0.7.0 (2026-06-10)

**Pipeline v2: real, mechanical adversary independence — and `init` now ships the gate scripts.**

The spec-build loop's adversary is no longer "same agent, switched hats." It runs in a **fresh context seeded by a fixed template that cannot carry the author's reasoning**, gated before it can launch:

- `scripts/verify-seed.cjs` — byte-checks the spawn seed against `{artifact_paths, tool_grants, mandate_ref}`. Any extra key (`rationale`/`context`/…) — the priming-leak vector — or free-text `mandate_ref` is **rejected**. A primed seed cannot launch.
- `scripts/adversary-spawn.cjs` — `buildSeed()` reads only the three slots (priming prevented *at construction*); `assertSeedMatchesTemplate()` gates before any spawn.
- `templates/loops/adversary-mandate.md@v1` — the versioned static mandate the seed references by id.
- `scripts/verify-ticket-journey.cjs` — Gate B leg 3: the ticket↔journey "→issue" join (`verify-graph.cjs` has no issue-awareness).

`specflow init` now scaffolds these scripts (previously only `specflow-compile`/`verify-graph`). Runtime bindings for the whole pipeline ship too: `PROCESS-CLAUDE.md` (Workflow) alongside `PROCESS-CODEX.md` — run spec-build + feature-build end-to-end on either.

**Get it:** `npx @colmbyrne/specflow init .` (or re-init existing projects). Pairs with the [adversarial-prd-reviewer](https://github.com/Hulupeep/adversarial-prd-reviewer) skill for Gate A.

---

## 0.6.0 (2026-06-09)

**Distribute the loop kit + process docs via `specflow init`.**

`specflow init` now scaffolds the runnable pipeline into every project:

- `QA/loops/` — the reusable loop **paths** (`spec-build.yaml`, `feature-build.yaml`), thin invocation **prompt templates** (`prompts/`), a worked **example**, and a README. A loop = path (YAML) + thin prompt (goal + inputs + automation) + the tick + durable state.
- `PROCESS.md`, `PROCESS-GUIDE.md`, `PROCESS-CODEX.md` — the methodology (canonical / plain-language / Codex-runtime), copied to the project root (skipped if already present).

Specflow is now the **canonical source** of the loop kit — projects stop hand-mirroring it; re-running `init` refreshes it. The kit reframes the practice as **type-safe**: each phase emits a typed artifact the next won't consume until it conforms (the gates *are* the type-checker), and pairs the execution loop with storing the practice durably.

**Get it:** `npx @colmbyrne/specflow init .` (or re-init existing projects). Pairs with the [adversarial-prd-reviewer](https://github.com/Hulupeep/adversarial-prd-reviewer) skill for Gate A.

---

## 0.5.1 (2026-04-09)

**Fix settings.json merge dropping Edit matcher when Write already existed.**

`install-hooks.sh` deduped on `.hooks[0].command` alone, so when a project already had `Write → check-pipeline-compliance.sh` wired, the `Edit → check-pipeline-compliance.sh` entry was treated as a duplicate and dropped during merge.

Now dedupes on `[matcher, command]` pair. `Write → X` and `Edit → X` are recognised as distinct entries. Idempotent — re-running the installer doesn't add duplicates.

**Affects:** projects that installed Specflow before 0.3.0 (when the `Edit` matcher was added to `hooks/settings.json`) and have updated since. The update would refresh the hook script but silently leave `Edit` unwired. After 0.5.1, running `npx @colmbyrne/specflow update .` adds the missing matcher automatically.

Verify with `npx @colmbyrne/specflow verify` section 13 — should show both `Write → check-pipeline-compliance.sh ✅ wired` and `Edit → check-pipeline-compliance.sh ✅ wired`.

---

## 0.5.0 (2026-04-09)

**Pre-push branch freshness hook + pre-code reconnaissance.**

Two new Specflow primitives, both driven by failure patterns observed in real sessions:

### Pre-push hook (mechanical enforcement)

New git hook: `.git/hooks/pre-push` blocks pushes from branches more than 5 commits behind `origin/main`. Prevents the "weeks-old base" failure mode where a stale branch is pushed without rebasing, re-introducing fixed bugs or conflicting with recent work.

- Threshold 5 (not 2) accounts for normal release/CI drift
- Self-disables if there's no `origin` or no `origin/main`
- Override with `git push --no-verify` if you know what you're doing
- Installed automatically by `install-hooks.sh`
- Checked in `verify-setup.sh` sections 8 and 13

### Reconnaissance step in specflow-writer

`agents/specflow-writer.md` now has a mandatory **Q7 — RECONNAISSANCE** section at the top, before any code generation. It forces the agent to:

1. Trace transitive imports to package boundaries
2. Survey existing tests in the same directory — copy their patterns
3. Inspect `jest.config.cjs` for `transformIgnorePatterns` and `moduleNameMapper` — catches ESM crashes before they happen
4. Search sibling tests for existing `jest.mock()` patterns — reuse, don't re-invent
5. List existing factory/helper patterns in the workspace — reuse or justify creating new
6. Enumerate every layer a new string literal value must propagate to

**Why:** four of five common post-code corrections (pino-http stubs, better-auth ESM, cross-layer enum gaps, reflexive stubbing) are prevented at pre-code time by tracing the import graph and harness config before writing.

### Builder guidance — harness triage framework

New doc: `agents/builder-guidance.md`. Not an invocable agent — a decision framework for builder-style agents when a test fails for harness reasons. Instead of reaching reflexively for `jest.mock()`, builders consult five options (stub, existing factory, product refactor, different boundary, shared helper) with a 60-second rule for choosing.

### Optional reviewer-gate template

`templates/hooks/pre-commit-gate-file.sh.example` — opt-in template for projects using a reviewer/builder chat protocol with `specs/agentchat.md` and `[R-NNN]`/`[S-NNN]` tags. Not installed by default; documented in `templates/hooks/README.md`. Most projects don't need this; those that do can customise the configuration variables at the top and copy to `.git/hooks/pre-commit`.

### Why these changes

An LLM is a next-token predictor, not a persistent process. Invariants established in token T are not automatically active in token T+1000. Written rules lose to completion drive. The only changes that work long-term are:

1. **Mechanical enforcement at git-action boundaries** (pre-push is this)
2. **Re-injecting rules into active context at decision time** (Q7 reconnaissance is this)
3. **Decision frameworks in agent docs** (builder guidance is this)

Deferred: propagation manifest for cross-layer enum values. The check needs per-project layer path configuration and a per-project ignore-list for import/fixture noise. Shipping it without both would false-positive enough to get disabled. We'll revisit once we have a real project ready to prototype against.

---

## 0.4.0 (2026-04-04)

**Pipeline compliance hook is now a regression detector, not a state auditor.**

The hook fired on every Write/Edit and did a full repo scan, reporting historical debt as if every keystroke had introduced it. Worst case: writing an unrelated file like `specs/pr.md` triggered 23 violations against pre-existing journey gaps. The hook also recommended `npm run compile:journeys` even on projects where that script no longer existed.

What changed:

- **Hook reads stdin** to find the file just written. Only files in the journey pipeline are checked. Writing `specs/pr.md`, `package.json`, or `src/components/Button.tsx` exits 0 silently.
- **Hook self-disables** when Specflow is not active in the project (no `docs/contracts/`, no `.specflow/`, no `scripts/agents/`). Prevents false positives after Specflow is uninstalled.
- **Remediation messages check the project's actual scripts** before recommending them. If `compile:journeys` is not in `package.json`, the message says "manually create the YAML in `docs/contracts/`" instead of pointing at a dead script.
- **Contract-first writes get a warning, not a failure.** If you write a contract YAML before its test exists, the hook warns but doesn't block — the test is probably coming next.
- **Component file checks and TODO stub checks moved to `verify`** — those are debt reports, not regressions, and they belong in the audit command.

For full project audit (the old behavior), run `npx @colmbyrne/specflow verify`.

**Why:** Real user case where `check-pipeline-compliance.sh` fired 23 violations on every unrelated edit, citing a script (`npm run compile:journeys`) that the team had removed weeks earlier. The hook had no concept of state and conflated "did this write introduce a problem?" with "does the project have any problems?"

---

## 0.3.0 (2026-04-04)

**Journey test honesty** — Specflow now checks your tests actually run, not just that the file exists.

If your tests use `test.skip()`, mock everything, or just scan code with regex, the hook will block and tell you why. This came from the HookTunnel canary incident (HOOK-724–727) where 4 test files passed all checks but none exercised the real path. Platform canary was broken for weeks.

- `run-journey-tests.sh` audits test files BEFORE running them:
  - No `page.goto` or `request.*` calls → fail (not a real journey test)
  - All tests use `test.skip()` → fail (skipped is not passed)
  - Mocking detected (`jest.fn`, `vi.fn`) → fail (must exercise real path)
  - Contract `required_patterns` checked against test content
  - Contract `forbidden_patterns` checked against test content
- `CONTRACT-SCHEMA.md`: added `test_hooks.required_patterns` and `test_hooks.forbidden_patterns`
- `verify-graph.cjs`: validates new pattern fields compile as valid regex
- `specflow-writer.md`: MANDATORY OUTPUT RULES at top — always create `.yml` files, never markdown

Also in this release:
- Contracts must be YAML in `docs/contracts/` — not markdown. Claude is now blocked from writing invariants into `.md` files.
- `specflow-writer` agent has MANDATORY OUTPUT RULES at top — always creates `.yml` files

---

## 0.2.0 (2026-04-04)

**CLAUDE.md is verified properly** — checks your project context is real, not just filled in.

- Board CLI: checks the binary is actually installed (not just the string in CLAUDE.md)
- Repository: compared against `git remote` URL — warns if they don't match
- Feature branches: `git log` depth increased from 5 to 20 (commits with issue numbers weren't found)
- Audit errors: now show which repo and how to diagnose
- Hook updates: `install-hooks.sh` copies all `*.sh` dynamically (new hooks auto-installed)

---

## 0.1.11 (2026-04-04)

**Settings.json matcher check fixed** — was doing an exact diff (always warned if you had custom hooks). Now checks each required Specflow matcher individually. Catches "Write wired but Edit missing" specifically.

## 0.1.10 (2026-04-04)

**Bug fix** — apostrophe in "don't" broke `setup-project.sh` on Mac/Linux.

## 0.1.9 (2026-04-04)

**Fix commands use npx** — `verify-setup.sh` no longer prints ugly `/Users/x/.npm/_npx/...` cache paths. All suggestions use `npx @colmbyrne/specflow`.

## 0.1.8 (2026-04-04)

**Audit tells you how to fix** — instead of "Add SQL section to issue #500", now gives a copy-pasteable prompt for Claude Code.

## 0.1.7 (2026-04-04)

**CLAUDE.md checked field by field** — Repository, Board CLI, Tech Stack, all 5 rules, Contract Locations, Active Contracts, Override Protocol. Each with CRITICAL/HIGH/MEDIUM severity and plain-English impact.

## 0.1.6 (2026-04-04)

**Rule 5: Contracts are YAML, not Markdown** — prevents Claude from writing invariants into `.md` files.

## 0.1.5 — 0.1.2 (2026-04-04)

Docs, postinstall message, CLAUDE.md auto-creation, README cleanup.

## 0.1.1 (2026-04-04)

**Bug fix** — audit RLS check matched the bare word "RLS" in prose text.

## 0.1.0 (2026-04-04)

**First release.** Published to npm as `@colmbyrne/specflow`.

5 commands: `init`, `verify`, `update`, `audit`, `graph`. 30+ agents, 5 default contracts, 5 hooks, git commit-msg enforcement, CI workflow templates.
