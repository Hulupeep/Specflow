# ADR-002: Node.js Over Bash for All Core Commands

**Status:** Proposed
**Date:** 2026-04-02
**Phase:** 2

## Context

Specflow's three most important operations — init, verify, and hook installation — are implemented as bash scripts totaling 1,712 lines:

| Script | Lines | Purpose |
|--------|-------|---------|
| `setup-project.sh` | 636 | Project initialization |
| `install-hooks.sh` | 313 | Hook installation |
| `verify-setup.sh` | 763 | Setup verification |

These scripts have several problems:

1. **`jq` dependency**: `install-hooks.sh` requires `jq` for JSON manipulation. This isn't declared as a dependency and isn't installed on most developer machines. This single dependency causes 6 test failures and blocks the entire hook installation pipeline.

2. **Platform brittleness**: The scripts use bash-specific features (arrays, process substitution, `[[` tests) that don't work in `sh`, and file path handling that breaks on Windows even under WSL.

3. **Untestable**: Testing bash scripts requires spawning subprocesses, mocking filesystem state, and parsing stdout. The existing test suite does this but it's fragile — 20 tests fail in `post-build-check.test.js` due to environment detection issues.

4. **Maintenance burden**: Three different languages in the same project (bash for scripts, Node.js for CLI/compiler, YAML for contracts). Contributors need bash expertise to modify core functionality.

## Decision

**Rewrite all bash scripts as Node.js modules.** The CLI entry point (`bin/specflow.js`) will route commands to `src/commands/*.js` modules. No bash script will be executed by any CLI command.

### What replaces what

| Bash script | Node.js replacement | Key changes |
|-------------|-------------------|-------------|
| `setup-project.sh` | `src/commands/init.js` | `fs.mkdirSync` instead of `mkdir -p`, `JSON.parse` instead of `jq`, `readline` for wizard prompts |
| `install-hooks.sh` | `src/commands/update.js` | `JSON.parse`/`JSON.stringify` for settings.json merging, `fs.chmodSync` for executable bits |
| `verify-setup.sh` | `src/commands/doctor.js` | `child_process.execSync` for git/gh checks, `js-yaml` for YAML validation, structured check results |

### Hook scripts also rewritten

| Bash hook | Node.js replacement |
|-----------|-------------------|
| `hooks/post-build-check.sh` | `src/hooks/post-build-check.js` |
| `hooks/run-journey-tests.sh` | `src/hooks/run-journey-tests.js` |
| `hooks/check-pipeline-compliance.sh` | `src/hooks/check-compliance.js` |

Hook scripts read JSON from stdin (Claude Code's hook protocol). Currently they use `jq` or bash string parsing. Node.js reads stdin, `JSON.parse`s it, and operates on structured data natively.

### What stays as Node.js (already)

- `scripts/specflow-compile.cjs` — journey compiler (418 lines, works)
- `scripts/verify-graph.cjs` — graph validator (475 lines, works)
- `tests/helpers/contract-loader.js` — contract YAML loader (93 lines, works)
- `bin/specflow.js` — CLI entry (rewritten to route to src/)

### Legacy scripts preserved

Old bash scripts move to `scripts/legacy/` for reference during rewrite. They are not executed and not shipped in the npm package.

## Alternatives Considered

### Keep bash, fix `jq` dependency
Replace `jq` with `node -e` inline calls. This fixes the immediate failure but doesn't address platform brittleness or testability. We'd still have 1,712 lines of bash to maintain alongside Node.js.

### Use a shell-compatible subset (POSIX sh)
Rewrite scripts to avoid bash-isms. This would fix some portability issues but not the `jq` dependency, testability, or maintenance burden. It's effort spent making an inferior approach slightly less bad.

### Use TypeScript
Adds a build step, which conflicts with the principle of shipping readable source. The overhead isn't justified for the amount of code involved. Node.js with JSDoc comments provides adequate type checking for contributors.

## Consequences

### Positive
- Zero system dependencies beyond Node.js 20+ and npm
- All 26 failing tests fixed (root cause: bash/jq issues)
- Cross-platform: macOS, Linux, WSL, native Windows (future)
- Testable with Jest (same framework as contract tests)
- Single language for the entire codebase
- Contributors only need JavaScript knowledge

### Negative
- Rewrite effort: ~1,712 lines of bash → ~1,000 lines of Node.js
- Short-term risk: new bugs during rewrite
- Mitigation: legacy scripts available for behavior comparison, full test suite validates

### Performance
Negligible difference. These are project setup and verification commands, not hot paths. Node.js startup time (~100ms) is imperceptible for commands that run once.
