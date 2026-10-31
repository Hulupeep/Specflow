# #313: subscription role deadline and observer recovery

Bounded non-UI runtime bug. Parent #232; qualification #171/#172. Existing receipt, authority and recovery contracts remain authoritative. No production schema, UI, testids, new service, provider or paid fallback.

## Simulation Findings (proposed)

- Patient subscription operator: ordinary success returns bound native output; divergent route takes longer than four minutes inside the authorized job. REQ-1: no hidden shorter relay deadline may terminate it.
- Interrupted operator: normal supervisor receipt is consumed once; divergent route loses the caller before successful completion. REQ-2: retain the reserved operation and original sealed output, reconcile before any new call; receipt reconciliation is not oracle acceptance.
- Cancelling owner: normal operation completes; divergent route cancels or reaches the original deadline. REQ-3: preserve controller cancellation, bounded cleanup and unknown-completion diagnosis. Never extend the job or create a replacement inference to hide the failure.
- Malformed caller: valid explicit deadline is observed; divergent routes omit it or supply NaN, strings, past or huge values. REQ-4: validate explicit deadlines before launch, never reinterpret an invalid value as unlimited. Managed calls derive their deadline from the verified generated gateway and authoritative controller record. Only transport cleanup gets a documented30second grace; it grants no provider execution after the job deadline. Direct calls require an explicit finite deadline, with the native timer range enforced.

Accepted under standing implementation authority. No unresolved product decision. The old live run remains pinned; no in-place runtime repair.

## Gap analysis and surgical uplift

Present in #313: observed branch, source cause, outcome, acceptance and negatives. Added here: role/request interface, lifecycle mapping and scenarios. Data contract and frontend interface N/A: private CLI process transport only. Reuse feature_improve_controller.yml and feature_improve_recovery.yml; no new invariant IDs.

```ts
interface RoleDeadline {
  // Required for direct calls; verified generated gateways supply the controller deadline.
  deadlineAtMs?: number | null;
}
```

```gherkin
Scenario: Work within the authorized window
  Given a supervised subscription role and an unexpired job
  When native work outlasts the old local relay interval
  Then the same invocation can finish and its bound terminal receipt is retained
Scenario: Observer loss
  Given an original provider remains live after observation ends
  When an operator recovers
  Then no duplicate provider starts before original completion is reconciled
  And a completed provider receipt alone does not establish oracle acceptance
Scenario: Explicit expiry
  Given an explicit deadline or owner cancellation
  When that limit is reached
  Then the owning supervisor retains its interruption and completion evidence
  And no clock or attempt counter is reset
```

Files: scripts/improve-worker.cjs, scripts/improve-worker-role.cjs, scripts/improve-controller-provider.cjs, scripts/improve-worker-qualify.cjs and focused tests/integration/improve-role-deadline.test.js; controller gateway/recovery tests reused. Delivery DoD: red regression, focused tests, native installed operation, independent review, canonical CI before merge. Preserve failed qualification and no product success claim from transport tests. Returned native output still passes existing binding/model/tool checks.

## Pre-flight disposition

No CRITICAL/P1 specification gaps identified for this bounded non-UI repair. This is not formal build-ready promotion or proof of passing execution. P2: genuine observer loss still requires explicit receipt reconciliation; generic late-output acceptance must not be smuggled in as a timeout fix. Native validation remains required before closure.

## Independent review repair

The first advisory review requested changes: unrestricted direct calls and unknown process identity could hang. Managed gateway identity now requires exact generated wrapper bytes plus private matching context and controller run; direct calls require an explicit deadline. Both relay and observer are bounded, unknown identity fails closed, and a terminal record is rechecked after an exit observation. Explicit timeout reports unknown completion with no automatic retry. Prior review and installed proof remain retained; updated runtime qualification is pending.
