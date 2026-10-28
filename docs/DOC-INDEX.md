# Specflow documentation

## Start with the question

| Need | Read |
|---|---|
| Understand the problem, product and trust limits | [README](../README.md) |
| Canonical internal direction and scope | [PRD v1.1](PRD.md) |
| Commercial positioning derived from that PRD | [Commercial narrative](PRD-COMMERCIAL.md) |
| Decide how much process the ask needs | [Work routing](should-i-use-specflow.md) |
| Install, update or diagnose a host | [Onboarding](onboarding.md), [getting started](getting-started.md) |
| Understand the contracted verifier lifecycle | [How it works](how-it-works.md) |
| Use runner and trace commands | [Reference](reference.md) |
| Prepare the next slice without bloating the backlog | [Progressive specification](../templates/SPECIFICATION.md) |
| Interpret advisory versus Duo review | [Advisory review](advisory-review.md), [Duo](duo-build.md) |
| Separate report lint from integrated acceptance | [Gate D](gate-d.md) |
| Inspect current native adapter limits | [Native plugin](native-plugin.md), [runtime closure](plugin-runtime.md) |
| Operate the existing Improve interface | [Improve service operations](ops/improve-service.md) |

## Contracts and evidence

[Contract schema](../CONTRACT-SCHEMA.md), [journey contracts](../USER-JOURNEY-CONTRACTS.md) and the [active contract index](contracts/CONTRACT_INDEX.yml) define the enforceable sources. [Synthetic outcome corpus](outcome-corpus.md) explains its scope and limits. [Canonical CI](../.github/workflows/canonical-tests.yml) preserves native reports and rejects required failures/skips; source tests are not customer proof.

[CHANGELOG](../CHANGELOG.md) records version history. [Release notes](RELEASES.md) retain earlier snapshots; current source, published installs and qualified released artifacts are separate claims.

## History and design records

The [historical archive](old-do-not-use/README.md) replaces the superseded pre-flight PRD, old repository status, foundations deck and simple walkthrough. They are not current execution guidance.

`docs/specs/`, `docs/plans/`, `docs/handoffs/` and `docs/ss/` retain scoped design/research and dated history. Read their dates and current issue/evidence status before treating a proposal as implemented. They cannot override current accepted contracts or manufacture readiness.

## Documentation reconciliation

[The #107 disposition record](docs-refresh-status.md) distinguishes refreshed active material from retained history. All live guidance is subordinate to the accepted current scope, owning verifier, privacy, authorization and release boundaries.
