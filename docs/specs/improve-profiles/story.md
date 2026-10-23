# [SPECFLOW] IMPROVE-SERVICE-01: registered repo profiles and actionable preflight

Parent: #215 · Story: IMPROVE-SERVICE-01 · Planning depth: `spec:thin`; not build-ready.

## Outcome
An owner registers a repo once; a caller can request an improvement without repeatedly supplying secrets or guessing how to run its tests.

## In Scope
Versioned, owner-controlled repo profiles and a non-provider preflight command shared by CLI and future MCP.

## Not In Scope
No model calls during preflight, new product UI, automatic permission grants, or arbitrary caller-supplied shell commands.

## Dependencies
#176, #180

## Acceptance criteria
- [ ] AC-PROFILES-01: A registered repo passes validation; unregistered aliases, forged revisions and path/URL overrides fail before any checkout or provider call.
- [ ] AC-PROFILES-02: A read-only caller cannot start a run; an authorised caller cannot expand protected paths or acquire production credentials.
- [ ] AC-PROFILES-03: A missing dependency names the failed check and remedy; no generic budget exhaustion or fake readiness is reported.
- [ ] AC-PROFILES-04: Two callers receive correctly scoped readiness reports and cannot read each other’s private findings.
- [ ] AC-PROFILES-05: Revocation after preflight prevents new protected work while preserving a readable authorised run record.

## Requirements proposed for preparation
- REQ-PROFILES-01 (MUST): Resolve repo_id to an owner-controlled canonical Git repository identity, allowed base refs, mission, scope/protected paths, setup/test argv, routing profile, runtime adapter, secret references, private evidence destination and publishing policy. Callers cannot replace these with a URL, path, command or secret value.
- REQ-PROFILES-02 (MUST): Intersect caller authority, repo policy and host capabilities for every operation; bind the validated profile revision to the job. Treat repository text and model output as untrusted content, never permission updates.
- REQ-PROFILES-03 (MUST): Preflight repository access, pinned toolchain, approved sandbox, real-backend recipe, verifier availability, provider authentication without an inference call, and private durable evidence access. Return typed findings with observed evidence, retryability and a concrete next action.
- REQ-PROFILES-04 (MUST): Validate profiles for two structurally different repositories with isolated identities and test environments. One repo failure must not change the other repo profile or active runtime.
- REQ-PROFILES-05 (MUST): Revalidate effective permission and relevant configuration before execution and publication; a changed approval/profile produces a stale-profile finding, not a silently rewritten contract.

## Evidence and open decisions
- Profile storage/approval mechanism and authenticated principal mapping need a selected decision before build-ready; prefer existing project config, not a new onboarding UI.

Planned verification (not executed or existing-path claims):
- tests/contracts/improve-profiles.test.js (planned)
- tests/integration/improve-preflight.test.js (planned: two real disposable Git repos; no inference calls)

