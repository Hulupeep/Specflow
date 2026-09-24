# Progressive specification

Specflow records three planning depths: `spec:thin`, `spec:contracted` and
`spec:build-ready`. Depth is not implementation status. Begin with the outcome,
scope, behaviour acceptance, dependencies and unknowns. Choose the next useful
decision or slice before adding detail; future work stays thin.

All entry points use `scripts/specflow-tier.cjs`. Inspect the selected ticket's
record with `node scripts/specflow-tier.cjs inspect <record.json> <route> inspect`.
Use the exact route name: `specflow-loop-selector`, `spec-build`,
`specflow-simulate`, `specflow-audit`, `specflow-uplifter`, `specflow-writer`,
`pre-flight-simulator`, `board-auditor`, `waves-controller`, `sprint-executor`,
`feature-build`, or `duo-build`. Unknown names block.

The record contains the current issue snapshot, profile (`ui`, `materialSeams`,
applicable artifacts), dependencies, freshness and durable verification state.
Artifacts carry an ID, role, repository-relative path and SHA-256. Reuse current
contracts and checks; an inapplicable artifact needs a reason. Material seams
need relevant decision evidence. A contracted UI flow also needs a paper persona
walkthrough. A required executed UI journey remains a completion gate.

A thin inspection returns planning state and the next justified action. It does
not generate schemas, selectors, fixtures or full simulations. Contracted reviews
cover the directly relevant irreversible decisions. Build-ready checks cover the
selected slice, its direct seams and necessary shared decisions. The runner
records `run_contract.tier` and derives `simulation_required` from this policy.

Before production build/resume/finish, request that operation from the same
policy. A tier label alone is insufficient: the current scope, relevant evidence,
passed required gates and scoped review must match the promotion receipt. Missing
labels default to thin with a warning. Conflicting labels block. Explicit
experiments never grant production readiness or authorize shipping their code.

Privacy, permission, required test and release gates apply at every relevant
tier. A passing process with required skips is not acceptance. Keep implemented,
tested, merged, deployed and customer-validated claims separate. Owner exceptions
remain explicit exceptions; a model or CLI flag cannot authorize an override.

For legacy installations, reload the updated skills in both hosts and reconcile
custom instructions that force full specification on every ticket. Never silently
claim a legacy run passed the new policy. Missing promotion/discovery capabilities
are unavailable, not a reason to trust a label or an old pre-flight timestamp.

## Working procedure for the interactive builder

The user invokes `/duo-build <target>` in Claude Code or `$duo-build <target>`
in Codex. The builder performs the following steps inside that workflow; the
user does not copy review messages or run three separate workflows.

1. Import the selected issue with `node scripts/specflow-specification.cjs import
   OWNER/REPO NUMBER evidence/specification-NUMBER.json`. Re-import after an
   intervening issue edit, reconcile changes explicitly, and keep prior evidence.
   Import does not restore readiness. Local-file sources are supported for
   deterministic replays; label them as replays, not live GitHub promotion.
2. Keep the whole feature's goal and behaviour acceptance in their existing
   authoritative sources. Add only applicable profile entries to the selected
   record. Each artifact uses `{id, role, path, sha256}`; `reuse: true` and
   `shared: true` describe canonical existing material. New artifacts need a
   `justification`; N/A or deferred entries need a `reason`. `ui` is explicit,
   and each `materialSeams` entry names an `id` with a `decision:<id>` artifact.
   Build-ready also references acceptance-checks, simulation and preflight;
   the same existing file may supply multiple justified roles. These are
   scoped evidence roles, not a requirement for three new documents.
3. Inspect the frontier with `node scripts/specflow-specification.cjs frontier
   frontier.json`, where the file contains `{records:["record-A.json",
   "record-B.json"], selected:[123]}`. Dependencies declare `{issue, record,
   reason, evidence:[{path,sha256}]}`. A required implemented capability needs
   current raw execution, not a closed ticket. A shared decision can declare
   `kind:"shared-decision", requiresBuilt:false`; that cannot substitute for
   an implementation dependency. Preparing A never promotes B or C.
4. Declare applicable `profile.gates` as `{id,command:["executable","arg"]}`.
   Run each with `node scripts/specflow-specification.cjs gate RECORD GATE_ID`.
   The project gate emits JSON `{executed,skipped,failed}` (or Jest JSON).
   Exit zero alone is insufficient. These preparation checks validate the
   specification/check mapping; they do not require an unbuilt feature's
   acceptance test to pass before implementation. Required implementation
   journeys and release tests still run before claiming completion.
5. Request native Duo preparation review with `workKind:"preparation"` and
   `specification:{record:"RECORD",targetTier:"contracted"}` or `build-ready`.
   Index all scoped criteria and gates, submit the gate evidence paths and
   relevant source, then follow the regular capture/review procedure. Claude
   builders also bind `specification.reviewerModel` to their already approved
   Codex model; its explicit CLI selection is recorded separately from served
   model telemetry. No automatic model selection is introduced.
6. Fix evidenced findings and re-review within the initial-plus-one-repair
   allowance. Then run `node scripts/specflow-specification.cjs promote RECORD
   build-ready "why this slice is needed now"` (or `contracted`). Promotion
   checks the current source, dependencies, review and the same raw gates,
   records the transaction, and updates only this issue's depth label. It does
   not implement, merge or deploy the slice. Start implementation using that
   current record and the existing feature-build/Duo workflow.

Records under `.specflow/specification/` survive host/run changes. Keep that local
journal when moving worktrees; missing required journals block affected work.
An interrupted reserved peer call remains unfinished and consumes its allowance.
After verifying the process ended, record it with `review-failed RECORD TIER
"observed interruption and evidence location"`; this retains previous findings,
never resets the budget and never supplies acceptance. A lock whose process
status cannot be established stays blocked for explicit recovery.

## Learn before deepening

Use `node scripts/specflow-specification.cjs experiment RECORD PLAN.json` for a
thin learning experiment. The plan names `id`, `question`, `expectedObservation`,
`adapter`, `command` argv, `permissionEvidence`, `inputs`, `code` (hash references),
`timeoutMs`, `maxOutputBytes` and `limitations`. The project supplies an existing
approved sandbox in `.specflow/experiment-policy.json`: each named adapter has
an exact command, a `probeCommand` that emits `{success:true,sandboxReady:true}`,
permission references and maximum time/output. The probe must exercise the real
project isolation boundary. A fabricated green probe is not isolation. There is
no unsandboxed fallback and this helper does not build a general sandbox service.

Observed, failed, unavailable and budget-exhausted attempts retain raw results.
A result does not authorize experimental code for production. The same question,
input, code, permissions and bounds cannot be rerun automatically by renaming it.
Collect the preceding observation before a justified changed experiment. A blocked
input/sandbox attempt can retry the identical plan only after a fresh availability
check succeeds; repeated unavailable probes do not append experiment attempts.

## Discoveries at every meaningful work boundary

Duo captures, feature-build implementation adapters and experiments reserve a
batch before executing. Other diagnosis/build work uses `begin RECORD BATCH_ID`.
After success, failure, blocking or interruption, call `collect RECORD BATCH_ID
REPORT.json`. The report contains `outcome: success|failed|blocked|interrupted`
and `discoveries: []` for an explicit none, or observations with stable `id`,
`kind`, `observation`, `proposedEdit`, affected `tickets`/`references`, and hashed
`evidence`. Kinds are observation, hypothesis and confirmed-cause; a confirmed
cause additionally needs discriminating `causeEvidence`. Retain contradictions
and refinements as new observations, not rewrites of history.

Before the next production boundary, collect and reconcile the applicable list.
The status/frontier shows missing reports, stale affected work and pending remote
writes. Shared reference users become stale; unrelated siblings can proceed.
Use `publish RECORD PRODUCER_ISSUE DISCOVERY_ID` for a sanitized proposed-edit
comment. Supply a `publicSummary` (or the optional final `PUBLIC_FILE` argument) without private raw
values. Failed writes stay pending, retries recognize the same marker, and local
invalidation remains active when GitHub is unavailable. No ticket body is silently
replaced. A remote proposal without its required local journal blocks re-entry.

Use `reconcile RECORD PRODUCER_ISSUE DISCOVERY_ID RESOLUTION.json` with `kind`,
`reason` and hashed evidence. Acceptance also names the changed artifact in
`changedReference`; rejection requires demonstrated non-impact. Either result
remains ungraded until current gates and scoped review pass. Exhausted review
allowances require escalation, not a new run name.

## Size, privacy and exceptions

`volume RECORD` reports body size, linked maintained/historical content, reuse,
new/deferred artifacts and identifier preservation. `frontier` also aggregates
across tickets so copying or splitting prose cannot hide its volume. Bodies warn
above 20,000 characters and block above 30,000; 40-plus REQs trigger scope review.
Map remote specification links to hashed local artifacts using `sourceUrl`, or
report their volume unmeasured. Counts never establish semantic correctness.

All issue creation/comments and linked public material pass
`scripts/specflow-publication.cjs REQUEST.json` with `{repo,issue,bodyFile,
linkedFiles}` (creation instead uses `action:"create",title`). The project's
`.specflow/publication-policy.json` supplies `command` argv and an explicit
`privateBaselineRequired` boolean. The helper appends a local payload path. The
scanner must return `success:true`; private baselines also require a real planted
canary and checked derived forms. No scanner or failing check means no publication.
Never include credentials, private source values or raw provider records to prove
success. Journals and raw experiments remain local unless explicitly sanitized.

Scope exceptions and identifier changes require recorded owner authorization.
A CLI reason or an owner-token comment written by a model is insufficient.
The `exception RECORD COMMENT_ID SIGNATURE.json` command verifies the owner's
scope-bound GitHub comment and detached Ed25519 signature against the separately
provisioned owner public key in `.specflow/owner-authorization.json`. The private
key stays outside the agent workspace; agents must not generate approval for
themselves. Identifier decisions name the exact ID and the signed decision.
Exceptions remain `override:<who>:<reason>`, never passed, and cannot grant
missing capability, privacy or production acceptance.
