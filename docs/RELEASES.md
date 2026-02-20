# Specflow Release Notes

---

## v0.6.1 — 2026-02-20

### Hook System Bug Fixes

Ten bugs fixed across the hook installation and runtime system. All fixes are covered by 73 new and updated tests (558 total, 14 suites).

#### Fixes

| # | Component | Summary |
|---|-----------|---------|
| 1 | `install-hooks.sh` | **jq merge overwrites existing hooks.** `jq -s '.[0] * .[1]'` replaces arrays instead of concatenating. Installer now concatenates PostToolUse arrays and deduplicates by command. |
| 2 | `hooks/settings.json` | **post-push-ci.sh never registered.** The CI feedback hook existed in `templates/hooks/` but was missing from the settings manifest. Now registered. |
| 3 | `hooks/run-journey-tests.sh` | **Silent failure when gh CLI missing.** `gh` errors were swallowed by `2>/dev/null`. Now checks `command -v gh` and `gh auth status` before use, exits 2 (model-visible) on failure. |
| 4 | `install-hooks.sh` | **Static success banner.** Installer always printed "Installation Complete" even when files failed to copy. Banner now verifies critical files exist and are executable. |
| 5 | `verify-setup.sh` | **Executable bit not checked.** Used `[ -f ]` instead of `[ -x ]` for hook scripts. Non-executable hooks passed verification silently. Now checks `[ -x ]` and reports "not executable" on failure. |
| 6 | `hooks/run-journey-tests.sh` | **Journey ID regex matches trailing hyphens.** `J-[A-Z0-9-]+` matched `J-AUTH-SIGNUP-` (trailing hyphen). Fixed to `J-[A-Z0-9]+(-[A-Z0-9]+)*`. |
| 7 | `hooks/run-journey-tests.sh` | **ERR trap exits code 1 (invisible to Claude).** `set -e` causes exit 1 on unexpected errors, which Claude Code ignores. Added `trap 'exit 2' ERR` so failures are model-visible. |
| 8 | `install-hooks.sh` | **session-start.sh installed as dead placeholder.** The file contained only `exit 0` and served no purpose. Removed from the install loop. |
| 9 | `install-hooks.sh` | **mktemp file leaks on jq failure.** If jq merge failed, the temp file was left behind. Now cleaned up in the error path. |
| 10 | `hooks/post-build-check.sh` | **Only Node.js build commands detected.** Only matched `npm/pnpm/yarn build`. Now also detects `cargo build`, `go build`, `make build`, `gradle build`, `mvn package`, `mvn compile`, `tsc`, `webpack`, and `turbo run build`. |

#### Files Changed

- `hooks/settings.json` — Added post-push-ci.sh registration
- `hooks/run-journey-tests.sh` — gh pre-flight, regex fix, ERR trap
- `hooks/post-build-check.sh` — Expanded build command detection
- `install-hooks.sh` — jq merge fix, banner verification, session-start removal, temp cleanup
- `verify-setup.sh` — Executable bit checking

#### Test Coverage

- `tests/hooks/installer-fixes.test.js` (new) — 12 tests for bugs 1, 2, 4, 5, 8
- `tests/hooks/post-build-check.test.js` — 11 new build detection cases (bug 10)
- `tests/hooks/run-journey-tests.test.js` — 10 new tests for bugs 3, 6, 7

**Total: 558 tests across 14 suites (up from 469 across 12 suites).**

---

## v0.6.0 — 2026-02-14

### CSV Journey Compiler, CI Templates, Team Workflows (#12)

- CSV journey compiler with parsing, YAML output, Playwright generation, and validation
- CI template integration
- Team workflow support

---

## v0.5.0 — 2026-02-12

### SKILL.md Portable Skill, verify-setup Enhancements (#9, #11)

- SKILL.md portable skill definition
- Enhanced verify-setup.sh infrastructure checks

---

## v0.4.0 — 2026-02-10

### Test Harness, Regex Fixes, Confidence-Tiered Fix Patterns (#6, #10)

- Initial test harness (469 tests across 12 suites)
- Regex bug fixes in contract patterns
- Confidence-tiered fix patterns
- README overhaul
