# Example — GATE D for the TT-ROLLBACK epic (running as a goal)

A filled invocation of [`../prompts/gate-d.prompt.md`](../prompts/gate-d.prompt.md). Fired **after** the tt-rollback slices — each built via feature-build ([`tt-rollback.feature-build.md`](tt-rollback.feature-build.md)) — have **merged to main**. Per-issue feature-build runs ended before merge; this is its **own** invocation, against the merged tree. Run in the code repo. Numbers are illustrative.

```
Goal:   GATE D green for epic #560 (TT-ROLLBACK) — persona-walk the MERGED tree; epic cannot close until evidence/disposition gate passes
Path:   QA/loops/feature-build.yaml → epic_gate (GATE_D)
Inputs: { epic: 560, hops: PRDs/tt-rollback-hops.md, env: <the same real seeded backend tier GATE C named> }

Follow the epic_gate spec — do not restate it. The run:
1. RECOMPUTE seams from final ticket state (each ticket's writes/reads); journey map := the hop tables in PRDs/tt-rollback-hops.md + the seam-derived hops, MATERIALIZED into teardown format under gate-d/560/ (each hop a "- J:" entry; findings per hop; evidence per finding).
2. Walk every hop against merged main on the named env. Value-bearing hops (a reverted balance, a rewound external_id_mapping) attach the oracle re-read output itself (.txt/.json or a screenshot showing the value) — a decorative screenshot does not satisfy a value hop.
3. Every red hop gets a DISPOSITION: `bug` (the last-merged writer of the seam reopens; name the seam pair + tiebreak) or `stale-oracle` (an amendment to PRDs/tt-rollback-hops.md — follow the configured amendment/provenance path; you never reconcile your own oracle).
4. PROOF: node scripts/teardown-gate.cjs check-gate-d gate-d/560/ must pass. If this epic's signoff policy requires signatures, STOP and present for signing — never sign yourself, never close the epic on a red GATE D.
```

## Why this gate exists (stated honestly)

Every tt-rollback slice was green on GATE C — but the rollback rules **cross slices**: delete-created-only, revert-updated, rewind-mappings, and write-audit-event all touch the same `import_batches` / `external_id_mappings` / versions surface. Per-slice green is **structurally blind** to those seams, because the decomposition cut *across* them. **Precedent:** timebreez #673 — 3 cross-slice oracle conflicts on `/my-leave` and `/dashboard`, invisible to 22/22-green GATE C runs. That is the class of bug GATE D is here to catch.

## What a correct run looks like

1. **Materializes `gate-d/560/`** from `PRDs/tt-rollback-hops.md` + the recomputed seams — a journey map in **teardown format**, not a fresh map it invented.
2. **Walks every hop** on merged main against the real seeded backend. The "balance after revert" hop attaches the **recalculated value** (an oracle re-read), not a screenshot of a page.
3. **Red hops are dispositioned** — a wrong reverted balance becomes a `bug` reopened on the last-merged writer of that seam; a genuinely-changed expectation becomes a `stale-oracle` amendment with a durable provenance trail and optional countersign when policy requires it.
4. **`teardown-gate.cjs check-gate-d` passes.** Only then can the epic close; signatures are only required when the Gate D policy says so.

## Red flags that the run is wrong

- It walks hops with **no passing `teardown-gate check-gate-d`**, or it **signs** anything itself.
- A value hop with only a **decorative screenshot** — no oracle re-read attached.
- It **reconciles its own oracle** (edits the hops file and proceeds) instead of raising a `stale-oracle` amendment through the configured policy.
- It **closes the epic on a red GATE D**, or on an unsigned Gate D when signoff policy requires signatures.
