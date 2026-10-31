# Completed review-stage recovery (#311)

A corrected review may resume in the same admitted run and cycle through the trusted controller worker:

```js
adapter.start('critique', [runDir, { include: [groundingFile] }], {
  retry: { operation_id: failedOperationId, reason: 'Corrected the malformed include list' }
});
```

This is an explicit repair request. Omitting `retry` retains the existing blocked behaviour. Only critique, oracle and judge are eligible. Caller-declared arguments and referenced file bytes must differ from every failed input in that retry chain. The stable review-input digest excludes automatic run-ledger state and injected memory; it is also included in the sealed full stage-input binding. The current assigned execution holder must have resumed through the existing ownership mechanism. The controller revalidates the failed operation's sealed completion and checks the original deadline, ownership, outstanding operations, attempt limits and selected role's route ceiling before atomically recording the replacement reservation.

The original receipt and failed operation remain unchanged. Run reports expose `review_retries`, including the original failed check and the repair. The new operation has `retry_of` and `retry_reason`; `review_stage_retry_reserved` links both input hashes. Consumed attempts and cycles are not reset. This path does not permit replay of build or verifyPhase, change frozen acceptance, or turn failed evidence into acceptance. The core still enforces its own stage and frozen-contract rules.

Critique `include` is an optional array of nonempty file-path strings. A string, null or malformed array is rejected before memory injection, stage reservation or core input copying.

A pinned older runtime does not gain this API through reinstalling the package elsewhere. Preserve its evidence and qualify a supported control-plane upgrade separately; never overwrite pinned artifacts or edit the journal to clear a stop. An expired original window stays expired. The real second-cycle qualification remains incomplete until fresh execution proves it.

An older failed operation without the stable review-input proof is ineligible for this API. Do not manufacture that historical proof or retrofit its stored operation. Such a run remains incomplete; separately admit and qualify further work under its own recorded scope and limits. Oracle authoring archives any prior draft before creating a clean working draft; rejected files cannot silently become accepted checks.
