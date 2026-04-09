# Changelog

All notable changes to `@colmbyrne/specflow`.

**Update:** `npx @colmbyrne/specflow update . --ci` then `npx @colmbyrne/specflow verify`

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
