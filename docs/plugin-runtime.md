# Self-contained runtime foundation

The canonical Node runtime carries js-yaml 4.3.2's dependency-free UMD build and
Zod 4.6.7's unchanged CommonJS dependency closure in `scripts/vendor/`. The
manifest records upstream package identities, licences and each file's SHA-256.
Runtime imports use explicit relative paths: no user-side dependency install,
network fetch, global Node search or alternate parser is needed.

Release developers reproduce the tree with `node scripts/vendor-runtime.cjs`
using those exact installed upstream versions. `--check` refuses drift, including
extra files. This generator is a development tool; deployed runtime does not run
it. Project test frameworks, model CLIs/authentication, and the separately deployed
MCP service SDK remain external capabilities. Missing capabilities are not passes.

New Duo pins include first-party scripts, vendor files, package metadata, templates,
skills and CLI resources in the existing hash-bound manifest (`closureVersion: 2`).
Installed project scripts receive these read-only source resources below
`scripts/runtime-resources/`; this does not replace the project's package.json.
The existing installer owns the bytes, lock, rollback and staging. Doctor restore
resolves each embedded resource to its canonical source bytes. No bundle-time
source rewriting or alternative updater is involved.

Existing pins are unchanged. Updating a package never upgrades historical evidence
or repairs a legacy incomplete closure silently. Resume still verifies its exact
selected bytes; corrupt or missing files block. New cold tests remove the original
package, execute retained routing/runner helpers, and reject dependency tampering.

`tests/contracts/plugin-runtime.test.js` maps the executed Node journeys
J-PLUGIN-RUNTIME-SELFCONTAINED and J-PLUGIN-PIN-CLOSURE. It disables global module
search, clears NODE_PATH/NODE_OPTIONS, removes ambient PATH tools, uses paths with
spaces and tests valid, required-red and missing-dependency cases. These are CLI
payload proofs. Actual native plugin loading, commands, hooks, marketplace release
and customer use remain separate #110–#116 obligations.
