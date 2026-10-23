# #216 preparation: registered profiles and actionable preflight

Work weight: new authority/interface concept, persistent private configuration, multiple repositories. Simulate, kill check, typed contract, negative integration journeys and independent native review required. No UI, database, authentication provider or production credential change.

## Simulation Findings (proposed)

Owner/operator: register the Node repo, inspect its readiness, then request a run; divergence: an executable version matches but its bytes changed, or a CLI is signed in yet cannot operate without approval. Add exact executable identity checks, separately reported authentication/noninteractive/availability checks, and never infer quota from login. Owner approval selects local protected JSON rather than new UI or DB.

Delegated caller: trusted host resolves caller A; A checks repo A then attempts repo B, URL/path/command/secret overrides, fake profile revision or read-only execution. Add strict request keys, owner-only registry writes and caller/repo/host permission intersection. Unknown and inaccessible aliases return the same redacted unavailable finding. Repository text never updates policy. Future MCP transport must resolve identity independently (#218); this local library does not pretend to authenticate arbitrary strings from a network payload.

Returning operator/collaborator: preflight succeeds then owner revokes execute, edits profile/ref/routing or runtime capability, or caller tampers with a saved report; divergence: caller still needs their prior authorised record. Add authenticated lease binding and fresh policy/input validation before protected operations, deny stale execution/publication and retain separately authorised private history. A second repo's failed checks never modify the first repo or runtime.

Proposed additions accepted under the owner's instruction to implement the foundation: REQ-PROFILES-06 strict typed request/owner registry; REQ-PROFILES-07 separate configured, authenticated, noninteractive and availability facts; REQ-PROFILES-08 signed short-lived preflight lease plus fresh protected-operation revalidation; REQ-PROFILES-09 caller-scoped historical reports with no secret values/other caller findings.

Kill check: the existing Improve core already owns loops, contracts and decisions. Add a small registry/preflight/authority library and CLI, shared with a later MCP adapter. Do not add another agent, scheduler, decision engine or onboarding UI. Until #217 qualifies a worker, report worker_unavailable rather than claim runnable readiness.

## Audit phase 1 — gap analysis

Present: original outcome, scope/non-goals, five behavioural AC, dependencies and proposed requirements. Missing: selected approval/principal mechanism, exact interfaces, permission and stale boundaries, typed diagnostics, concrete executable negative journeys and DoD mapping. SQL/RLS and graphical selectors/Playwright N/A: this is a local control-plane API/CLI with no graphical UI; real filesystem/Git/child-process integration journeys are required instead.

## Audit phase 2 — surgical uplift

Owner storage: private filesystem registry outside repository/worker roots. JSON files version1, owned by current OS UID, no group/other permission or symlink components, atomically written with mode0600 under mode0700 directories. Only the explicit local owner registration CLI writes profiles; service callers receive no registry mutation API. An owner-selected canonical local Git repo carries its pinned remote identity, permitted base ref(s), current approved commit, mission, allowed/protected paths, setup/test argv, exact toolchain paths/hashes, routing path/hash, named worker adapter revision, fixture-secret references, private evidence path and publication policy. Profile revision is a content hash; caller input never substitutes any field.

Trusted host configuration resolves principal and allowable operations independently of request JSON. Local CLI principal is uid:<actual UID>. The reusable service requires a host-owned resolver; accepting principal from a future MCP body is forbidden. Owner grants and host operations intersect for read/preflight/execute/publish. Read-only callers never acquire execute. Secrets are references to approved test fixtures, not values; preflight checks presence/type/permissions only and never returns contents or environment values. This registry is a same-user trusted control-plane boundary; filesystem isolation of repository code is #217.

```typescript
interface RepoRequest { repo_id: string; revision?: string; }
interface Finding { check: string; code: string; status: 'passed'|'blocked'; observed: string; retryable: boolean; next_action: string; }
interface PreflightReport { repo_id: string; revision?: string; ready: boolean; findings: Finding[]; lease?: string; }
// Host-only construction, never reconstructed from caller payload:
createProfileService({registry, resolvePrincipal, hostCapabilities});
// Shared CLI/library methods: inspect(request), preflight(request), authorize(lease, operation), history(request).
```

Check safe Git identity without checkout, hooks or network; pin remote/ref/commit, toolchain executable bytes and reported version, routing bytes, approved recipe shape, fixture references and real-backend recipe, declared verifier, actual private evidence create/read/delete probe, selected qualified sandbox and provider auth metadata without inference. Never execute repository setup/test/backend recipes during preflight. Distinguish unsupported adapter, missing dependency, auth missing, noninteractive role unavailable, availability unknown and evidence inaccessible. Host capability observations have an explicit revision; no network payload can assert its own sandbox qualification. Ready means all selected profile requirements are established; it does not mean the current provider has quota or the product tests pass.

A signed lease binds authenticated caller, repo/profile revision, host capability revision, checked ref/toolchain/routing facts, allowed operations and bounded expiration. Re-read/revalidate before execution or publication. Revocation/profile or host change denies new protected work with permission_revoked or stale_profile; a forged/expired lease is invalid_lease. Atomic caller-scoped report storage survives execution revocation when read/history remains granted. Neither unknown paths nor secrets appear in diagnostics.

```gherkin
Feature: Registered repository preflight
  Scenario: Two independent real repositories
    Given two disposable Git repositories with structurally different approved recipes
    And caller A can access only repo A while caller B can access only repo B
    When each requests preflight
    Then readiness follows its own pinned toolchain/backend/worker requirements
    And failure in A leaves B's profile and working tree unchanged
  Scenario Outline: Reject payload authority
    Given a read-only caller and an owner-approved registered repository
    When the caller supplies <override>
    Then the request is rejected before checkout, recipe or provider inference
    Examples:
      | override |
      | URL/path/command/secret/principal |
      | forged revision |
  Scenario: Revoke between preflight and protected work
    Given an authorised caller has an authenticated preflight lease
    When the owner revokes execute or changes the pinned profile/ref/routing/host
    Then execute and publication fail with a specific permission or stale finding
    And separately authorised caller history remains readable
  Scenario: Failed capability is actionable
    Given the selected adapter or auth/toolchain/evidence access is unavailable
    When preflight runs
    Then it names the failed check, observed fact, retryability and next action
    And it never calls inference, starts recipes or silently switches to API billing
```

Preserve I-IMPROVE-001..014. Add I-PROFILES-001..005 to a new YAML feature contract: registered immutable input; authority intersection; truthful non-inference preflight; stale/revoked lease denial; isolated private reports. Contract tests exercise actual decisions and negative inputs; integration uses actual Git repos/files/executable probes, not mocked success.

Coverage: original AC-PROFILES-01/02 → strict request, registry validation, authority and forged lease tests; AC-PROFILES-03 → actionable capability findings and no model/recipe execution; AC-PROFILES-04 → two real repos/callers and private history; AC-PROFILES-05 → revocation/stale configuration/expiry tests. Exact tests: tests/contracts/improve-profiles.test.js and tests/integration/improve-preflight.test.js. Full canonical Jest gate, actual raw counts and native independent acceptance are required before merge. No claimed worker availability until #217 observes it.

## Pre-flight Findings

simulation_status: passed. Preparation verdict: no CRITICAL/P1 in the selected design; all applicability decisions are explicit. Implementation/test execution remains unestablished. Dependency #180 must be merged and bound before implementation review/merge; #176's merged runtime binding is consumed, while OS isolation is an explicit #217 gate, not silently asserted here.
