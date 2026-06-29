# gate-d invocation prompt (template)

One per wave/epic, fired **after that wave/epic's slices have merged** (per-issue feature-build runs end before merge — this is its own invocation). Run in the code repo against merged main.

```
Goal:   GATE D green for epic #<n> — persona-walk the MERGED tree; epic cannot close until signed
Path:   QA/loops/feature-build.yaml → epic_gate (GATE_D)
Inputs: { epic: <n>, hops: PRDs/<slug>-hops.md, env: <the same real seeded backend tier GATE C names> }

Follow the epic_gate spec — do not restate it. The run:
1. RECOMPUTE seams from final ticket state (writes/reads declarations); journey map :=
   the hop tables + seam-derived hops, MATERIALIZED into teardown format under
   gate-d/<epic>/ (each hop a "- J:" entry; findings per hop; evidence per finding).
2. Walk every hop against merged main on the named env. Value-bearing hops attach the
   oracle re-read output itself (.txt/.json or a screenshot showing the value) —
   a decorative screenshot does not satisfy a value hop.
3. Every red hop gets a DISPOSITION: `bug` (the last-merged writer of the seam reopens;
   name the seam pair + tiebreak; shared-module case names the module commit) or
   `stale-oracle` (an amendment to the hops artifact through the configured
   amendment/provenance path; you may never reconcile your own oracle).
4. PROOF: `node scripts/teardown-gate.cjs check-gate-d gate-d/<epic>/` must pass.
   Human signatures are required only when the Gate D signoff policy marks them required.
   STOP and present for signing only in that configured mode — never sign yourself, never
   close the epic on a red Gate D.
```
