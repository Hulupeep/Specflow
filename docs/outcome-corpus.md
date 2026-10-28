# Composed outcome acceptance corpus

Run `npm test -- --runInBand tests/contracts/outcome-corpus.test.js` from this
checkout. `J-OUTCOME-CORPUS` runs the independently reviewed inventory in
`tests/fixtures/outcome-corpus-v1/cases.json` through both declared host payloads.
It exercises public installation and the target's actual installed Gate D in new
Node processes. It uses the existing native Jest adapter, oracle comparison,
parent contract and acceptance engine.

The 17 cases include synthetic leave-ledger values and a nonfinancial uppercase
CLI. Good and declared-optional controls must pass. Incorrect values, offsetting
record errors, wrong identity/unit/period/events, missing observations/references,
removed parent obligations, required skips, submitted forged receipts and changed
inputs/oracles must fail for their declared cause. A generic error or any nonzero
exit is insufficient. Fixed expected data was reviewed and committed before the
fixture producer; injected faults never read the oracle or `fixed_actual`.

This is synthetic harness evidence. It does not qualify customer software,
jurisdiction rules, native plugin loading or publication. Fixture dependencies
are pre-provisioned; only dependency fetching by `npm install` is shimmed. Native
Jest checks and the fixture's producer/persistence processes actually execute.
No provider, production service or database is called.

Each run writes a unique directory under `.specflow/corpus-results/`. CI uploads
it as `outcome-corpus-<tested SHA>` alongside the canonical test artifact. Each
case retains raw gate stdout/stderr, native receipts/reports, accepted contracts,
synthetic source/input/oracle files and `result.json`. `archival_map` identifies
original versus archived paths. Archives are evidence of that invocation; they
cannot be submitted as owning live stage handles in a different invocation.

The result records the fixture/journey/inventory/core hashes, observed source
commit and uncommitted status, installed package/gate identity, run path, test
kind, expected and actual findings, elapsed milliseconds and observed driver and
native checker invocation counts. Counts are not a census of installer
subprocesses or producer grandchildren. Monetary cost is unknown. Zero operator
interventions describes the automated fixture case, excluding dependency and
account provisioning or specification review.

Intentional negative native cases may fail or skip inside these fixtures. Their
outer corpus test passes only when the existing gate rejects them for the right
reason. Required outer corpus tests must all execute and pass; these counts must
not be added to overlapping canonical-suite totals.

For extracted-package qualification, set `SPECFLOW_TEST_PACKAGE_ROOT` to the
extracted core and `SPECFLOW_CORPUS_ARTIFACT_DIR` to a fresh evidence directory.
Run the same source journey against it with dependencies pre-provisioned. Bind
the tarball integrity, every shipped file hash, source test hashes and native
reports. A source-only run does not prove the packed artifact.
