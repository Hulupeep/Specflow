# Specflow next delivery plan — 26 October 2026

Owner intent: agents build safe, useful features with proportionate checks,
explainable evidence and routine decisions handled without Colm. Research and
coding roles are replaceable. HeyStax carries durable intent, assignments,
handoffs and results; the existing execution ledger remains authoritative for
run facts. Revenue claims require product evidence, not PR counts.

This is a delivery plan, not a new story or a build-ready promotion. Existing
issue bodies, comments, acceptance and trust contracts remain authoritative.
Prepare only the next selected slice; keep later work thin.

## Current checkpoint

- PR233 / #181: bounded owner-local controller merged. Live timers remain off.
- PR234: proportional work routing, portable research/coding roles and the
  intent-to-evidence direction merged. This is guidance, not a hosted service.
- PR236 / #235 A: the fixed one-recovery review dead end is removed in updated
  helpers/new runtimes. Explicit limits and acceptance remain. Final local
  verification passed 1,729 tests across 85 suites, no failures/skips; native
  implementation Duo accepted 6/6 and finished. Three protocol-invalid responses
  preceded the valid fourth attempt; none earned acceptance. An earlier hook
  failure and its passing retries remain disclosed in PR236.
- #235 remains open for B. Controller defaults still allow only 24 native starts
  and 30 minutes. Existing pinned sessions were not hot-updated. No live CI result
  is implied by the local test run; PR236 reported no CI checks.
- #182, #183, #218 and #219 are open and still need scoped preparation before
  implementation. There were no open PRs at the checkpoint before this docs plan.

## Delivery order

| Order | Existing issue | Deliver | Evidence needed before advancing |
|---|---|---|---|
| 1 | [#182](https://github.com/Hulupeep/Specflow/issues/182) | Minimum durable decision memory, consumed by the next cycle and replacement role. | A later selection changes because of cited prior evidence; equivalent failed ideas do not repeat without new justification; retained changes update the baseline; contradictions and provenance survive replacement. |
| 2 | [#183](https://github.com/Hulupeep/Specflow/issues/183) with [#235 B](https://github.com/Hulupeep/Specflow/issues/235) | Crash-safe recovery and truthful reports, then qualified effort/window defaults using that recovery boundary. | Real process interruption and replacement at operation boundaries produce no second authoritative build, unknown call replay, repeated holdout or manufactured result. Subscription work has no invented financial/start-count stop; explicit costly-route/owner limits and a finite work horizon survive resume. |
| 3 | [#218](https://github.com/Hulupeep/Specflow/issues/218) | Authenticated durable async job API/MCP facade over the existing engine. | Disconnect/retry returns the same job; concurrent callers and timer/manual overlap create one admitted build; revoked/cross-repo operations fail; CLI and MCP expose the same execution facts. |
| 4 | [#219](https://github.com/Hulupeep/Specflow/issues/219) | Thin callable integration and bidirectional configured HeyStax handoff. | Two supported callers use one service; task, contract, job, authorised PR and result stay correlated; delivery retry/late acknowledgements do not create duplicate jobs or PRs. |
| 5 | #215 / #172 release gate | Qualify unattended operation on the existing supported recipe, then activate only the proven schedule/caller scope. | An intent/task arrives, one authorised worker builds against fixed checks using real inputs, interruption recovers, and the evidenced result returns to the correct Stax. Report retained/reverted/inconclusive code results separately from proven/disproven/needs-change experiment results. |

The next implementation is #182, not another pass through #235 A. Recovery
needs the identity and decision state established by minimum memory. #235 B and
#183 share a boundary: loosening defaults before reliable checkpoint/recovery
would trade a frustrating stop for uncertain repeated work. Their preparation
should resolve that seam together; they need not become one giant PR.

## Decisions to resolve in the selected slices

For #182, choose the bounded repo-scoped decision/verdict schema, authenticated
decision sources and equivalent-hypothesis fixtures. Separate rejecting an idea
from resolving an uncertain run. Reuse existing ledger/evidence references; do
not build a general learning platform or expose holdouts through memory.
Implementation failure or invalid data must not become false hypothesis disproof.

For #183/#235 B, define durable operation admission and ownership fencing using
the qualified worker/store, including before outbound operations. Select the
documented finite work-session/overnight horizon and same-job checkpoint rules
during preparation. Ordinary technical choices belong to the builder. Preserve
original IDs, explicit owner ceilings, elapsed history and consumed work; no
hidden deadline reset or automatic chain into a multi-day run.

Subscription or owner-declared low-cost routes should not acquire invented
financial/review-count ceilings. Registered expensive billable routes keep
configured brakes; caller text cannot relabel them as cheap. Keep estimates,
billing mode, provider quota and actual measured charges separate. If a route is
unavailable or unauthorised, use an already-permitted alternative or return an
evidenced limitation rather than silently waiting on Colm or purchasing access.

For #218/#219, resolve authenticated transport, strict request schemas, operation
cancellation and the separately authorised publisher boundary. Reuse the existing
engine and recovery records. Qualify the actual connected HeyStax tools for
claiming, acknowledgement, deduplication and replacement; observed action-state
fields alone do not prove atomic dispatch. Hooktunnel is a transport to qualify,
not a new authority source or executor. No launch UI is required for the first
adapter. If any slice adds SQL/RPC, its schema, permissions and migration gates
apply before shipping.

## How the next work runs

For each selected slice: import the live issue/comments and current code; use
the loop selector to choose the lightest sufficient route; resolve the scoped
decisions; run the required simulation, audit and pre-flight; obtain build-ready
promotion; implement and execute the mapped checks; use independent Duo where
the risk warrants it; commit, publish and reconcile the Stax with actual results.
Future service/plugin tickets stay thin until their dependencies are qualified.

Prefer a narrow working end-to-end slice over another standalone agent framework.
Keep the original multi-cycle acceptance open until its proof exists; a minimum
memory milestone or single scheduled cycle does not close broader epics.

The recent reviews exposed avoidable protocol friction (a missed required read,
failed evidence cited for a passing gate, and a duplicate evidence path). Retain
those concrete diagnostics for tooling follow-up. Do not respond by weakening
access, evidence or acceptance checks, or introducing another arbitrary retry cap.

## Status and principal risk

The architecture and order remain aligned with the owner's intent. The immediate
review stop is fixed, but reliable unattended delivery is not yet shipped.
Recovery/ownership correctness and effort-policy alignment are the next critical
boundary. API/plugin work must not conceal or bypass that gap. Live nightly
activation remains off until the recovery and end-to-end release evidence passes.
