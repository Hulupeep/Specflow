# Specflow Release Notes

---

## v0.11.0 — 2026-07-02

### Enforced runtime verifier + long-run trust primitives

The trust layer that decides what ships is now enforced end-to-end, not just described.

- **Runtime verifier lifecycle** — the maker persists a slice-local verification proposal *before* implementation; an independent verifier accepts/rejects it (fed artifact + spec + accepted contract + rubric, never the maker's reasoning trace); runtime checks (`playwright`/`api`/`db-reread`/`console`/`network`/`screenshot`/`custom-script`) write `verifier-findings.jsonl`. A missing executable surface yields a **blocked** finding, never fabricated evidence.
- **Enforced verifier rail** — `feature-build` runs the verifier stage before the gate for runtime-required slices (`ui`, `workflow`, `api_behavior`, `integration`, `data_mutation`, `auth`, `billing`, `runtime_required`). A missing/blocked/failed required finding blocks gate advancement; skips are human-only and ledgered; screenshot-only evidence can't satisfy a value-bearing slice. **Done is decided by the gate, using verifier evidence.**
- **`specflow run trace`** — groups maker claim vs verifier finding vs mechanical gate result and flags divergences (maker-claimed-done-but-verifier-failed, verifier-passed-but-gate-failed, missing evidence, human-gated action attempted).
- **Safe durable re-entry** — on resume the durable run-contract position is authoritative; a conflicting caller-assumed stage is overridden and ledgered (`reentry_conflict`).
- **Isolated delegated worktrees** — `prepareWorktree` refuses a path resolving to the main working tree and ledgers branch/base/path/cleanup; auto-merge/auto-push stay false.
- **Honest subordinate controls** — silent model downgrade is a failed contract; a vision verdict is evidence, never a gate pass; routine manifests must call `specflow run` with no auto human-gated action.

847 tests across 35 suites.

---

## v0.10.0 — 2026-07-01

### Loop runtime controls + adapter accounting

- **Contracted loop runner controls** — `specflow run` carries richer adapter policy metadata (role, effort, requested model, effective/reported model, fallback, budget, usage, cost-per-gate). Model routing is accounting metadata, not evidence: silent downgrade is no longer acceptable, and unknown provider metadata is recorded as `unknown` rather than guessed.
- **Compounding state memory** — loop runs write `.specflow/STATE.md` and one-lesson-per-file memory under `.specflow/lessons/`; generated stage prompts include a bounded state digest so later runs resume from durable facts.
- **Delegation and routines** — isolated-worktree preparation metadata plus `specflow routine <slug>` manifest scaffolding for cron/GitHub/hosted loops. Generated routines call `specflow run` and preserve `never_without_human`.
- **Gate D vision evidence** — `teardown-gate check-gate-d` accepts screenshot plus vision-verifier findings while still requiring value-bearing `.txt`/`.json` oracle re-reads for value hops.
- **Install fix** — `js-yaml` is now a production dependency (the published CLI loads YAML at runtime).

---

## v0.9.1 — 2026-06-12

### Conditional ADR-conformance + universal component-reuse check (#68)

- **`verify-adr.cjs`** is model-free and conditional: it detects an ADR folder (or a CLAUDE.md `ADR Location`) and exits 0 silently when there isn't one. When present, GATE B requires each ticket to cite a resolving ADR id (or `adrNone: <reason>`) and declare `reuses`; a phantom ADR citation is an error. IDs normalize (`ADR-006 ≡ ADR-6 ≡ 0006-foo.md`).
- **adversary-mandate@v3** adds universal reuse-don't-reinvent (reinventing an existing component is fatal) alongside conditional ADR conformance.
- spec-build tickets declare `adrs`/`reuses`; `init` scaffolds the script; `CLAUDE-MD-TEMPLATE.md` gains an optional **ADR Location** field.

---

## v0.9.0 — 2026-06-12

### Pipeline hardening (EPIC) + docs overhaul

- **GATE D — persona-walk integration gate.** Per-slice green is blind to seam bugs, so GATE D walks personas across the merged tree. Red hops are dispositioned `bug` (last-merged writer reopens) or a human-countersigned `stale-oracle`; an epic isn't done until D is green.
- **Hop tables at GATE A** — pinned, value-bearing integration oracle in `PRDs/<slug>-hops.md`, human-signed, with countersigned amendments.
- **Falsification folded into adversary-mandate@v2** — a required falsification artifact (parallel fresh-context sub-run), `verify-falsification.cjs`, and a hash-bound PASS at GATE A.
- **Seam-lite** — tickets declare `writes/reads`; `verify-seams.cjs` computes writer×writer and writer×reader seams at GATE B and derives GATE D hops.
- **Docs** — README overhaul (the three loops named, gate list current, GATE D in the table) and a CLI `help` that describes what `init` actually delivers.

---

## v0.8.0 – v0.8.2 — 2026-06-10

### New loop: `daily-use-teardown` — the front door for already-built products

For a shipped product the question isn't "what should we build" but "are the journeys confusing, and are they doing the right thing?" The new loop maps live routes, stops at a hard human gate to confirm the journey map, runs top-thinker persona walks judging **WORKS / CONFUSING / BROKEN** with screenshot evidence, and hands a prioritized do-list to spec-build. Schedulable monthly/quarterly so the product re-generates its own backlog from observed friction.

Hardened across two patch releases after an independent fresh-context adversary attacked the design:

- **0.8.1** — closed self-attestation holes: `teardown-gate.cjs` replaces "confirmation written into the journey map" with a hash-bound human sign-off (editing the map after sign-off fails `check`); every gate is now mechanical rather than prose checked by the entity it constrains; committed Playwright walk scripts, visible URL bars, and a `bugs.md` for findings are required.
- **0.8.2** — `teardown-walkthrough-mandate@v1` gives teardown a method: JTBD personas, the four cognitive-walkthrough questions per step, and a fixed finding vocabulary so a CONFUSING verdict says which question failed.

---

## v0.7.0 – v0.7.6 — 2026-06-10

### Pipeline v2: mechanical adversary independence + the loop kit ships with `init`

The spec-build adversary stops being "same agent, switched hats." It runs in a fresh context seeded by a fixed template that cannot carry the author's reasoning, gated before it can launch:

- `verify-seed.cjs` byte-checks the spawn seed against `{artifact_paths, tool_grants, mandate_ref}` — any extra key (the priming-leak vector) is rejected, so a primed seed cannot launch.
- `adversary-spawn.cjs`, the versioned `adversary-mandate.md@v1`, and `verify-ticket-journey.cjs` (Gate B's ticket↔journey join) round out the independence machinery.
- **0.7.6** adds two-touch personas — a persona/simulation lens runs at the adversary stage (on the PRD) and again at Gate B.5 (on the tickets).

`specflow init` now scaffolds these gate scripts and the runtime bindings (`PROCESS-CLAUDE.md` / `PROCESS-CODEX.md`) so spec-build and feature-build run end-to-end on either runtime. Patch releases 0.7.1–0.7.5 fixed a `verify-setup` false "invalid YAML" report and shipped CRLF-normalization so `init`/`update` work on Linux/Mac regardless of how the package was published.

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
