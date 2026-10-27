# Improve caller and delivery operations

Supported here: owner-local Linux/Node22, an owner-prepared qualified recipe,
loopback HTTP/API1, and separate current-holder bearer credentials under one
owner principal. Codex0.162.1 and Claude Code2.1.285 actually invoked candidate
0.1.2. This release does not qualify a hosted cloud service, arbitrary repository
recipes or a Supabase worker. Existing real HeyStax product proof #180 remains
INCONCLUSIVE. A local qualification KEEP is not a demand or revenue verdict.

## Install the thin caller

From an absolute checkout containing the committed marketplace catalogs:

```sh
codex --no-daemon plugin marketplace add /absolute/path/to/Specflow
codex --no-daemon plugin add specflow-improve@specflow-repo
claude plugin marketplace add /absolute/path/to/Specflow
claude plugin install specflow-improve@specflow-repo --scope local
```

These commands were checked against the native installed versions above.
Retain the approved package version and `integrity.json` SHA256; a package edit
requires a new version, seal, install and qualification. Do not edit a live pin.

Provision a private client JSON with `version:1`, loopback `url`,
`credential_file`, qualified `runtime_root`, actual `package_sha256`, and the
strict TaskBootstrap from interface.d.ts. Bootstrap binds the source issue,
immutable task, durable brief locator and SHA256, exact Stax/action and role.
The credential file is a separate owner-issued private file containing
`{"version":1,"token":"<provisioned privately>"}`. Private directories must be
owner-only, files mode0600, with no symlinks. Put neither file in Git or a prompt.

For Claude, set SPECFLOW_IMPROVE_CLIENT_CONFIG to the private JSON's absolute
path. The Codex portable manifest uses its resolved
`${PLUGIN_DATA}/connection/client.json`; configure that native slot, rather than
assuming arbitrary shell environment variables are forwarded. Inspect only the
`improve` server's resolved configuration path; the complete MCP inventory can
contain unrelated credentials. Preserve any existing owner configuration.
A successful installation alone does not establish authentication or readiness.

## Invoke and replace a role

Start the owner-qualified service with:

```sh
node scripts/improve-service-host.cjs /private/service-host.json
```

Read improve://bootstrap, then preflight and status. Start only its exact
prepared task, using a stable request ID. Persist the returned run ID. Lost or
duplicate notifications use that original task/request or status; they do not
reset acceptance, attempts, the deadline or provider work. A transient
`authority_busy` warrants a bounded retry of the exact command after the writer
finishes. Diagnose continued contention; never invent a replacement job.

Provision a replacement role's own credential and update the owner-private
current assignment. Revoke the predecessor. The fresh caller resolves the
persisted brief and retrieves the same job/report; it does not need predecessor
chat or execution tickets. Bootstrap and task text supply work, not permissions.
The bridge starts no executor, publisher or scheduler. Missing resources or an
incompatible service fail before protected admission.

## Publish and hand off

The separate owner host references `delivery_config_file` in service-host.json.
It binds one repo/run, current credential, mechanical publication policy root,
publication repository/base/ref/retained OID, exact private grant file, private
bare publisher directory and optional configured HeyStax action/relay directory.
The current profile and host must also permit publishing. KEEP alone is not a
grant. No caller tool accepts those paths, grants, commands or remote receipts.

```sh
node scripts/improve-delivery-host.cjs publish /private/service-host.json /private/request.json
node scripts/improve-delivery-host.cjs handoff /private/service-host.json /private/request.json
node scripts/improve-delivery-host.cjs observe /private/service-host.json /private/request.json
```

`request.json` contains only repo_id and run_id. Publish authenticates the core
archive/bundle, scans the exact retained patch and outgoing prose, checks the
current base/ref and authority again at write time, then creates a draft PR.
Its empty-expected-old Git lease creates a new ref atomically; it never updates
an existing ref. It performs no merge or deployment. Unknown effects must be
looked up by original marker/remote identity before another effect can issue.

The HeyStax adapter uses the existing authenticated connected-host MCP tools.
The owner-host transport polls with:

```sh
node scripts/improve-connected-tools-cli.cjs next /private/delivery.json
node scripts/improve-connected-tools-cli.cjs respond /private/delivery.json REQUEST_ID /private/actual-result.json
```

Call the discovered, scoped tool exactly once for each claimed request and save
its actual result privately before responding. Persisted claims have no automatic
expiry. A missing transport is a delivery blocker, not a fresh build. Do not
release an uncertain write claim or substitute a direct API/token. After a lost
update acknowledgement, read the configured action and reconcile its exact
content. A changed/completed/missing action causes conflict; preserve human
content and create no replacement. HeyStax has no observed remote CAS, dispatch
or recipient-ack API. The report's recipient_observation remains unconfirmed;
fresh native-reader receipts are distinct evidence of actual observation.

`observe` obtains authenticated PR state and appends hash-chained memory
provenance. A fresh single-use observation is required before equivalent
re-selection; closure alone does not authorise retry or accept a new baseline.
Unavailable observations remain unknown and old observations cannot regress a
newer state. Code decision, experiment verdict and delivery status stay distinct.

## Release operation

First release is one finite cycle per qualified occurrence. A real owner-host
one-shot timer can call the same authenticated API. The built-in controller's
recurring schedule activation remains unsupported/paused; the plugin does not
supply another scheduler. No recurring timer was enabled by this qualification.
Retain private raw evidence and hashes, exact source/runtime/version bindings,
original failures and receipts. Final canonical CI and native independent
acceptance are separate gates from these runtime qualifications.
