# Status: SPIKE-IMPROVE-TRUST (#194)

On 2026-10-09, the existing Duo run `1791224192444-3bbfc937` completed its
preparation goal. Codex built the packet; Claude CLI 2.1.285 independently
accepted PREP-1 through PREP-4 in round 3, with no findings or outstanding
instructions. Round 2 was protocol-rejected for missing one required source read;
no acceptance was claimed from it. The run history and pinned runtime were retained.

The reviewed spike, simulation and audit files are preserved byte-for-byte.
Their environment notes describe the earlier restricted session. Subprocess
launch and the configured mechanical publication scanner are now available.
This dated status supersedes availability statements, not acceptance criteria.

The preparation review is complete; full research is not. Q1/Q2 still require an
approved disposable experiment adapter and real isolation proof. Q3 is a real
function-level observation with constructed inputs, not a whole-CLI reproduction.
No production fix, live backend validation or completed #171 claim is made.

Evidence: `evidence/improve-trust-spike/duo-review-summary.json` and
`decision-probe-capture.json`. Original run-local paths in the summary identify
reviewed artifacts; the public capture is a byte-identical copy. Raw provider
transcripts remain private. The capture's source fingerprint describes the
reviewed checkout, not this subsequent publication commit.

Next: investigate tested-code/contract binding, then gain semantics. Keep repeat
loops, instruction learning and resumable orchestration deferred until trust
semantics and their execution evidence are established.

## Research update — 2026-10-09, 19:03 UTC

[RESULTS.md](RESULTS.md) now supersedes the preceding research availability notes.
All Q1–Q3 defects reproduced through isolated lifecycle fixtures, with ten distinct
scenarios and one retained setup failure/retry. Regression and unchanged controls
ran. Raw receipts and historical harness versions are in
`evidence/improve-trust-spike/research/`; production code remains unchanged.
The new result review is separate from the completed preparation run. Its outcome
will be recorded in the GitHub completion comment; this status does not preclaim it.
