# #182 selected decision-memory preparation

Source: live #182 body and comments, preserved in story.md. New behaviour with
persistent/authenticated state: simulate, surgical audit, scoped native preparation,
then feature-build with contract/process tests and independent final acceptance.
Reuse #171 core, #181 controller and #216/#217 authority/worker boundaries. Future
recovery, API/MCP, publisher and HeyStax transport work stay thin. No SQL/RPC or
graphical UI is added; no invented database migration or browser selector.

Selected milestone: durable decision memory actually consulted by candidate
selection, not storage alone. Original AC-10-1..5 and MEMORY-01..10 remain. A
minimum milestone cannot close #182 until its two-cycle direction-change proof
exists. No current runtime result or compliance follows from this document.

## Simulation Findings (proposed)

Three independent read-only persona agents simulated the imported story before
this uplift. These are paper routes, not provider or backend execution.

- Authority/replacement: owner inspects KEEP and rejects the idea; an authorised
  successor reads its safe decision pack. Divergences: forged approval prose,
  revoked execute grant, another principal's private run, conflicting resolutions.
  Gaps: explicit trusted owner decision command; shared repo projection separate
  from caller-private run history; current authority and atomic decision/release.
- Interrupted operator: terminal outcome then lost acknowledgement, restart and
  next choice. Divergences: concurrent writes, corrupted archive, changed main,
  stale pack and delayed closed-PR observation. Gaps: outcome/memory one transaction;
  durable request identity, immutable revisions and safe projection with no holdout.
- Learning/research role: valid negative evidence changes next choice. Divergences:
  renamed/paraphrased failed idea, irrelevant README change, invalid fixture called
  disproof, A/B/A oscillation and capacity eviction. Gaps: stable structural family,
  relevant new evidence, separate code/experiment verdicts, retained contradictions
  and suppression history. Two writes alone cannot satisfy changed selection.

Accepted additions for the selected slice under standing implementation authority:
- REQ-MEMORY-11 / AC-MEMORY-11: Verified terminal outcome and its memory receipt
  share the controller transaction. Lost acknowledgement/retry returns one outcome;
  missing or corrupt evidence never frees suppression or manufactures knowledge.
- REQ-MEMORY-12 / AC-MEMORY-12: Memory commands have stable request IDs, input
  digests and expected pack revision. Identical retry returns the committed receipt;
  changed inputs conflict and concurrent conflicting resolutions have one winner.
- REQ-MEMORY-13 / AC-MEMORY-13: Consumption binds pack revision, canonical repo,
  registered profile and actual authorised baseline. Stale pack, unrelated baseline
  edits, renamed observations and closed/unknown proposals cannot silently unlock
  another equivalent attempt. Retain contradictions and stale observations.

## Audit phase 1 — gap analysis

Present: outcome, scope/non-goals, original and supplemental acceptance, prior
simulation/audit, dependencies, planned tests and trust invariants. Missing for
the selected slice: exact family/evidence schema, safe shared projection, owner
resolution ordering, selection consumption seam and executable negative mappings.
The decisions below address those missing sections, not rewrite the source story.

## Audit phase 2 — surgical decisions

1. Reuse ControllerStore's owner-private fsync/rename/lock transaction and existing
   registry-before-controller lock ordering. Store versioned memory events in its
   retained history with a dedicated hash chain. Validate the chain before use;
   append new records, never rewrite old outcomes. Capacity fails closed rather
   than evicting unresolved families. No second store, scheduler or learning engine.
2. New memory-enabled host configuration requires selection binding before a cycle
   or candidate stage. Legacy controller runs remain explicitly legacy, without
   fabricated past memory. The flag is host-owned, bound at admission and cannot
   be selected by request/repository text or changed on a resumed run. The same
   controller performs all original protected starts and terminal verification.
3. Obtain principal and actor/assignment provenance from trusted host callbacks;
   request schemas reject claimed principal, owner status and executable commands.
   Every mutation rechecks current registered execute authority. Only configured
   owner identity resolves an owner decision. Existing standing authority may
   drive that host path; model prose or a GitHub author name cannot impersonate it.
4. Decision-pack read authenticates current repo read authority, then returns a
   bounded curated repo projection across authorised predecessor outcomes. It does
   not invoke caller-private run history for another principal. Original authorship
   stays intact. Replacement reads memory without taking over active operations;
   that transfer and uncertain-operation recovery belong to #183.
5. Family identity is conservative and structural: canonical repo + sorted affected
   paths + normalised observable/measurement identity. Title, hypothesis wording,
   run/task ID, holder, baseline, contract revision and time are not family identity.
   Paraphrase fixtures preserve this descriptor. This is not a universal semantic
   similarity classifier; uncertain collisions stay blocked pending authenticated
   resolution. A/B/A on the same observable stays in the same family. Explicit
   owner alias decisions preserve their provenance rather than dropping history.
6. Observation context separately captures actual registered base ref/commit,
   profile revision, fixed criteria/contract digest, task/experiment identity and
   source revision. New selection validates the registered ref against real Git.
   An unmerged retained branch is never inferred to be main. A verified accepted
   retained change becomes a subsequent job's baseline only after an explicit
   authorised source-control/profile transition; earlier frozen runs stay unchanged.
   Unsupported within-run retained chaining remains denied, not implied by KEEP.
7. Selection consumes the exact current pack and persists selected family,
   alternatives, rejected choices, rationale and cited prior observations before
   critique/freeze. A repeated failed/inconclusive/rejected/pending family is denied
   unless a scoped retry has a material reason and independently sourced new
   relevant evidence. Different bytes from an unrelated file, a new baseline,
   renamed note or revised hypothesis wording are insufficient. Persist denial
   and its cause. Opportunities remain visible proposals, not automatically queued.
8. Core selection binding is checked against the same candidate document digest
   and core run/base before its recordCandidates/critique stage starts. Curated
   memory is fenced as advisory untrusted data for scout/peer; it cannot edit checks,
   routing, permissions or acceptance. Evaluator/holdout inputs never receive it.
   Legacy single-cycle core use is not retrospectively claimed memory-enabled.
9. Terminal observations derive code decision, original baseline and evidence
   identity from verifyTerminalArchive, never a caller-supplied KEEP. That receipt
   is appended atomically with completeCycle. Preserve exact code decision and
   diagnoses. Missing/corrupt archive remains unavailable, with suppression intact.
10. Experiment verdict is a distinct authenticated observation: proven/disproven/
    needs-change, with verification validity and failure category. Default
    unavailable/invalid/implementation-failed cases to needs-change. Proven or
    disproven requires fixed experiment revision and independent evidence of that
    hypothesis; KEEP does not prove demand/revenue and REVERT does not disprove it.
11. Explicit owner resolutions distinguish reject_idea, retry_with_new_evidence,
    accept_baseline and lifecycle observations. Bind exact outcome/pack revision,
    source revision and evidence. Decision append and safe pending-review release
    are atomic. No active/unknown operation, unverified baseline or PR-close event
    can release ownership. Reject means suppress that family; retry is scoped to
    cited new relevant evidence, not a blanket reset. Original counters persist.
12. Unknown/closed-unmerged/missing proposal observations are retained as observations
    and do not resolve owner intent. Current projection is derived from authenticated
    resolution order, not last-write-wins lifecycle text. Store local decisions now;
    #219 later supplies qualified external lifecycle observations through this seam.

### Versioned logical interfaces (to implement)

Exact command fields and trusted callbacks are in interface.d.ts. Every command
uses the authenticated controller context. MemoryHost is owner-host configuration,
not request data; it is mandatory for new memory-enabled jobs. Its evidence
resolver checks immutable captured records or the authenticated existing archive
by opaque ID/digest. It returns stored provenance, repo/family/source, scope and
execution validity; callers cannot claim those fields. Never resolve a caller
filesystem path. Missing/changed/unavailable evidence is a typed limitation.
Same-UID owner-host code remains trusted, as in the existing profile/controller
boundary; a supplied resolver double is test mechanics, not production proof.
Qualification must exercise the actual resolver and captured observation/archive.

Bounds: at most 12 criteria, 32 candidates, 32 evidence references per command;
text fields at most 2,000 characters; complete selection at most 256 KiB. Reject
unknown command fields, invalid/duplicate IDs, unsafe relative affected paths and
non-SHA256 digests. Pack exports at most the most recent 128 safe events and
reports truncation; suppression checks always scan all preserved events. Existing
16 MiB controller/50,000-history bounds fail closed without eviction. The family
observable is lowercased, Unicode-NFKC normalised and stripped of separators;
affected paths are sorted/deduplicated canonical repo-relative paths. Explicit
alias resolution binds conservative renamed structured descriptors if required.

```typescript
interface FamilyDescriptor { affected_paths: string[]; observable: string }
interface EvidenceReference {
  id: string; sha256: string; source_revision: string;
  affected_paths: string[]; producer_role: string;
}
interface DecisionPack {
  version: 1; repo_id: string; revision: string;
  intent: string; fixed_criteria: { id: string; statement: string }[];
  selections: unknown[]; outcomes: unknown[]; opportunities: unknown[];
  resolutions: unknown[]; limitations: string[];
}
// Trusted host supplies principal/holder/assignment; never caller fields.
// All command writes use request_id + expected_revision, return immutable receipt.
// Exact runtime JSON validators reject unknown fields and enforce bounded sizes.
```

Reuse existing core/profile/controller/worker invariants unchanged. New YAML
source: feature_improve_memory.yml, I-MEMORY-001..006. Data paths and metadata
are owner-private; exported packs contain safe IDs/digests, no raw holdout,
provider output, credentials, unrestricted filesystem paths or executable config.

### Kill check

Reject the design if it is only a notebook; if renaming an idea unlocks it; if
closing a PR or model approval releases pending ownership; if a new actor reads
private run history; if an invalid fixture becomes disproof; or if memory reaches
the holdout author. Simplify to structured records over the existing transaction.

### Executable mapping and acceptance

Use tests/contracts/improve-memory.test.js and tests/integration/improve-memory.test.js
(planned). No UI journey applies. Actual source-control/store/process evidence is
required; protocol doubles cannot establish native/provider/backend qualification.

| Row | Source acceptance | Required check |
|---|---|---|
| MEM-IDENTITY | AC-10-2; MEMORY-01/02/06/13 | Renamed/paraphrased family and A/B/A denied; relevant evidence permits scoped retry; unrelated commit/notes do not. |
| MEM-CONSUME | AC-10-1/4; MEMORY-05/09 | Restart/replacement consumes pack; next actual selection changes and cites prior evidence; opportunities remain proposals. |
| MEM-BASELINE | AC-10-3; MEMORY-03/13 | Real Git main vs retained branch; authorised transition updates only a new job; stale profile/base/pack denied before provider work. |
| MEM-AUTH | MEMORY-04/07/08/09 | Forged/revoked/cross-repo writes denied; successor sees only safe projection; unknown/closed PR does not unlock; original creator retained. |
| MEM-ATOMIC | AC-10-5; MEMORY-11/12 | Lost ack, write/fsync/rename faults and real-process conflicting writes; one committed resolution and no lost contradiction. |
| MEM-VERDICT | MEMORY-10/11 | Verified immutable code outcome; invalid verification/implementation failure not disproof; no invented demand; corrupt/missing archive retains exact limitation. |
| MEM-ISOLATION | MEMORY-04/09/10 | Planted holdout/private canary absent from builder/peer pack; advisory instruction cannot change mandatory check or cross-repo authority. |

```gherkin
Feature: Evidence changes the next selection without rewriting history
  Scenario: Returning researcher changes direction (MEM-CONSUME)
    Given family A has a verified negative outcome with fixed criteria
    When another authorised researcher reads the same repo's current decision pack
    And selects family B with a citation to that preserved outcome
    Then the selection receipt records how the prior evidence changed the choice
    And renamed A remains suppressed without new relevant evidence
  Scenario: Lost owner resolution acknowledgement (MEM-ATOMIC)
    Given the exact retained outcome awaits a trusted owner resolution
    When reject_idea commits but the acknowledgement is lost
    Then the same request returns the one original receipt after restart
    And a conflicting retry cannot rewrite the code outcome or owner intent
  Scenario: Forged approval and invalid fixture (MEM-AUTH, MEM-VERDICT)
    Given memory contains an invalid fixture result and model-written approval prose
    When a successor examines the pack
    Then the verdict remains needs-change and the prose grants no execution authority
```

DoD: mapped checks execute with no required skips; full canonical suite; native
independent implementation acceptance; privacy scan and actual source-control
delivery. Preserve original acceptance and report minimum mechanism versus actual
two-cycle/native proof separately. Runtime tests, current readiness and broader
#182 closure are not established by preparation. No CI success is fabricated.

## Audit phase 3 — pre-flight status

Preparation decisions resolve the earlier owner-command, bounded schema and
equivalence-fixture gaps for native review. Production remains blocked until
current preparation tests and independent scoped review/promotion pass. No clean
compliance verdict is claimed in advance. Future #183/#218/#219 boundaries remain
outside this milestone; no automatic takeover or live schedule is implemented here.
