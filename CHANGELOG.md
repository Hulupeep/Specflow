# Changelog

All notable changes to `@colmbyrne/specflow`.

---

## 0.3.0 (2026-04-04)

**Journey test honesty** — Specflow no longer trusts that tests exist. It verifies they exercise the real path.

- `run-journey-tests.sh` audits test files BEFORE running them:
  - No `page.goto` or `request.*` calls → fail (not a real journey test)
  - All tests use `test.skip()` → fail (skipped is not passed)
  - Mocking detected (`jest.fn`, `vi.fn`) → fail (must exercise real path)
  - Contract `required_patterns` checked against test content
  - Contract `forbidden_patterns` checked against test content
- `CONTRACT-SCHEMA.md`: added `test_hooks.required_patterns` and `test_hooks.forbidden_patterns`
- `verify-graph.cjs`: validates new pattern fields compile as valid regex
- `specflow-writer.md`: MANDATORY OUTPUT RULES at top — always create `.yml` files, never markdown

**Why:** HOOK-724–727 incident. Tests existed, passed all checks, but were regex scans and `test.skip()` — never exercised the real path. Platform canary was broken for weeks.

---

## 0.2.0 (2026-04-04)

**End-to-end simulation fixes** — 6 critical/high gaps found by running a full user journey simulation.

- `verify-setup.sh`: Board CLI checked for actual installation (not just string filled in CLAUDE.md)
- `verify-setup.sh`: Repository compared against `git remote` URL
- `run-journey-tests.sh`: `git log` depth increased from 5 to 20 (feature branches with many commits)
- `bin/specflow.js`: audit error now shows repo URL and diagnostic commands
- `install-hooks.sh`: copies all `*.sh` from hooks/ dynamically (new hooks picked up automatically)
- `specflow-writer.md`: MANDATORY OUTPUT RULES added at top

---

## 0.1.11 (2026-04-04)

- `verify-setup.sh` section 13: subset match for `settings.json` matchers instead of exact diff
- Catches "Write wired but Edit missing" — Dominik's exact issue

## 0.1.10 (2026-04-04)

- Fix bash syntax error: apostrophe in "don't" broke single-quoted block in `setup-project.sh`

## 0.1.9 (2026-04-04)

- All fix commands in `verify-setup.sh` now use `npx @colmbyrne/specflow` instead of raw bash paths

## 0.1.8 (2026-04-04)

- `specflow audit` gives a copy-pasteable Claude Code prompt instead of vague "Add X section" checklist

## 0.1.7 (2026-04-04)

- `verify-setup.sh` section 5 checks every required CLAUDE.md field with severity (CRITICAL/HIGH/MEDIUM)
- Checks: Repository, Board, CLI, Tech Stack, Rules 2/3/5, Contract Locations, Active Contracts, Override Protocol

## 0.1.6 (2026-04-04)

- Added Rule 5: Contracts Are YAML, Not Markdown (to CLAUDE.md, template, and setup-project.sh)

## 0.1.5 (2026-04-04)

- README tightened: removed demo section, removed misleading "Execute waves" as next step

## 0.1.4 (2026-04-04)

- `verify-setup.sh` treats missing CLAUDE.md as failure (was warning)
- Missing Specflow Rules section, unfilled placeholders now fail instead of warn

## 0.1.3 (2026-04-04)

- `setup-project.sh` creates CLAUDE.md with Specflow rules (or appends to existing)
- Postinstall message updated to reflect CLAUDE.md handling

## 0.1.2 (2026-04-04)

- Added postinstall message telling users to run `npx init .` per project

## 0.1.1 (2026-04-04)

- Fixed RLS audit false positive: bare word "RLS" in prose no longer matches

## 0.1.0 (2026-04-04)

**Initial release.**

- CLI with 5 commands: `init`, `verify`, `update`, `audit`, `graph`
- `init`: full project setup (agents, contracts, hooks, tests, CLAUDE.md)
- `verify`: 13-section installation check with severity and impact
- `update`: hooks + CI workflow installation
- `audit`: issue compliance check (11 items)
- `graph`: contract cross-reference validation (7 checks)
- 30+ agent prompts
- 5 default contract templates
- 5 hook scripts (build, journey, pipeline compliance, CI, session)
- Git commit-msg hook (rejects commits without issue numbers)
- CI workflow templates (PR compliance + post-merge audit)
