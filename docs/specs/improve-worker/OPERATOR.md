# Local worker qualification

This slice provides an owner-invoked local Docker adapter around the existing
single-cycle Improve core. It is not an MCP service, plugin, scheduler, or a
promise that arbitrary repositories can run unattended. Those remain #218,
#219 and #181.

The qualified recipe is the bounded, zero-dependency Node HTTP fixture in this
repository. Next/Supabase recipes require their own live qualification before
use. The prior #180 HeyStax proof established product behavior; it did not
qualify every recipe inside this worker.

## Prerequisites and invocation

Use Linux with local Docker/cgroupv2/seccomp, the already installed Node, Git,
pnpm, Playwright packages and Chromium headless shell, and an authenticated
Claude subscription CLI supporting safe/restricted mode. No downloads or image
pulls occur. The offline scratch image and read-only software mounts are pinned
by content, not a mutable tag. Missing capabilities stop with a named finding.

Create a mode0600 owner configuration outside every repository:

```json
{
  "state_root": "/absolute/private/worker-state",
  "pnpm_root": "/absolute/installed/pnpm-package",
  "playwright_root": "/absolute/installed/node_modules",
  "browser_directory": "/absolute/chromium-headless-shell-directory",
  "claude": "/absolute/authenticated/claude-executable"
}
```

Do not put credentials in it. The fixture credential is generated privately for
that job; provider login remains in the trusted control plane. Never mount a
provider home directory, publisher credential or Docker socket into a worker.

```sh
node scripts/improve-worker-qualify.cjs /private/owner.json all
node scripts/improve-worker-qualify.cjs /private/owner.json recover /private/worker-state/qualification-EXACT
```

The first invocation runs transport qualification, registers the observed
fixture profile through #216, and invokes the existing core stages once:
selection → critique → independent oracle → freeze → baseline → build/peer →
once-only deciding verification → independent judgment → mechanical decision →
finalization → durable commit → destruction/recovery. Normal profile authority
and the original profile revision are rechecked at protected starts. The model
launch relay lets the registry lock end after starting a process, without
holding the lock for a model response. A revoked grant or changed profile blocks
new work. Recovery checks current historical-read access and returns the old
result; it does not mint new execute, KEEP or publish authority.

For diagnosis, individual transport/configure/begin/critique/oracle/freeze/
baseline/build/verify/judge/evaluate/finalize/persist actions retain private
stage history. They are not an allowance-reset mechanism. Never invoke a
consumed deciding holdout again. Repairing frozen runtime bytes requires a new
cycle and independently authored oracle; preserve the old failed history.

## Isolation and evidence

App and checker containers have separate filesystems and PID namespaces. Only
the checker joins the app's job-only network namespace. Neither has external
networking; the image has a read-only root, dropped capabilities,
no-new-privileges, 128-process/one-CPU/768MiB bounds and bounded execution/output.
Git has a separate container with write access only to the owned job Git area.
Hooks, fsmonitor, credential helpers and external protocols are disabled. Source
and software are read-only for repository execution. pnpm acquisition is offline
with lifecycle scripts disabled, and dependency-bearing recipes are explicitly
unqualified in this slice.

Actual trusted probes, rather than the candidate's self-report, test host,
credential, publisher, cross-job, oracle and process visibility; source write,
IPv4/IPv6/DNS egress and host-backend access are denied. Desktop and360px
Playwright journeys exercise real HTTP owner save, feedback, reload, readback,
and wrong-credential403 with no persisted mutation.

Docker's archive API was observed returning an empty view of paused tmpfs. The
adapter therefore pauses the entire container cgroup, obtains the engine-owned
PID, and captures its live mount namespace through `/proc/PID/root` with bounded
fd-relative no-follow traversal. It rechecks paused/PID identity and rejects
links, hardlinks, special files and excessive sizes. Containers are removed
before committing evidence. This is an intentional correction to the archive
mechanism proposed during preparation; no empty archive counts as a receipt.

The generated executable binds its configuration, adapter/helper/relay, core
scripts, loaded dependencies, rubric and tool bytes. The read-only software
layer is rehashed before creating workers. The core's existing contract,
verifier/workspace identities, hidden holdout and KEEP/REVERT/INCONCLUSIVE logic
remain authoritative. Nothing consumed is classified as mutable output.

The private durable store hashes and fsyncs captured files, authenticates the
job/principal/repo/revision manifest, atomically commits and syncs the containing
directory before acknowledgement. KEEP also needs the retained Git bundle.
Lost acknowledgement recovers the same commit, with no model/check replay.
Missing, corrupt or mismatched evidence refuses recovery. Incomplete stages
stay quarantined; there is no automatic garbage collection. The guarantee is
worker/container loss on the same healthy local disk, not loss of the host or
disk.

## Models and usage

Builder Sonnet and oracle/peer/judge Opus use fresh native contexts and actual
observed effective models. Safe mode, restricted mode, empty I/O tools/MCP and
no session persistence prevent repository instructions from gaining host tools.
StructuredOutput is allowed only as non-I/O serialization. Inputs and responses
bind a nonce, role and digest. File output is strictly parsed and limited to
approved scoped paths before it touches an owned workspace. The independent
judge receives actual images and verification evidence without the builder
trace. Same-vendor model independence is reported honestly.

Usage mode is `subscription_cli`. Native CLI dollar estimates are partial
telemetry, not invoices; actual charges remain unmeasured. No API key, endpoint,
`--bare` route or API-billed fallback is selected. An OpenAI managed runtime is
unqualified here: no approved API-billed account route and no observed equivalent
host/isolation/browser/backend/durable-store evidence. Reachability alone is not
qualification.

## Verification

Jest contracts/integration test parsing, output/path escapes, actual filesystem
capture/recovery, seven persistence fault points, corruption and authority/runtime
refusals. Full canonical Jest and actual live qualification are separate gates.
No skipped or never-run browser journey can establish qualification. See
`RESULTS.md` for the executed run and its limits; precursor probes remain
explicitly labelled as preparation.

The live positive controls use a real host HTTP and UDP DNS listener, deliberately
opened fake canaries and a concurrent second job. The Docker socket is checked
on the trusted host only and is never mounted into a worker. The same probes
must detect the positive controls before denials count. Engine inspection checks
exact networks, bind sources/destinations/RW, allowed tmpfs, user, namespace and
resource/security settings. A deliberately writable-root control is rejected
before any repository executes. A host-only watchdog removes an owned container
on controller loss or expiry, including a paused worker; live qualification kills
its own controller and confirms the active descendant/container disappear.

Recovery requires explicit principal, repository and profile revision. Tests
cover real EACCES, corrupted/missing/moved manifests and healthy same-operation
retry, as well as injected persistence faults. A post-rename sync failure is
`commit_unconfirmed`, never terminal success. The actual core proof also injects
persistence failure and lost acknowledgement against its completed real result,
then recovers the same manifest after removing Git and core working files.

The judge receives every required frame, with a bounded maximum of16 images;
exceeding the limit fails clearly instead of silently truncating evidence. The
vision transport is exercised with an actual PNG and a fresh tool-free Opus
context. Model presentation omits bulky `execution.json` container-policy and
Playwright configuration records; the raw evidence remains retained, hashed and
available to mechanical checks and independent review. UI outcomes, failure
reports, persisted values, diff and screenshots remain model inputs.

`all` stops with `contract_amendment_required` when the independent critique
requires amendments. The authorised agent can make the bounded private contract
clarification and continue the same unconsumed cycle through individual phases.
That is a named handoff, not permission to ignore critique or restart a consumed
holdout. `evidence/improve-worker/run-core-phase.cjs` drives the same existing
core/adapter for the qualification, including prefreeze seed diagnostics and the
actual-result persistence-fault/recovery proof. It does not supply model events,
substitute deciding checks, or implement another decision engine.

Playwright attachments can duplicate screenshot bytes. The relay validates every
retained PNG and sends each byte-distinct frame once, together with a hashed
manifest mapping every retained path to its frame. The16-frame bound applies
to distinct bytes; a separate256-file bound limits raw input. It never silently
drops a distinct frame. The rdQuRF cycle exposed26 files for14 frames, failed
before any judge provider call, and was retained as INCONCLUSIVE. Its consumed
holdout was not rerun; current-runtime qualification uses a fresh oracle/cycle.

## Observed capability matrix

| Capability | Selected local recipe | OpenAI managed alternative |
|---|---|---|
| Git and immutable source | Real isolated Git, retained commit/bundle and pinned base | Not executed or qualified here |
| Node/package acquisition | Pinned installed runtime; real offline pnpm, lifecycles disabled | No qualified dependency/cache recipe |
| Browser/backend | Actual Chromium1280/360 HTTP save, reload/readback and403 denial | No observed browser/backend route |
| Process lifetime | Whole-cgroup pause, termination and controller-loss watchdog tested | No observed equivalent boundary |
| Host/secret/cross-job/egress | Positive controls plus actual app/checker denials; only job credential injected | No selected secret/isolation configuration |
| Durable evidence | Authenticated local-disk commit, real failure/lost-ack and post-deletion recovery | No selected artifact adapter or account route |
| Independent roles | Actual fresh Sonnet/Opus subscription contexts; non-I/O tools; image path manifest | No approved inference/billing route |
| Usage | subscription_cli; estimates only, actual charges unmeasured | Unqualified; never an automatic API fallback |

The [official OpenAI runtime overview](https://developers.openai.com/api/docs/guides/agents)
distinguishes the managed Agents API from the application-hosted Agents SDK;
the managed API can use hosted, self-hosted or no sandbox. Those documented
options do not establish this account's access, billing authority, repository
recipe or actual execution/storage guarantees. Qualifying that alternative is
future work; the observed local route above is the selected adapter.
