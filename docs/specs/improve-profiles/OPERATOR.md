# Registered Improve profiles (#216)

This is the local POSIX control-plane registry and preflight API. It does not start an Improve cycle, expose MCP, schedule work or qualify a worker. #217 supplies the worker; #218 supplies authenticated remote calls. A successful profile validation is not executable readiness.

## Owner setup and caller requests

Keep the registry outside every repository and worker mount. Register an owner-reviewed JSON file with:

```sh
specflow profiles register --registry /owner/private/improve-registry --file /owner/private/example-profile.json
specflow profiles inspect example --registry /owner/private/improve-registry
specflow profiles preflight example --registry /owner/private/improve-registry
specflow profiles history example --registry /owner/private/improve-registry
```

The CLI derives `uid:<actual uid>`; it accepts no caller principal flag. Grant that principal `read` and `preflight` in the profile. The reusable library lets a trusted host resolve authenticated subjects instead. A future MCP adapter must fix the registry, capabilities and principal resolver in its host; none may come from tool arguments. Its public request is only `{repo_id, revision?}`. Do not expose owner registration, callback construction or internal leases as public tools.

Registration returns a content-hash revision. File ownership/mode checks require current POSIX UID and private directories/files. Generated registry directories are0700, files0600. Symlink components are refused. The registry is a trusted same-user control-plane store; these checks do not isolate other processes running as that user. Repository execution must be confined by #217.

## Profile version1

All fields below are required; unknown fields are rejected. Paths are owner-selected absolute canonical local paths except scope/verifier paths. Callers cannot override any field.

```typescript
interface RepoProfile {
  version: 1;
  repo_id: string; // bounded opaque alias
  repository: {
    path: string;
    remote: string; // credential-free HTTPS or git@host:path
    refs: {name: string; commit: string}[]; // approved branch refs and full object IDs
  };
  mission: string;
  scope: {allowed: string[]; protected: string[]};
  recipes: {setup: string[]; test: string[]; backend: string[] | null};
  verifier: {path: string; sha256: string}; // ordinary repo test harness, not the hidden Improve oracle
  toolchain: {id: string; path: string; sha256: string; version: string}[];
  routing: {
    path: string; sha256: string;
    usage_mode: 'subscription_cli' | 'api_billed' | 'unknown';
    providers: {id: string; kind: 'claude-cli' | 'codex-cli'; tool: string}[];
  };
  runtime: {adapter: string; revision: string};
  secret_references: (
    {id: string; kind: 'environment'; name: string; purpose: 'fixture'} |
    {id: string; kind: 'file'; path: string; purpose: 'fixture'}
  )[];
  evidence: {path: string};
  publication: {allowed: boolean; branch_prefix: string; automatic_merge: false};
  grants: Record<string, ('read' | 'preflight' | 'execute' | 'publish')[]>;
}
```

Recipe argv begins with an approved tool ID; it is not a shell string. Pin the real executable bytes/version outside the repo, including `/usr/bin/git`. The first approved base is the verifier's source; preflight reads its Git blob at that exact commit and checks its hash. It does not evaluate unrelated dirty working-tree files or change the current branch. Routing bytes are separately pinned.

Only reference dedicated test-fixture secrets. No secret values belong in this JSON, caller requests, diagnostics or Git. File references require private ownership/permissions; preflight checks presence without reading contents. CLI authentication runs in the trusted control plane through the already approved account route. It does not copy production credentials or inject anything into a worker.

## What a report establishes

Each finding has `check`, `code`, `status`, `observed`, `retryable` and `next_action`. Checks cover canonical Git/ref identity, pinned toolchain/routing/verifier, approved recipes, fixture references, provider login metadata, selected worker/noninteractive capabilities and private evidence access. Version/auth probes run in a fresh empty private directory; repository-local scripts/config cannot become the probe's working directory. Setup/test/backend recipes, checkout and inference are never run by preflight.

Provider login is local CLI metadata, not proof of token validity at the server, capacity or quota. The observed authentication route must match the approved usage mode. A subscription profile blocks API-key authentication or relevant API credential/endpoint overrides without returning their values. Codex login metadata uses `--no-daemon` to avoid disturbing another client’s background server. Actual role execution can still fail and must preserve its specific diagnosis. Missing providers, unknown usage mode and unqualified workers block execution; nothing falls back to API billing. An empty provider list cannot produce readiness. A matched worker qualification must explicitly support the profile's usage mode.

The host capability resolver is owner-controlled. Its adapter entries contain `id`, `revision`, `qualified`, `noninteractive_roles`, `usage_modes` and private evidence `{path, sha256}`. These are verified references to host-observed qualification, not assertions a caller may supply. A non-null backend recipe additionally needs a host `backends` entry: `recipe = SHA256(JSON.stringify({repo_id, commit: firstApprovedCommit, argv: backendArgv}))`, `ready: true`, and matching private evidence. This covers recipe qualification; the actual cycle must still check live backend health and seed identity. Until #217 supplies observed evidence, the default CLI host reports `worker_unavailable` and `noninteractive_unverified`.

`ready` means the selected checks passed, not that product tests ran, a KEEP was earned, or publication was authorised. Evidence create/read/delete proves local access; it does not promise survival of host/disk loss.

## Protected operations and history

`createProfileService({registry, resolvePrincipal, hostCapabilities})` returns `inspect`, `preflight`, `authorize`, `withAuthorized` and `history`. The first two return safe profile/report metadata. Internal preflight leases are HMAC authenticated, caller-bound and expire within300seconds; they are private control-plane values. The CLI prints only `lease_issued` and its report ID. History omits the lease. A long-running host may repeat preflight against the same job-bound revision to obtain a fresh lease; it must not silently adopt a changed profile or rewrite the frozen job contract.

Use `withAuthorized(lease, 'execute'|'publish', trustedSynchronousTransition)` for a protected start. The owner registry lock serializes registration with that revalidation/start. The transition receives the current approved profile, must synchronously start only the approved operation and cannot be supplied by a network caller. Revalidate every later protected transition, especially publication. `authorize` is a diagnostic check, not a licence to defer a later side effect without another check. Running work is not automatically killed by revocation; new protected operations are denied.

The intersection of caller grant, repository publication policy and host operations governs each start. Changed profile/ref/toolchain/routing/host inputs produce `stale_profile`; removed grants produce `permission_revoked`; forged/expired/cross-caller leases produce `invalid_lease`. Missing current capabilities keep their own named findings. Failed private report persistence issues no lease and cannot report readiness.

History is partitioned by trusted principal and repo. Retaining `read` while revoking `execute` preserves that caller's past reports. Another caller with access to the same repo sees only their own history. Unknown and inaccessible aliases return the same redacted response.

## Validation

`tests/contracts/improve-profiles.test.js` exercises strict authority/schema/private paths. `tests/integration/improve-preflight.test.js` creates actual disposable Git repos with Node/Python harnesses, actual executable/version probes and real private report files. Negative paths cover identity isolation, revoked/stale/forged/expired authority, missing verifier/backend, secret presence, failed persistence and repository-relative probe execution. These are API/CLI journeys with no UI, so no Playwright journey is claimed. Integration requires POSIX ownership/modes, Git, Node and Python3. Worker/browser/real-backend execution remains #217 and the actual HeyStax proof remains #180.

A positive authority-transition test uses explicit synthetic trusted-host/auth metadata and a metadata-only callback. It is a policy test, not evidence of a real worker, provider inference or isolation qualification. The separate actual-preflight.json records this checkout and real local Claude/Codex login metadata: no inference, ready=false, with worker/noninteractive qualification still blocked.
