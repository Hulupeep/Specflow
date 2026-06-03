# Pre-flight Gate

Condensed from Specflow's `pre-flight-simulator.md`. Pre-flight is a **read-only**
simulation of the uplifted ticket. It does not write code and does not write to
GitHub — it returns findings. The auditor skill writes the result to the ticket
ONLY when the gate passes.

## What pre-flight simulates

Walk the combined ticket (original body + uplift additions) and check, without
writing code, whether a builder could implement it deterministically:

- **Schema executes**: the SQL parses, references real tables/columns, no
  duplicate migration timestamps, no RLS recursion (policy A ↔ policy B), no
  dropped sibling behaviour when a function is `CREATE OR REPLACE`d.
- **Contracts trace**: every `REQ-NN` maps to a contract/test; every invariant
  code is unique and stated; named files have plausible paths.
- **Journeys grounded**: each Gherkin scenario has the data-testids it needs;
  personas cover happy + the key negative path.
- **Journey = DoD (UI stories)**: the journey IS the definition of done. Check
  all four, each a CRITICAL when absent:
  1. ordered, explicit user **steps** are written;
  2. each step has a **success criterion** (a testid / visible text / URL assertion);
  3. a **Playwright spec exists** mapped to the story's `J-<NAME>` id and encodes
     those steps + assertions (not a stub, not `test.skip`);
  4. the journey has **actually executed** — a recorded pass, OR an explicit
     "varied because of decision X" note (where the real flow legitimately
     diverged and why intent is still met). "Written but never run" = CRITICAL.
     A deferral is acceptable ONLY with a linked tracking issue; a bare skip is not.
- **No naked claims**: acceptance criteria are observable behaviour, not
  implementation detail; negative paths are present.
- **Value-set parity**: enums/allowed-values in the spec match across SQL,
  TypeScript, and validators (a classic drift source).

## Severity model

| Severity | Meaning | Effect on compliance |
|----------|---------|----------------------|
| **CRITICAL** | The ticket cannot be built/verified as written — broken SQL, missing required section for the ticket type, RLS recursion, migration collision, an invariant the work would violate, a `CREATE OR REPLACE` that drops existing behaviour, **or (UI story) the journey-as-DoD failures below**. | **Blocks compliance.** |
| **P1** | A builder would very likely produce the wrong thing — value-set drift, a REQ with no test mapping, a journey with steps but a missing testid, an unstated cross-surface dependency (e.g. PDF payload not extended for a new field). | **Blocks compliance.** |
| **P2** | Non-blocking polish — naming nits, a nice-to-have edge case, a reactive-state subtlety. | Does not block; log it. |

## The gate (HARD STOP)

A ticket is **compliant** only when pre-flight returns **no CRITICAL and no P1**.

- **CRITICAL or P1 present** → surface every finding with its fix. Do NOT write a
  passing `## Pre-flight Findings` section. Leave the ticket non-compliant and
  report exactly what remains. The auditor never overrides this.
- **Clean or P2-only** → write the `## Pre-flight Findings` section (below) with
  the right `simulation_status` and mark compliant. Log P2s.

Uplift does not grandfather previous failures: if uplift fixed some gaps but a
CRITICAL/P1 remains, the ticket stays non-compliant.

## `## Pre-flight Findings` section format

Append this to the ticket body (via `gh issue edit <n>`) ONLY when the gate passes:

```markdown
## Pre-flight Findings

**simulation_status:** passed | passed_with_warnings | blocked | stale | override:<reason>
**simulated_at:** <RFC 3339 UTC, e.g. 2026-06-03T14:32:00Z>
**scope:** ticket

### CRITICAL
None

### P1
None

### P2
- <non-blocking finding, or "None">
```

`simulation_status` values:
- `passed` — no findings at any level.
- `passed_with_warnings` — P2 only.
- `blocked` — CRITICAL or P1 present (do NOT write this as a "compliant" result; report instead).
- `stale` — the ticket changed after the last simulation; re-run.
- `override:<reason>` — a human explicitly accepted a known finding; record who and why.

Timestamps: do not invent a clock. Read the real UTC time (e.g. `date -u +%Y-%m-%dT%H:%M:%SZ`) when stamping `simulated_at`.
