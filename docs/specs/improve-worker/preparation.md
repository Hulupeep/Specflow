# #217 selected worker preparation

Weight: authority boundary, untrusted execution, credentials and durable evidence across repos. Full simulation, contracts, real integration/browser/core-cycle qualification and independent review. No production DB/schema/UI or service transport change.

## Simulation Findings (proposed)

Three independent read-only persona agents followed the deep simulation method. These are text walkthroughs, not qualification or Duo acceptance.

Adversarial/delegate: approved profile → tool-free model output → confined execution; divergence: Git filters/helpers, JSON traversal/symlink parent, fixture exfiltration and oracle laundering. Proposed REQ-WORKER-A01..04: every Git operation in the execution boundary with controlled config/protocols; strict bounded regular-file JSON mutations; per-job no-egress including DNS/IPv6/cross-job; hidden oracle/expected answers never enter builder/peer/practice inputs. Map to supplemental06/07/09/11, existing03 and frozen I-IMPROVE trust rules.

Interrupted/returning: verified result → durable commit → destruction → historical recovery; divergence: crash before commit, lost acknowledgement, live writer, corrupted/wrong-job manifest, failed fsync, stale/revoked lease. Proposed REQ-WORKER-RECOVERY-01..06: explicit staging/commit-unconfirmed/committed states, stable operation identity, authenticated manifest/blob checks, bounded no-follow snapshots, persistence fault injection and fresh same-revision authority. Map to supplemental08/11 and original04. Refine termination order to cgroup quiescence → snapshot → confirmed termination → durable commit, because container tmpfs vanishes on termination; no writer may run during snapshot.

Owner/operator: registration/auth metadata → actual unattended roles → real core/browser/backend → durable result; divergence: approval/capacity/timeout/protocol failure, missing tooling/backend, fake role independence and API fallback. Proposed REQ-WORKER-07..10: documented-versus-observed capability matrix, bounded typed diagnoses, actual nonce/schema/provenance checks and effective model separation. Map to supplemental09/10, original01/02/05. Missing tools or infrastructure never become green through test skips or protocol doubles.

Accepted engineering choices under the delegated goal: local Docker pair first; offline-only dependency layer and zero external egress; job-scoped low-privilege fixture only; local-disk worker-loss durability; quarantine incomplete records with no automated GC. No paid managed provisioning. Role calls use an180s deadline; one retry only after a specific evidenced pre-freeze transport repair, never after holdout consumption or by switching billing. Unsupported capacity/auth/runtime remains a named blocker. No outstanding product/UX decision is invented for this infrastructure slice.

Kill check: retain one Improve decision engine and its hidden-holdout/baseline/finalization semantics. Build only isolation/transport/secure persistence around it. Stop qualification if it requires weakening input identity, allowing host tools, sending credentials to models, inventing a reviewer verdict or claiming API-billed capability from subscription login.

## Audit phase1 — gap analysis

Present: original outcome/scope/dependencies, five behavioural AC and capability matrix requirements. Missing: selected runtime, exact authority and I/O boundary, persistent commit/recovery semantics, failure states, role provenance and concrete executable mapping. New model/caller data remains untrusted. SQL/RLS/migration replay and product UI selectors are N/A; the owned Node HTTP fixture is not a production database change. Its actual browser journey is nevertheless mandatory qualification evidence, not a screenshot substitute.

## Audit phase2 — surgical uplift

```typescript
interface WorkerFailure { code: string; stage: string; observed: string; retryable: boolean; next_action: string; }
interface WorkerQualification { version: 1; adapter: string; revision: string; mode: 'subscription_cli'; capabilities: Record<string, {status:'documented'|'observed-pass'|'observed-fail'|'unavailable'; evidence:string[]}>; }
interface DurableResult { job_id:string; repo_id:string; profile_revision:string; core_run_id:string; historical:true; decision:'KEEP'|'REVERT'|'INCONCLUSIVE'; manifest_sha256:string; }
// Host-owned entrypoints resolve profile/principal; caller requests contain no path/command/secret override.
qualifyRegisteredWorker(repo_id: string): Promise<WorkerQualification>;
runRegisteredOnce(repo_id: string, expected_revision: string, operation_id: string): Promise<DurableResult|WorkerFailure>;
recoverRegisteredResult(job_id: string): DurableResult|WorkerFailure;
```

Source selection: consume owner-pinned local Git objects through an isolated Git-only view with controlled HEAD/config; never mount the source repository's config/hooks or credential helpers into untrusted execution. Shallow no-hardlink preparation; reject unsupported submodules/LFS/alternates with a typed blocker. Test malicious filter/config/helper canaries. Normal core Git acts only on its owned Git area in the confined Git transport; app containers cannot see the control Git directory, core ledger or oracle. No production credentials copied from existing worktrees. Scan selected source before model/runtime exposure; never include auth/config/secret files in curated model input.

A generated job launcher is command[0], so existing executable identity hashes its bytes. It pins the adapter/helpers/job configuration/software-layer manifest before importing or launching anything; transitive inputs cannot hide behind an unchanged launcher filename. Read-only consumed dependency layers are fully hashed, not blanket-ignored. Setup-generated outputs are captured from quiesced workers, imported only beneath approved disposable paths, then treated as ordinary sealed inputs. Core evaluation/finalization and subsequent protected transitions revalidate the same approved adapter/profile. No second evaluator/decision loop.

Docker workers use pinned offline scratch image plus explicit read-only approved software/source mounts, private tmpfs, cgroups memory/CPU/PID limits, dropped capabilities, no-new-privileges and default seccomp/AppArmor. App has networknone; checker joins only that job's network namespace while keeping separate filesystem/PID. Never mount host home, provider/publisher credentials or Docker socket. No untrusted code executes outside these boundaries. Controlled Docker API is a trusted host facility, never exposed as a model/caller tool. Capture entire cgroup quiescence and termination; no orphan survives phase completion. Enforce wall/output/file-count/byte bounds. A missing browser/kernel/cgroup/cache/backend is unavailable, not a waived requirement.

Model CLI is trusted control plane, but its model receives no host I/O tools, MCP, custom instructions/plugins/hooks or persisted conversation. Installed --bare is API-key-only and forbidden here. Actual --safe-mode/--restricted plus empty tools/MCP retained Claude OAuth; only StructuredOutput was observed. Pin requested/effective Sonnet5.5 builder versus Opus5.5 oracle/peer/evaluator, fresh sessions and input nonce/hash. Same-vendor provenance is explicit; different role labels with the same builder model cannot manufacture independence. Independent oracle writes deciding scripts before freeze without candidate visibility. Builder/peer get practice and scoped source only, not holdout code/expected answers. Actual role JSON files are untrusted: reject duplicate keys/paths, traversal, protected paths, wrong nonce/digest/session/model, overlarge or unexpected files before atomic application.

Use signed private durable manifests outside workers; regular-file fd-relative traversal/extraction never follows links or special files. Required evidence includes original core ledger, frozen contract/scripts, exact receipts/counts/screenshots, patch and retained commit bundle when KEEP occurs. Fsync all content and directories before acknowledgement. An uncertain post-rename directory sync is commit_unconfirmed, not complete; recovery may confirm intact committed bytes without rerunning a cycle. Loose staging files cannot reconstruct a verified decision. Wrong owner/repo/job/revision/hash/MAC or missing files is a redacted typed rejection. Read authority remains separate from execute/publish; recovery never revives a revoked grant.

```gherkin
Feature: Confined single-cycle worker and durable evidence
  Scenario: Genuine existing-core qualification
    Given an approved registered fixture repo and observed independent role routes
    When the same pinned Improve interface completes once in the qualified containers
    Then actual browser/backend checks and original core decision are retained with provenance
    And no production or external publication occurs
  Scenario: Repository and model try to escape
    Given a hostile Git filter, symlinked output and out-of-scope JSON patch
    When preparation/application/snapshot crosses its real boundary
    Then host/credential/oracle/cross-job canaries remain hidden and protected bytes unchanged
  Scenario: Persist before acknowledging
    Given verified core output and quiesced workers
    When write, fsync or commit fails
    Then no terminal success is acknowledged and a named recoverable/incomplete state remains
  Scenario: Lost acknowledgement
    Given the durable result was committed but its acknowledgement was lost
    When the same operation is retried after all workers are destroyed
    Then the original decision/artifacts return without another cycle or holdout
  Scenario: Historical read cannot grant publication
    Given a retained result and revoked execute/publish permission
    When authorised history is recovered
    Then reading succeeds and new protected work remains denied
```

J-WORKER-QUALIFICATION: start unique seeded Node HTTP fixture → open actual app at1280 and360 → enter job-only credential/new value → Save → assert response and visible outcome → reload and independently re-read persisted state → submit wrong credential → assert403, visible Forbidden and unchanged backend state. Map final executable Playwright spec to tests/e2e/journey_worker_qualification.spec.cjs; run baseline/practice/once-only candidate deciding checks through the same qualified worker. Record exact executed/failed/skipped counts, source/config/software identities and before/after evidence. A missing/unrun/skipped required journey remains CRITICAL. Current precursor probes are explicitly not that final core-cycle proof.

Coverage: original01 and supplemental10/11 → real matrix/core/browser/runtime captures; original02 and supplemental09 → actual role and negative provenance tests; original03 and supplemental06/07 → real kernel/container/Git/JSON/egress canaries; original04 and supplemental08 → actual destroy/recover and injected write/fsync/commit/lost-ack/tamper cases; original05 → actual mode/provenance/usage and no API fallback. Test paths: tests/contracts/improve-worker.test.js, tests/integration/improve-worker.test.js, tests/e2e/journey_worker_qualification.spec.cjs. Full canonical Jest and live qualification are separate required gates, neither a substitute for the other.

Dependency evidence: #216 merged PR227; actual1549-test/80-suite gate and7-row native acceptance are retained, and the profile API module remains the tested bytes. #180 merged PR226 with truthful real-backend INCONCLUSIVE proof; #223 repaired #176 runtime binding. No unimplemented parent capability is marked tested. Managed OpenAI Agents API and cloud environments are documentation-only alternatives; no account/runtime/API billing capability is inferred from reachability. Cite primary docs in the final matrix.

## Pre-flight Findings

simulation_status: passed for the selected design. No CRITICAL/P1 design gap remains; implementation and live qualification are not established. Observed precursor browser/container/role facts are in preparation-probes.json. The final decision requires current real execution and independent acceptance, including failures and unsupported scopes. Preserve all existing I-IMPROVE and I-PROFILES contracts; add worker-specific YAML invariants and keep CONTRACT_INDEX/CLAUDE tables aligned before pinning review.
