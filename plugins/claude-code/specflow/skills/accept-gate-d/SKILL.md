---
name: accept-gate-d
description: Execute the actual installed Gate D entrypoint for an explicitly requested acceptance scope.
---

Write a JSON request with exactly `target`, `runDir`, `reportDir` strings. Run `node <plugin-root>/scripts/gate.cjs REQUEST.json` with this plugin's actual root. The wrapper reaches TARGET/scripts/teardown-gate.cjs; never substitute the source checkout's helper. Report the actual verdict and evidence kind: this is an explicit CLI payload, not an automatic stop hook or proof of an interactive host session. Source/version/hash inspection alone never grants acceptance.
