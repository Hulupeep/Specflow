# Native root layout and catalog

The full Claude plugin lives at the repository/npm package root. Its generated
`.claude-plugin/plugin.json` uses the canonical package version, explicit command
and agent files, and the shipped skills directory. `node scripts/native-plugin.cjs
--check` rejects drift; run it without `--check` to regenerate intentionally.
No duplicated core, installer or permission engine is involved.

The catalog contains 24 invocable role documents. Nine utility/skill documents
remain outside the agent list. Native frontmatter supplies names/descriptions and
inherits host model/tool policy. Original instructions remain byte-bound to the
pre-port baseline. Audit, simulate, Duo and loop-selector skills keep their original
frontmatter, routing rules and references. Native context resolves framework assets
from the host-expanded plugin root and project state from the selected project.
Ordinary npm/Codex context remains supported.

`/specflow:about` is a read-only identity command. It reads the actual installed
package, native manifest and dependency inventory. It does not pass gates or grant
release authority. Runtime commands are `/specflow:run`, `/specflow:trace` and `/specflow:verify`.
They dispatch structured JSON requests to the installed canonical runner with an
explicit project, preserve its exit/result, and inherit host tool permissions.
Use `--help` for arguments; trace is historical diagnosis and verify executes the
owning checks. State and gate authority remain with the existing runtime.
Git and the accepted project's test framework are required when those owning
checks depend on them; bundled runtime dependencies do not replace those tools.
Audit/simulate remain `/specflow:specflow-audit` and `/specflow:specflow-simulate`.
Owning hooks (#113), marketplace
publication (#115) and final integrated/cache proof (#116) remain separate work;
the overall plugin (#109) is still under qualification.

Run deterministic payload tests with:

```sh
node node_modules/jest/bin/jest.js tests/contracts/native-plugin-layout.test.js --runInBand
```

Maintainers qualify real native behavior explicitly, using an existing Claude
subscription session and a task-owned output directory:

```sh
node tests/helpers/native-plugin-host.cjs /absolute/plugin/root /private/output
```

The driver uses supported non-bare native execution with Read/Glob/Grep/Skill
only, separate project/asset roots, and actual registered-component and successful
content-access receipts. It exercises about, a native role, audit and simulation.
It compares global settings/registration/hook artifacts, leaves credentials with
the official CLI, and never copies a credential or falls back to an API key.
Raw traces remain private. Monetary cost is unmeasured subscription usage.

Actual `--plugin-dir` execution is labelled inline, including when it loads bytes
previously registered in an isolated fixture. It is not proof of startup under the
marketplace's registered id, immutable version-cache update, npm publication or
customer validity. This Claude Code 2.1.285 qualification copied the local
marketplace payload into its cache; local source handling depends on the host
and source type. That observation does not prove versioned updates. Final published npm
source/cache proof belongs to #115/#116; a Git root with a supported lockfile can
trigger host-managed dependency installation, despite runtime independence.

Validate the native manifest and marketplace files individually on Claude2.1.285,
whose directory validator prefers the marketplace when both are present. The root
CLAUDE.md warning is expected: it is not loaded as plugin context. Native roles and
skills supply their own context. Schema validation alone never substitutes for a
real native journey.
