# Declaring a binary improvement

Before freezing a new ImprovementContract, name the intended user benefit and
declare at least one mandatory executable gain. This addition uses the existing
criterion fields and checks; it does not replace the rest of the contract.

```json
{
  "id": "RESUME",
  "statement": "The seeded resume journey completes in at most two steps",
  "intent": "gain",
  "required_level": 2,
  "mandatory": true,
  "baseline_expectation": "fail",
  "dev_baseline_expectation": "fail",
  "check": {
    "type": "custom-script",
    "level": 2,
    "artifact": "holdout/resume.cjs",
    "command": ["node", "{artifact}"]
  },
  "dev_check": {
    "type": "custom-script",
    "level": 2,
    "artifact": "dev/resume.cjs",
    "command": ["node", "{artifact}"]
  }
}
```

An evaluator authors the hidden check before freeze. It must actually exercise
the stated behaviour; the declaration alone is not evidence. The frozen check
and its controlled fixtures define the same binary comparison on baseline and
candidate. A behavioural check that depends on server state still requires a
real seeded backend. Keep fixture/sample inputs controlled; matching check bytes
alone does not prove an external dataset stayed unchanged.

Use `intent: preservation` with `baseline_expectation: pass` for behaviour that
already works and must remain intact. Practice may have a different expectation:
`dev_baseline_expectation` is required when `dev_check` is present, with `n/a`
available when its baseline is deliberately not asserted. Practice results never
prove a gain. A single preservation criterion cannot authorize an improvement
run; at least one other mandatory holdout criterion must prove the gain.

KEEP requires every mandatory gain to change from fail to pass on matched bound
receipts, with unchanged governing contract, oracle and verifier identity. All
mandatory acceptance and required gates must also pass. An existing broken gate
must be repaired before a run can KEEP; “it was already broken” is not a pass.
Missing gain evidence is INCONCLUSIVE; a demonstrated mandatory failure remains
REVERT. Model recommendations cannot manufacture a gain.

This first repair supports binary thresholds only. Numeric gains, aggregation,
measurement noise and statistical confidence need a separately specified oracle;
do not infer gain from two passing measurements or from model praise.

The conservative verifier identity includes the effective environment and resolved
executable paths. Changed environment values or different worktree-local executable
paths make a before/after comparison unavailable, even when they look harmless.
Use the same controlled environment and stable verifier toolchain. Scalable
dependency/runtime identity for full applications remains follow-up work under
#176/#180; this repair does not silently exclude those inputs.

New freezes use envelope `specflow.improvement-contract/v2`. Old runs and reports
remain readable. An unfinished v1 contract with no explicit gain cannot obtain
new KEEP authority. Start a new candidate/run with a fresh evaluator-controlled
holdout when needed; never patch frozen files or rerun a consumed holdout. A
pre-build superseding contract requires its own fresh baseline under the existing
versioning rules.
