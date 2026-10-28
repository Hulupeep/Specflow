# Frozen native Improve checks

A deciding native check remains evaluator-authored under `holdout/`, outside the
product worktree. Its practice counterpart lives under `dev/`; practice cannot
decide. Keep the existing atomic command shape when a native suite is unnecessary.

For a native check replace `command` with the existing execution inventory:

```json
{
  "artifact": "holdout/resume.test.js",
  "level": 1,
  "verification_level": "process",
  "boundaries": ["filesystem"],
  "configuration_ids": ["local"],
  "checker_paths": ["holdout/resume.test.js", "holdout/jest.config.cjs"],
  "input_paths": [],
  "rule_paths": [],
  "execution": {
    "adapter": "jest",
    "test_files": ["holdout/resume.test.js"],
    "required_case_ids": ["holdout/resume.test.js::resume within two steps"],
    "optional_case_ids": [],
    "args": ["--config", "holdout/jest.config.cjs"]
  }
}
```

Record oracle authorship for **every** deciding checker, config, input and rule
file before freezing. Every declared path must stay under its check set; symlinks
are rejected. The evaluator root needs the real installed native framework
(`jest` or `@playwright/test`), resolvable through its normal Node module lookup.
No automatic dependency installation or paid fallback is performed. Use an
explicit self-contained config rooted at the private evaluator directory. The
shared adapter owns the command, report location and required/optional accounting.
The only additional filtering argument supported here is `--testNamePattern` for
Jest. It cannot waive a required case. Playwright IDs follow the existing native
format `project::file::title`.

The process receives Improve's scrubbed environment and `IMPROVE_WORKSPACE` for
the actual product. Reports stay private and bind the frozen contract, product,
oracle bytes, environment and framework. A skip, missing report, stale binding or
copied receipt cannot become a passing required check. Saved receipts are history,
not restored process-local ownership. This initial integration supports native
behaviour claims; parent correctness comparisons and data-seam metadata are
rejected here. It provides no OS sandbox or customer-benefit assurance.

# Build continuation

Ordinary subscription/unknown work has no default repair count or invented dollar
cap. Useful progress is newly passing practice criteria/native case IDs; repeated
unchanged rounds produce a named diagnosis with the failing criteria and last
peer direction. Practice progress still cannot decide KEEP. The default build
session horizon is one hour, separate from financial policy.

`improve build ... --continuation-policy limits.json` accepts the shared
`usageMode`, `maxCalls`, `maxElapsedMs` policy. The selected policy is recorded at
implementation start; count/time checkpoints stay binding. Explicit expensive
billable-route admission and actual CLI spend caps remain governed by the existing
adapter policy. No history is reset, consumed holdout retried or criterion changed
to continue. At a diagnosis/checkpoint preserve the run and inspect its concrete
cause before selecting a justified next experiment.
