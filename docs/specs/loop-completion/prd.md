# Loop Completion PRD

GitHub issue: #81

## Job To Be Done

When an operator runs Specflow as a loop, the runner must do more than write a
contract. It must execute mapped mechanical gates, reject stale ticket inputs,
capture provider evidence, enforce human gates from structured events, install
safe adapter policies, and expose provenance as a reusable command.

## Scope

In scope:

- Stage executor and verifier registry for `specflow run`.
- Simulation freshness checks before feature-build readiness.
- Opt-in live adapter smoke checks for Claude and Codex CLIs.
- Structured Claude/Codex event parsing for final text, session IDs, errors,
  and tool/action events.
- Stronger `never_without_human` enforcement from parsed events and denied
  command patterns.
- Safe adapter policy templates installed by `specflow init`.
- Reusable `specflow provenance` gate.

Not in scope:

- Hosted scheduling.
- Automatic push/PR/merge.
- Live provider calls in CI by default.

## Requirements

- REQ-01 (MUST): `specflow run` must map current loop stage/rail to a verifier
  command when one exists and execute it before advancing.
- REQ-02 (MUST): Feature-build readiness must fail when simulation evidence is
  missing or older than the ticket/spec input.
- REQ-03 (MUST): Live Claude/Codex adapter smoke checks must be opt-in and
  skipped by default in CI.
- REQ-04 (MUST): Provider JSON/JSONL streams must be parsed into final response,
  session ID, errors, and tool/action events where available.
- REQ-05 (MUST): `never_without_human` must be enforced from parsed provider
  events and denied command patterns, not only raw text.
- REQ-06 (MUST): `specflow init` must scaffold safe adapter policy templates.
- REQ-07 (MUST): Add reusable `specflow provenance <file>` command that rejects
  missing source provenance and mock/literal laundering.

## Acceptance Criteria

- AC-1: A run contract at `GATE_B` with ticket artifacts executes seam, ADR, and
  ticket-journey verifiers and advances only on success.
- AC-2: A feature-build contract with stale simulation evidence stops before
  implementation with an actionable error.
- AC-3: `specflow adapter-smoke claude-print --dry-run` and
  `specflow adapter-smoke codex-exec --dry-run` print planned checks without
  invoking live models.
- AC-4: Provider event parsers extract final text and detect tool calls that
  attempt forbidden actions.
- AC-5: `specflow init` installs starter policy templates under
  `.specflow/adapter-policies/`.
- AC-6: `specflow provenance evidence/provenance-77-78-80.json` passes, while a
  provenance file with no source trace fails.

## Success Metrics

- The runner can advance at least one real mechanical gate without manual
  command copy/paste.
- Feature-build can block stale simulations before code changes.
- Adapter tests remain deterministic and do not call live models unless the
  operator opts in.
