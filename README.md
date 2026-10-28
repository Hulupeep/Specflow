# Specflow

**Capability does not create authority.** Specflow is a trust harness for coding agents: agents produce changes; declared contracts, independent verification and mechanical gates decide whether the evidence supports acceptance.

## The problem

An agent can build a plausible interface, pass tests over substituted data and call the feature complete. A stronger model can produce more work without making that completion claim reliable. Reviewers need to see what actually ran, against which inputs, and what remains unresolved.

## The product

Specflow carries a selected change from intent to evidence. It keeps the accepted scope, required checks, findings and run history outside the builder's conversation. The builder can be replaced without treating its confidence or remembered summary as proof.

Use the lightest workflow that covers the risk. A copy tweak may need tests and a screenshot; a bounded bug needs a failing regression and relevant contracts. New behavior needs simulation of divergent routes. Database/RPC changes require their replay, rollback, pgTAP and migration-replay checks. Multi-slice work also needs integrated journey acceptance. [Work routing](docs/should-i-use-specflow.md) chooses the parts; it does not waive existing requirements.

| Part | Purpose |
|---|---|
| Contracts and journeys | Define observable acceptance and preserve existing behavior |
| `spec-build` | Strengthen intent and deepen only the next justified slice |
| `feature-build` | Implement a ready slice while preserving its required checks |
| Independent verifier | Exercise the built behavior and compare it with the accepted reference |
| Gates C and D | Consume current slice and integrated outcome evidence |
| Run contract, ledger and trace | Explain decisions, attempts, failures, exceptions and gaps |

A review model is not the mechanical verifier. Fresh same-host advisory review, explicit cross-family Duo review, native execution and customer validation are different claims.

## Install and use

These examples use a checked-out source kit. Source capability and a published npm or marketplace release have separate qualification; do not infer the installed version's behavior from current main.

```sh
git clone https://github.com/Hulupeep/Specflow.git specflow-kit
node specflow-kit/bin/specflow.js init /absolute/path/to/your-project --runtime codex
# Or select --runtime claude-code
```

Fill only missing project context: repository, board/CLI, stack and selected work. Open a new agent session to load the installed instructions. [Onboarding](docs/onboarding.md) covers host selection, diagnostics, retained runs and updates. Installation checks do not establish product readiness.

Give the agent a target and let the installed loop selector assess its risk and existing evidence. Formal specification work follows the [progressive specification procedure](templates/SPECIFICATION.md): future work stays thin; only the selected slice becomes build-ready. A label or an old passing audit is insufficient.

For explicit independent Duo review, authenticate both provider CLIs and `gh` where GitHub reads are needed. In the agent conversation:

| Host | Start | Resume |
|---|---|---|
| Claude Code | `/duo-build #123` | `/duo-build resume <run-id>` |
| Codex | `$duo-build #123` | `$duo-build resume <run-id>` |

The interactive builder continues authorized repairs and asks the peer to inspect frozen artifacts. Ordinary subscription work has no invented repair count or dollar ceiling; repeated non-progress requires diagnosis. Explicit limits and expensive billable-route brakes remain. [Duo details](docs/duo-build.md) explain ownership, evidence and recovery. TypeSafe is optional advice, not an approval path.

For direct runner use, start in the target project with its installed routing and accepted inputs:

```sh
node /absolute/path/to/specflow-kit/bin/specflow.js run spec-build \
  --slug example --goal "Select the next useful slice" --input docs/intent.md
node /absolute/path/to/specflow-kit/bin/specflow.js run trace \
  --run-dir .specflow/runs/example
```

These commands inspect or advance the declared run; they do not manufacture acceptance, required backend access or permission. [How it works](docs/how-it-works.md) and the [command reference](docs/reference.md) explain the verifier lifecycle.

## Trust boundaries and limits

- Provider prose, confidence and exit codes cannot become gate verdicts. The owning verifier executes current checks; stale, copied or skipped required evidence cannot pass.
- Correctness compares actual output with an independently accepted expectation. Provenance and consumer consistency are separate facts; agreement between consumers does not establish correctness.
- UI journeys must execute their ordered steps and assertions. Required server-state journeys use the actual auth/API/persistence path on a real seeded test or staging backend. Screenshots and mock-only success do not replace it.
- A compliant ticket, advisory review, Duo agreement, installation check or report lint does not prove an integrated outcome. [Gate D](docs/gate-d.md) keeps report validity and outcome acceptance separate.
- Existing permission, privacy and release boundaries remain authoritative. A model cannot grant itself push, merge, deployment or an exception. Exceptions remain recorded exceptions; they do not turn missing required proof into a pass.
- Runs retain ownership, findings and explicit limits across interruptions and host changes. Missing capability has a concrete limitation and next action; it is not silently treated as success.

These controls cover supported scoped execution paths; they are not a general OS sandbox for arbitrary programs. See the documented adapter/native limits. They are boundaries around declared evidence, not a guarantee against every bug. A weak oracle or incomplete acceptance can still miss the user's problem. Tested, merged, published, deployed and customer-validated are separate states.

## Direction and current scope

The goal is useful, explainable intent-to-evidence development with replaceable research, build and review roles. HeyStax is the intended operational control plane. Repo-local Improve code, controller interfaces and qualified source adapters exist; real-product benefit, final released installs and unattended end-to-end operation each need their own evidence. No recurring schedule is activated by this documentation.

The intended commercial wedge is an evidence packet an agency or product team can review with a client: accepted scope, current checks, actual outcomes, unresolved findings and authorization. Customer acquisition and measurable benefit are not established by producing more tickets or green checks.

Read the [internal PRD](docs/PRD.md), [commercial narrative](docs/PRD-COMMERCIAL.md), [documentation index](docs/DOC-INDEX.md), [native plugin scope](docs/native-plugin.md) and [Improve operations](docs/ops/improve-service.md).

## Repository checks

```sh
npm ci --ignore-scripts
node node_modules/jest/bin/jest.js --no-coverage --maxWorkers=2 --roots tests
```

[Canonical CI](.github/workflows/canonical-tests.yml) reconciles the native report and rejects missing, failed or skipped checks. Its synthetic outcome corpus tests the declared failure cases; it is not customer or production-backend proof.
