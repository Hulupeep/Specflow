# Host-aware setup

From a matching Specflow core installation:

```sh
npx @colmbyrne/specflow init . --runtime auto
# Deterministic alternatives:
npx @colmbyrne/specflow init . --runtime codex
npx @colmbyrne/specflow init . --runtime claude-code
specflow setup '/path/to/project' --runtime codex
specflow doctor '/path/to/project' --json
```

`setup` runs public init and then `verify --strict` in the same canonical target.
It reports installation and readiness separately. An incomplete project retains
its successfully installed files and returns nonzero. A staged setup also records the requested runtime separately from the still-active binding. Rerunning refreshes
managed files and preserves custom routing. `--replace-routing` replaces routing
only. A modified gate blocks an update: back it up, compare it with the named
package, and explicitly restore the reviewed canonical bytes before rerunning.
An update also checks the prior recorded ownership against its identified canonical
package. A rewritten local hash cannot authorise replacement. Keep versioned
canonical packages available; if an old package has disappeared or was replaced in
place, divergent bytes remain unverifiable and require the same reviewed compare/
backup/restore procedure. Identical current canonical bytes can still be refreshed.
Doctor never repairs or normalises bytes, requests authentication or calls a model.

Auto uses these configuration hints: `SPECFLOW_RUNTIME=codex|claude-code`, a UUID
`CODEX_THREAD_ID`, or `CLAUDECODE=1`. Distinct supported hints conflict; blank or
invalid hints do not select a host. No installed directory is a signal. Explicit
runtime always wins. Missing/conflicting automation hints fail with both explicit
commands. An interactive public CLI can ask for a choice. Hints do not authenticate
an agent or prove a current native host session; use explicit runtime when unsure.

Doctor identifies its executing package separately from the inspected project's
active package/artifacts and staged update. Gate D artifact capability uses its conservative literal-require dependency closure, separately from unrelated installation ownership. It compares actual local bytes with
the recorded package's canonical bundle, not only local recorded hashes. An
unavailable package, legacy identity, missing/modified helper or custom cross-host
binding remains visible. A staged update is not active: finish retained runs and
rerun the installer. Existing pinned runtime bytes are never rewritten.

## Thin host actions

Isolated roots are `plugins/codex/specflow` and `plugins/claude-code/specflow`.
The Codex root carries portable and Codex compatibility manifests; Claude Code
uses `.claude-plugin/plugin.json`. Versions match core package.json. These roots
expose only setup and explicit Gate D actions, not the whole unqualified repository
skill library. The existing npm distribution remains the installer owner.

Each setup skill calls its `scripts/setup.cjs TARGET`. It selects its literal host
runtime and delegates to public `specflow setup`. A missing CLI preserves ENOENT
and supplies direct remediation; it never downloads a different version or
imports a private installer. Until #111, these adapters require the **matching
core checkout/release** on PATH. Published 0.11.1 predates these actions; do not
silently fetch it and claim this feature exists. Marketplace/full plugin release
and actual host installation are tracked separately in #109–116.

The explicit Gate D skill takes a request file:

```json
{"target":"/path/to/project","runDir":".specflow/runs/accepted","reportDir":"gate-d/epic"}
```

`node PLUGIN_ROOT/scripts/gate.cjs REQUEST.json` reaches the actual installed
`TARGET/scripts/teardown-gate.cjs accept-gate-d ...` in a fresh process, with no
upstream helper fallback. Relative run/report paths resolve inside the target.
It is an explicit CLI action, not an automatic Stop hook. Structural report
validity never substitutes for accepted current outcomes.

## Evidence and compatibility

Tests distinguish source/unit checks, actual installed CLI payload execution and
actual interactive host execution. They exercise known-good, red, required-skip
and submitted-forged-receipt controls. The CLI/payload fixtures use real Node,
Jest and gate processes; their synthetic data is not customer/backend proof.
Onboarding fixtures pre-provision dependencies, skip network dependency fetch and
run generated project tests through real npm/Jest. Provider sentinels must remain
uninvoked. Native plugin loading and stop-hook coverage remain #110/#116 work.

Host-signal choices were inspected with Codex 0.162.0 and the locally installed
Claude Code tooling; they remain optional hints, not an upstream stability promise.
Doctor reports artifact identity, not host-version/session qualification. A newer
or untested host must use explicit runtime and receive its own native qualification
before a native-session claim is made.
