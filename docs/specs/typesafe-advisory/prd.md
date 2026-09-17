# PRD: Evidence-grounded advice for SpecFlow builds

Status: product requirements with local implementation in review, 17 September 2026. Tracked by [epic #138](https://github.com/Hulupeep/Specflow/issues/138). The adapter, configuration command and private evaluation tooling are implemented locally and covered by simulated-transport tests. Live integration proof, independent correction review, merge and release remain separate delivery requirements. This PRD explains the product rationale and proposes research-driven amendments; existing child tickets retain their acceptance criteria until those amendments are reconciled through simulation and audit.

## Why: what SpecFlow is

SpecFlow is a software-delivery methodology and local toolkit for working with coding agents. It connects a product goal to a specification, implementation tickets, executable checks and recorded evidence. Its purpose is to make “done” mean that the requested behaviour has been demonstrated, rather than that an agent has stopped writing code.

The toolkit provides workflows, agent instructions, YAML contracts, tests, hooks, verification gates and durable run records. Contracts express requirements that automated checks can enforce. Journey tests exercise the steps a customer takes and assert the result they should receive. A gate decides whether the required evidence permits the workflow to advance. These protections depend on the project installing, configuring and actually executing the relevant checks; SpecFlow does not make an incomplete test suite complete by itself.

The existing preparation workflow, `spec-build`, turns an idea or PRD into a hardened specification and implementation tickets. `feature-build` builds a prepared ticket and gathers its required verification evidence. `duo-build` provides a single interactive entry point that reuses those flows and asks a different coding model to review each meaningful batch. The user stays with their original agent instead of copying messages between tools.

This proposal adds a small TypeSafe advisory capability inside that workflow. It addresses the gap between having evidence and correctly interpreting what the evidence proves.

## Problem Statement

A developer asks an agent to deliver a feature. The agent writes code, runs checks and reports success. The developer still has to establish whether the checks covered the actual request, whether the displayed result is correct, and whether subsequent repairs remain focused on the original goal.

Several failures can produce a convincing but unsupported completion claim:

- A test passes because a balance is displayed, without asserting the balance's value.
- CI is green because a required journey was skipped or never included.
- A failed fixture or expired login is described as a product defect without evidence.
- A repair changes surrounding code but does not address the reviewed finding.
- Two agents repeatedly rephrase the same hypothesis without producing a new observation.
- Evidence from an earlier snapshot is used to justify the current code.

Mechanical checks can establish facts such as whether a command ran, a file exists, an assertion failed or a snapshot changed. Some relationships require interpretation: does this assertion cover that acceptance criterion, and does this observation support the claim being made? Today that interpretation largely depends on the builder and reviewer repeatedly reading unstructured material.

The problem is therefore **unsupported confidence in progress**, compounded by the effort required to challenge it consistently.

## Why this provides value

The intended benefit is a tighter connection between the goal, the implementation and the evidence used to accept it.

For the developer, this should mean fewer occasions where “finished” later turns out to mean “implemented but not demonstrated.” For the reviewer, explicit claim-to-evidence comparisons should make omissions easier to notice. For a returning user, durable records should explain what advanced, what remains blocked and what should happen next.

TypeSafe's contribution is narrow semantic advice. Its models answer bounded questions with structured choices and probabilities, which software can record and compare across rounds. The independent reviewer remains responsible for examining the actual sources and deciding whether a finding is justified. The existing gates retain their authority.

These are intended benefits, not established performance claims. The integration earns adoption only if evaluation shows useful additional detection at an acceptable false-alarm and workflow cost. Keeping TypeSafe disabled is a valid outcome if the ordinary duo workflow performs as well without it.

## Why choose this over the usual alternatives?

| Approach | What it does well | What this proposal adds | Trade-off |
|---|---|---|---|
| Give one coding agent better instructions | Fast setup; flexible implementation | Persisted acceptance, independent review and explicit evidence relationships survive beyond one conversation | More setup and review work |
| Run unit tests and CI | Repeatable checks of encoded behaviour | Semantic advice about whether those checks substantiate the requested customer outcome | Advice can be wrong; tests still need to be written and run |
| Manually ask another model to review | Independent reasoning and broad judgment | Automatic handoff of the same goal, snapshot, findings and raw evidence; no copy-and-paste loop | Both coding CLIs must be available and permitted |
| Use ordinary duo-build without TypeSafe | Automated independent review with durable evidence | Repeatable, typed advice about support, coverage and repair progress | An additional provider, latency, privacy boundary and false alarms |
| Ask a general-purpose model for another prose review | Handles complex reasoning and unexpected problems | A small, versioned question set produces comparable records for narrow checks | Jev cannot replace broad reasoning; superiority must be measured |

The strongest reason to choose SpecFlow is the delivery discipline around agents: explicit acceptance, executable verification, preserved evidence and bounded repair. The reason to add TypeSafe is more specific: it may make semantic evidence checks more consistent and useful. Low advertised inference prices alone are insufficient justification.

This is most useful for sustained agent work, consequential customer-visible behaviour and tasks with several acceptance criteria. A small edit already covered by a direct test may gain little from another semantic check.

## Solution

Add an optional TypeSafe adapter to duo-build. The builder and reviewer continue to read the same goal and authoritative acceptance criteria. At a batch boundary, ordinary code selects a bounded set of claims, assertions and evidence from the frozen review snapshot. TypeSafe answers narrow questions about that material.

The initial questions are:

1. Does the selected evidence support, contradict or fail to establish the claim?
2. Does the assertion cover the acceptance criterion fully, partially or not at all, or is the evidence insufficient?
3. Does a proposed repair resolve a finding, advance a criterion, provide a necessary prerequisite, or fall outside the scoped objective?
4. Does the latest round add a new observation, repeat an earlier one or contradict it?
5. Is a statement an observation, a hypothesis or an evidenced cause?

The last three questions follow the initial evidence and coverage evaluation; they are not prerequisites for trying the first prototype. Each answer remains an advisory judgment, with its inputs and uncertainty available for inspection.

### How the user uses it

After installing SpecFlow's native skills and authenticating both coding CLIs, the user starts in their preferred agent:

| Action | Claude Code | Codex |
|---|---|---|
| Build a prepared story | `/duo-build #905` | `$duo-build #905` |
| Prepare and build a feature | `/duo-build "Explain an employee's leave balance"` | `$duo-build "Explain an employee's leave balance"` |
| Resume a recorded run | `/duo-build resume <run-id>` | `$duo-build resume <run-id>` |

These are the repository's documented native entry points. The local implementation exposes owner-controlled TypeSafe configuration through `node scripts/duo-build.cjs typesafe RUN_ID --session OWNER_SESSION --config CONFIG.json --reason REASON`; native agent skills invoke this helper for the user. Cross-host takeover builds on published prerequisite commit `b502c8d` for #135–137; publication of that branch is distinct from merging it into main.

The operator explicitly configures TypeSafe credentials and the selected mode. Configuration documents `TYPESAFE_API_KEY` and compatibility with this project's existing `TYPESAFE_API`; an environment file is loaded only when explicitly selected. Credentials are never part of review evidence.

- **Off:** no TypeSafe calls.
- **Shadow:** once explicitly configured, collect advice for evaluation without putting it in the peer's prompt or changing workflow decisions. This is the initial enabled mode.
- **Advisory:** after an explicit operator decision, show the same advice to the builder and reviewer. The reviewer records whether each flag is confirmed, rejected or needs more evidence.

The user does not converse with TypeSafe or relay its answers. It is a bounded API call within the existing workflow, not a third coding agent.

### What happens after the instruction

1. SpecFlow loads the goal, repository instructions, scoped objective, finish condition and task acceptance. A feature request uses existing preparation; a ready issue proceeds to implementation.
2. The interactive agent builds a coherent batch and gathers raw verification results.
3. The workflow freezes the review snapshot, including uncommitted changes, and pauses edits to those reviewed bytes.
4. Deterministic checks validate evidence presence and freshness. The adapter sends only selected, permitted material to TypeSafe, batching independent questions over the same state.
5. The other coding CLI independently reviews the goal, changes and raw evidence. Claude Code builders use `codex exec`; Codex builders use `claude -p`. The peer is read-only and cannot launch another reviewer.
6. The peer returns accepted within scope, changes required or blocked. Actionable blockers identify an acceptance criterion, required gate or concrete material risk.
7. The builder repairs the work and requests a fresh review. Prior findings and resolution evidence remain attached to the run. The default limit is three repair rounds per batch; repeated rounds without new evidence or progress stop with a specific blocker.
8. The user receives one status: **Outcome advanced / Current blocker / Next action**, with the run identifier. Tested, peer-accepted, merged, deployed and customer-validated remain distinct states.

If TypeSafe is unavailable, ordinary peer review continues and the advice is marked unavailable. If the required peer CLI is unavailable, duo verification is blocked. Neither failure produces an invented pass.

### Example: explaining a leave balance

Suppose a synthetic test employee should see 18 days remaining, with an explanation linking opening entitlement, accrual, leave taken and adjustments. The builder presents a page showing 20 days and reports that the balance journey passes. The test only checks that the words “leave balance” appear.

The mechanical gate can establish that the test ran. The proposed coverage check can flag that the assertion does not establish the required value. The independent reviewer inspects the fixture, applicable rules, calculation evidence and rendered result before confirming the defect. The builder corrects the implementation or fixture as the evidence requires, adds the missing value assertion, runs the journey and requests review of the updated snapshot.

TypeSafe does not calculate the entitlement or determine the applicable law. TimeBreez's ambition remains accurate, explainable leave entitlements across arrangements and jurisdictions, traced to rules, employee facts, calculations and transactions. This integration adds no jurisdiction support and cannot fill unknown employee facts by inference. The example describes intended behaviour, not an executed integration test.

## User Stories

1. As a developer, I want one entry point for preparation, building and review, so that I do not coordinate agents manually.
2. As a Claude Code user, I want Codex to review my agent's work automatically, so that I retain my interactive session.
3. As a Codex user, I want Claude to perform the equivalent review, so that the workflow does not depend on my starting CLI.
4. As a product owner, I want the goal and acceptance preserved, so that agents cannot quietly redefine success.
5. As a builder, I want missing or contradictory evidence identified, so that I can make an accurate completion claim.
6. As a reviewer, I want the raw evidence and exact snapshot, so that I can challenge both the builder and TypeSafe.
7. As a user, I want prominent customer-visible values verified, so that a passing presence check cannot stand in for correctness.
8. As a builder, I want fixture and authentication failures distinguished from product causes, so that repairs address evidenced problems.
9. As a returning user, I want preserved findings and run state, so that interruption does not erase progress or reset repair limits.
10. As an operator, I want off, shadow and advisory modes, so that adoption is reversible and measurable.
11. As an operator, I want explicit provider and peer failures, so that I understand what has and has not been verified.
12. As a repository owner, I want selected and minimized inputs, so that credentials and unnecessary sensitive material are not transmitted.
13. As a maintainer, I want versioned evaluations and model qualification, so that an upgrade cannot silently invalidate a threshold.
14. As a developer, I want unrelated improvements recorded separately, so that review does not expand the task indefinitely.
15. As a product owner, I want deployment and customer validation reported separately, so that local success is not overstated.

## Implementation Decisions

- Extend the existing local Node workflow with a small replaceable adapter. No shared orchestration service or cross-product gateway is required. Keep domain decisions outside provider-specific transport code.
- Retain the planned native HTTP client after the existing JavaScript SDK comparison. The SDK is a valid alternative, including configurable retries; the current choice limits dependencies and supports explicit bounds and durable single-attempt records. No Python SDK is required.
- Use deterministic code for existence, hashes, counts, arithmetic and freshness. Use TypeSafe only for bounded semantic relationships. Independent questions sharing state go in one request; dependent questions require separately recorded calls.
- Record run, batch, round, snapshot, input and question-set identities, requested and reported model, result, uncertainty, usage, timing and reviewer disposition. Persist interrupted attempts explicitly. Advice records cannot change the product snapshot or feed recursively into their own inputs.
- Retain existing timeout and byte limits. Provider documentation gives inconsistent context-budget descriptions; use conservative bounds, explicit limit failures and implementation-time verification rather than guessed byte-to-token conversions.
- Pin evaluation models. A model or question-set change requires replay against the labelled corpus and a recorded promotion decision. Historical alias responses are not current verification.
- Add a finite per-run provider budget and suppression of repeated failed calls, preserved on resume. The amended tickets set 20 calls by default, an owner-configurable limit of 1–100, and suppression after two consecutive failures; recovery clears the failure streak only. Suppression disables advice, never mandatory peer review.
- Send only explicitly selected, permitted evidence. Exclude environment files, credentials, raw production logs and arbitrary repository dumps. Reject or minimize sensitive material before transmission; record omissions as missing evidence. Local raw test evidence remains available to the peer under existing permissions.
- Separate private evaluation outputs from publishable source and fixtures. TypeSafe's published agreement restricts benchmark/performance publication; confirm applicable permission before publishing such results.
- Reuse existing goal documents, contracts, release gates and ownership controls. Executable contract definitions remain in YAML, with their enforcement tests; this PRD is not a replacement contract.

## Testing Decisions

The primary acceptance boundary is the installed duo-build CLI workflow. Test observable outcomes: correct handoff, preservation of acceptance, fresh evidence, reviewer disposition, failure status, bounded repairs and successful resume. Focused transport and evaluation tests support that boundary. Existing duo helper tests and contract tests provide the starting test seams.

The required demonstration is a real build → review → correction → re-review cycle with an independently evidenced initial failure. Exercise both invocation directions, missing evidence, stale snapshots, provider failure, missing peer authentication, interruption and recursive-review prevention. Label simulated transports, recorded replays and live provider executions separately. An unexecuted journey is not delivery evidence.

The initial evidence/coverage corpus retains the child ticket's minimum of 50 labelled cases: 30 development and 20 held-out, with related case families kept in one split. Repair evaluation retains at least 20 cases, including 10 held-out. Labels need evidence and adjudication; agreement between models is not ground truth.

Extend the corpus with negation, irrelevant-context flooding, conflicting criteria, similar labels, unfamiliar inputs and repeated-run checks. Report per-class errors, unsupported-claim recall, false alarms, insufficient-evidence rates, denominators, latency, actual calls and usage. Assess probability calibration separately from error rates at confidence thresholds: TypeSafe's `confidence` summarizes distribution concentration, not the probability that the whole workflow is correct. Small samples cannot establish production reliability.

Compare against deterministic checks and the existing peer workflow. In shadow mode, assess additional useful findings without influencing the peer. In advisory trials, also measure review burden and repair progress. Claims of improvement must state the sample, comparison and limitations; there is no promised speedup, savings target or universal confidence threshold.

## Success and release criteria

Delivery succeeds when both host directions execute the complete scoped workflow, required tests and gates pass, raw evidence is available, and the user receives accurate status without manual message copying. TypeSafe failure must not stop ordinary review; peer failure must stop duo acceptance.

Product adoption is a separate decision. A maintainer must review measured incremental detection, false alarms and workflow overhead before promoting advisory defaults. Model and question versions accompany that decision. The first release may remain shadow-only if the evidence does not justify broader use.

Required peer reviews are never skipped to improve a savings metric. Measure evidence quality, unresolved claims, review effort and repair progress instead of claiming fewer mandatory reviewer calls.

## Out of Scope

- Replacing independent Claude/Codex review, deterministic tests or human release authority.
- Automatic approval, merge, deployment, contract overrides or changes to acceptance.
- A third conversational agent, hosted orchestration service or shared multi-product gateway.
- General story generation, broad verifier routing, context reranking or model training.
- Production integrations into HeyStax, HubDuck or TimeBreez; entitlement or employment decisions by TypeSafe.
- New UI, public benchmark publication without applicable permission, or claims that a single smoke test establishes reliability.

## Further Notes

Delivery order remains [#139 client](https://github.com/Hulupeep/Specflow/issues/139), [#140 evaluation](https://github.com/Hulupeep/Specflow/issues/140), [#141 duo integration](https://github.com/Hulupeep/Specflow/issues/141), then [#142 repair advice](https://github.com/Hulupeep/Specflow/issues/142). Integration must first establish the published, identifiable baseline for #135–137; local reviewed changes are not evidence of a released dependency.

The research review proposes amendments for private evaluation reports, expanded robustness/calibration tests, upgrade qualification and provider budgets. These amendments have been reconciled into the affected tickets and their specification simulation/audit repeated. Local implementation and simulated tests exist; live proof and release status remain separately tracked on the epic.

Evidence supporting the design includes the repository's [SpecFlow overview](../../../README.md), [duo-build usage](../../duo-build.md), reviewed local research (`typesafe.md`), and the existing epic/child tickets. Official TypeSafe references are [claim-to-source checking](https://docs.typesafe.ai/cookbooks/citation_check), [question batching](https://docs.typesafe.ai/primitives), [confidence](https://docs.typesafe.ai/confidence), [model versions](https://docs.typesafe.ai/models), [model limitations](https://docs.typesafe.ai/model-jaggedness/jev-1.13) and [publication restrictions, §2.3(f)](https://typesafe.ai/legal/mca). Vendor examples demonstrate patterns, not measured SpecFlow benefits.

## Simulation Findings (proposed)

Design walkthrough only; no product tests were executed. Four behavioural personas exercise distinct routes:

| Persona and reason | Happy route | Divergent route and proposed ticket addition |
|---|---|---|
| First-time Claude user: onboarding | Configures credentials, starts an issue, receives peer review | No TypeSafe credentials: show advice unavailable; do not silently load an environment file. Add an explicit onboarding/failure acceptance case to #141. |
| Returning operator: continuity | Resumes the same goal and pending finding | Provider budget exhausted before interruption: resume must not reset it. Add persistent-budget and explicit recovery acceptance cases to #139/#141. |
| Skeptical reviewer: independence | Confirms an evidence mismatch by inspecting the source | TypeSafe confidently flags a correct result: rejection with evidence leaves acceptance unchanged. Retain this negative case in #141 and measure false alarms in #140. |
| Evaluation maintainer: safe publication | Runs the held-out corpus and reviews results privately | Prepares a public PR containing provider metrics: separate private output destinations from publishable artifacts and check applicable publication permission. Amend #140's publication acceptance criterion. |

Resolved in the amended tickets: provider limits/recovery, private report destination and operator-controlled deletion. Measured promotion thresholds remain an explicit maintainer decision after evaluation; initial rollout stays shadow. No new compliance or implementation-complete verdict is asserted by this PRD.
