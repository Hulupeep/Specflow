# Specflow reference

[Product and install](../README.md) · [Onboarding](onboarding.md) · [Lifecycle](how-it-works.md)

The examples below use the current source checkout. Installed release capabilities and retained runtime pins must be checked separately.

## Setup and diagnostics

```sh
node /absolute/path/to/specflow-kit/bin/specflow.js init /absolute/path/to/project --runtime codex
node /absolute/path/to/specflow-kit/bin/specflow.js update /absolute/path/to/project --runtime claude-code
node /absolute/path/to/specflow-kit/bin/specflow.js doctor /absolute/path/to/project
```

Choose the actual host, not a directory-name guess. Read [onboarding](onboarding.md) before changing an existing installation or active run.

## Contracted runner

Run from the target project, with its accepted inputs and installed policy:

```sh
node /absolute/path/to/specflow-kit/bin/specflow.js run spec-build \
  --slug example --goal "Select the next useful slice" --input docs/intent.md
node /absolute/path/to/specflow-kit/bin/specflow.js run feature-build \
  --slug selected-slice --contract .specflow/runs/selected-slice/run-contract.yaml
node /absolute/path/to/specflow-kit/bin/specflow.js run status \
  --contract .specflow/runs/selected-slice/run-contract.yaml
node /absolute/path/to/specflow-kit/bin/specflow.js run trace \
  --run-dir .specflow/runs/selected-slice
```

Feature-build requires the current bound readiness record, relevant contracts and required evidence; these snippets do not create them. The [specification working procedure](../templates/SPECIFICATION.md) owns import, frontier, applicable gates, independent review and promotion. Missing readiness blocks; do not fill a YAML label to bypass it.

## Core artifacts

| Artifact | Role |
|---|---|
| `run-contract.yaml` | Current loop, scope, rails, evidence paths and boundaries |
| `ledger.jsonl` | Attempts, evidence, divergence and gate events |
| `.specflow/STATE.md` | Re-entry context; not an approval authority |
| Verification contract and owning receipts | Accepted checks, independent expected references and current execution |
| Findings and trace | Unresolved concerns and the difference between maker claim and gate result |

A stored result cannot recreate an owning verifier handle. Correctness, provenance, consistency, review status and integrated outcome stay separate. See [Gate D](gate-d.md), [the comparison schema](../CONTRACT-SCHEMA.md#independent-value-comparisons-70) and [synthetic corpus scope](outcome-corpus.md).

## Test commands in this repository

```sh
node node_modules/jest/bin/jest.js --no-coverage --maxWorkers=2 --roots tests
npm run test:contracts
npm run test:hooks
npm run test:schema
npm run test:compile
```

Report actual commands, revision, environment, executed, failed and skipped cases. A required skip, stale simulation, failed comparison or missing backend cannot become a pass. Exceptions remain explicitly recorded exceptions.

## Agent instructions

[Loop selector](../skills/specflow-loop-selector/SKILL.md) chooses the work weight. [Audit](../skills/specflow-audit/SKILL.md) preserves the three uplift phases and current loop boundary. [Duo](duo-build.md) documents cross-family review and recovery. Native plugin namespaces and qualified limits are in [native plugin documentation](native-plugin.md); do not assume source adapters imply a published marketplace install.
