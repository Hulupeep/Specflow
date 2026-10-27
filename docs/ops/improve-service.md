# Owner-local Improve service

Supported deployment: Linux, Node22, qualified version2 registry/controller and
owner-registered prepared plans. The service binds `127.0.0.1`; its persistent
controller is authoritative across HTTP/MCP disconnects and process restarts.
Remote hosting and other worker recipes require their own qualification.

An authorised onboarding agent registers the repository/profile, qualified worker,
private evidence destination and immutable task plan. Normal callers supply a
registered repo ID, task/experiment identity and source/contract revision. They
cannot supply executables, filesystem paths, principal, models, billing mode,
execution generation or completion receipts. V1 admits the actual policy creator;
separately audited agent credentials can represent that principal. Bot brand is
not authority. Provision distinct credentials for holders that need distinct audit.

## Start and inspect

Keep host configuration, credential registry and client files outside the checkout
in an owner-private directory. Never put bearer values in commands, source or logs.
The trusted `createCredentialFile` helper writes a new private client secret file
and returns only its hash for owner registration. It refuses shared/symlinked
parents and cannot overwrite a credential.

Start the installed source entry point with an absolute private host file:

```sh
node scripts/improve-service-host.cjs /absolute/private/service-host.json 8765
```

It prints the loopback address. MCP uses `/mcp`; the same operations are also
`POST /v1/preflight`, `/v1/start`, `/v1/status`, `/v1/cancel` and `/v1/resume`.
`GET /v1/capabilities` requires authentication. The MCP tools are
`improve_preflight`, `improve_start`, `improve_status`, `improve_cancel` and
`improve_resume`. All request schemas are strict and require `api_version:1`.

The thin CLI reads the bearer from its private client configuration:

```sh
node scripts/improve-service-cli.cjs improve_status /absolute/private/client-config.json /absolute/private/request.json
```

Client config contains `version:1`, the loopback `url` and `credential_file`.
Request files are private too. A status request contains `api_version`, `repo_id`
and optionally `run_id`; omitting the run performs authorised repo lookup.

Preflight separates schema/service capabilities, worker readiness, plan checks
and dispatcher enablement. Metadata success cannot prove provider capacity or a
new backend recipe. A deliberately paused dispatcher can retain queued admission;
queue time consumes the original work window. Missing plans give the agent a
preparation action. Native auth/quota failures retain their actual causes.

`improve_start` acknowledges only committed admission. Keep its request ID and
original task payload for retry. Different watchers observing the same task share
one task claim. Changed source/contract under that claim conflicts; existing
blocked receipts are immutable. Lost HTTP acknowledgement is not permission to
create another job. Reconnect and recover the original command/run.

## Follow evidence and recovery

Status returns `jobs` plus the canonical authenticated `reports`. Job and report
IDs/revisions correspond; reports retain actual stage, last completed action,
checks, independent judgments, remaining allowance and next actor. Countdown
remaining time can change without changing the factual revision. Code decision,
current retained improvement, experiment verdict and delivery are separate.
Historical KEEP with missing evidence cannot establish current improvement.

Client disconnect or role replacement does not cancel accepted host work.
Revoked/stale credentials are denied before private lookup. Explicit cancel stops
new execution and future publication, preserving finalized results and issued
receipts. Resume command IDs retain their original expected generation; retry
cannot claim a second generation after the original command was applied.

The dispatcher launches its inert worker from the exact registered pinned runtime,
records process identity/assignment and releases it only after authorisation.
Live/unknown old work prevents takeover. Exact authenticated original receipts can
be adopted; an expired queue/lease is never proof of death. Unknown remote results,
consumed holdouts and known failed stages cannot be blindly retried. Unsupported
repair/disposition stays explicit. Old pinned programs are never edited to repair
an active job.

The fixed Node/Docker qualification driver under `evidence/improve-service/` is a
recipe test, not a generic repository runner. Its records distinguish protocol
fixtures, native execution, actual backend checks, operator recovery and optional
delivery. No live recurring schedule, draft-PR publication or HeyStax delivery is
enabled by this service slice; those release gates are owned by #219/#215.
