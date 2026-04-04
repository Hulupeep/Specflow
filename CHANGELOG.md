# Changelog

All notable changes to `@colmbyrne/specflow`.

**Update:** `npx @colmbyrne/specflow update . --ci` then `npx @colmbyrne/specflow verify`

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
