# Improve trust spike handoff

The local spike is `spike.md`; the narrow Duo preparation task is `review-task.md`.
No production source/contracts changed. No GitHub issue was created. Files are
local and uncommitted; this session cannot write the repository's Git metadata.

## Observations

`node evidence/improve-trust-spike/decision-probe.cjs` executed directly and its
raw JSON is in `evidence/improve-trust-spike/decision-probe.json`. The decision
function returned KEEP for preservation-only evidence and REVERT for the two
controls (mandatory regression and empty diff). This is a function-level result,
not a full CLI reproduction. Q1/Q2 remain source-level concerns.

The three-phase scoped audit found no CRITICAL/P1 in the thin preparation packet.
That is a builder audit, not independent Duo acceptance or production readiness.

## Existing Duo run

Run ID: `1791224192444-3bbfc937`.
Owner host: Codex. Progress: 0/4 preparation criteria independently verified.
Run audit: `.specflow/duo/1791224192444-3bbfc937/audit.md`.
Batch: `.specflow/duo/1791224192444-3bbfc937/batch.json`.
Local specification/context: `.specflow/duo/improve-trust-preparation/`.
Local source uses number 0 solely for file-backed planning; it is not GitHub #0.

Observed blocks:

1. `duo-build check --builder codex`: `claude: spawnSync claude EPERM`.
2. Source status/capture/review: `git: spawnSync git EPERM`. The saved first
   review stopped in preflight; the independent peer was never invoked.
3. Publication helper: missing `.specflow/publication-policy.json`.
4. Full spike experiments: no configured approved experiment adapter and prior
   verification child-process permission failures. Do not invent isolation proof.

## Resume when the environment supports the required processes

Keep this run and its raw records; do not create a replacement to reset budgets.
In a new Codex conversation, claim it through the supported command:

```sh
node scripts/duo-build.cjs resume 1791224192444-3bbfc937 --builder codex --takeover --reason "Resume the user-requested improve trust spike review in a supported environment"
```

Use the returned owner-session token, check eligibility, and capture the probe on
the final source snapshot. Add that returned raw capture path to the existing
batch while retaining the earlier observation and any failed capture. Submit the
batch through `duo-build review`, respond to actionable peer findings, then use
`finish` only if all preparation criteria are independently verified. The helper
must perform its normal GitHub read-access checks; no origin removal or bypass.

GitHub publication remains pending through the configured scanner and
`scripts/specflow-publication.cjs`, using the saved publication request. Include
this handoff and review task in its linked-material scan. Do not replace the
missing scanner with a permissive stub. Research execution is a separate later
step under the spike's bounds and approved experiment policy.
