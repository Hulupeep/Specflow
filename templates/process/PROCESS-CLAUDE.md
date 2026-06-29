# Running the WHOLE pipeline in Claude Code (the `Workflow` runtime)

One *path*, multiple *runtimes*. This doc is a **complete binding**: how to run the **entire** pipeline — spec-build *and* feature-build — on Claude Code using the `Workflow` tool. The sibling [`PROCESS-CODEX.md`](./PROCESS-CODEX.md) runs the **same path** end-to-end on Codex. You do not split a run across both; you pick the runtime and it does the whole thing.

- **The PATH** (what): `QA/loops/spec-build.yaml`, `QA/loops/feature-build.yaml` — runtime-agnostic stages/gates/repair/`done_when`. Single source of truth.
- **The BINDING** (how): this doc maps each stage of the path to a `Workflow` primitive.

**Where Claude shines:** the judgment fan-outs (adversary panels, persona simulation, pre-merge critique) — `Workflow` gives fresh-context independence + schema-typed verdicts natively. (Codex shines at long autonomous grind.) But *both* runtimes run *all* stages — strengths are not a split.

## Primitive map

| Path needs | Workflow primitive |
|---|---|
| fresh *window* (#49) | `agent(prompt, …)` — context seeded only by the prompt. **But the prompt is built by the author's code → this is the fresh window, NOT the independence guarantee.** |
| auditable seed = the independence *gate* (#50/N2) | **before spawning**, build the seed from a fixed 3-slot template `{artifact_paths, tool_grants, mandate_ref}` and **byte-check it** (reject extra slots / free text). A primed seed can't launch. *This*, not `agent()`, closes #50. |
| typed verdict (#51) | `agent(prompt, {schema})` — StructuredOutput, validated, retry-on-mismatch. Typed *shape*, not typed *truth* — refutation evidence is still a content rule. |
| perspective diversity (NOT a U2 substitute) | `parallel([…critics])` — distinct lenses. **Same model → shares every training blind spot; adds lens coverage, does NOT close U2.** |
| shared-training-blind-spot (U2) | a **human/oracle** pass (default) **or a genuinely different model family** for correctness-critical specs (auth/money/statutory/destructive/security). **Note: `model:` only picks Anthropic tiers (shared training) — not "different" enough; a different family means an external/cross-runtime call.** `parallel` lenses don't substitute. |
| fan-out over tickets/journeys | `pipeline(items, stage1, stage2, …)` |
| parallel mutation without conflicts | `agent(…, {isolation:'worktree'})` |
| judge-vs-muscle tiering | per-`agent` `model:` |

## Spec-build on Claude (Steps 0–5) — one Workflow

> **Illustrative sketch, not buildable as-is.** `buildSeed` / `assertSeedMatchesTemplate` / `isCorrectnessCritical` / `humanOrOraclePass` are named steps to be *defined* by the build tickets (#49/#50/#53), and `adversary-mandate@v1` is a versioned file to be *created*. This shows the control flow, not finished code.

```
phase('Discover');  const ground = await agent('read the real artifact + repo; return problem + oracle', {schema:GROUND})
phase('Draft');     const prd = await agent(`draft PRD from: ${JSON.stringify(ground)}`, {schema:PRD})
phase('Adversary');
// 1. Build the seed from the fixed template and BYTE-CHECK it (the independence gate, #50/N2). Abort if it carries anything but {artifact_paths, tool_grants, mandate_ref}.
const seed = buildSeed({artifact_paths:[prdPath], tool_grants:['read','grep','bash'], mandate_ref:'adversary-mandate@v1'})
assertSeedMatchesTemplate(seed)   // a primed seed cannot launch
// 2. Perspective panel (lens coverage — NOT a U2 substitute). 'persona-walkthrough' is the
//    experiential lens: walk real personas through the PRD's journeys on paper, CRITICAL gaps
//    with repro. Top-thinker work — never tier this lens down. (Second persona touch = B.5, vs tickets.)
const lenses = ['schema-reality','loophole-security','contradicts-contracts','persona-walkthrough']
const verdicts = await parallel(lenses.map(l => () => agent(seed.for(l), {schema:VERDICT})))
// 3. If correctness-critical (U2 trigger list) → a pass that does NOT share Claude's training.
//    NOTE: `model:` only selects Anthropic tiers (opus/sonnet/haiku) — same family, SHARED blind spots.
//    So within this runtime U2 is NOT closeable by `model:`. Satisfy it by either:
//      (a) a HUMAN/ORACLE leg (default), or
//      (b) handing the correctness check to ANOTHER runtime (the Codex/OSS binding) — a genuinely
//          different model family. This is a reason the two runtimes coexist: the shared-blind-spot
//          guard is exactly where Claude calls out, it can't self-certify.
const u2 = isCorrectnessCritical(prd) ? [await humanOrOraclePass(seed)] : []   // NOT agent({model:'sonnet'})
const fatals = [...verdicts, ...u2].filter(Boolean).flatMap(v => v.fatal)
phase('GateA');  // write the COMMITTED verdict file (refutation evidence included) BEFORE tickets; SHIP iff 0 qualifying FATAL + human confirm
await agent(`write PRDs/<slug>-verdict.md (committed, pre-tickets) from: ${JSON.stringify({verdicts, u2})}`, {schema:VERDICT_FILE})
phase('Tickets');   await agent('hardened PRD → specflow tickets', {schema:TICKETS})
// GATE B: run the SCRIPTS (specflow graph + audit + gh enumerator) — model-free, not an agent.
phase('Preflight'); await parallel(personas.map(p => () => agent(`walk ${p} through each ticket; CRITICAL gaps`, {schema:SIM})))
```

## Feature-build on Claude (Step 6→7) — one Workflow, parallel slices

```
await pipeline(readyTickets,
  t => agent(`#${t}: rails 1-4 (ticket→contract→real-backend e2e→oracle-anchor)`, {schema:RAILS, isolation:'worktree'}),
  (r,t) => agent(`#${t}: rail 5 — smallest slice <1000 lines that passes`, {isolation:'worktree'}),
  (_,t) => agent(`#${t}: pre-merge critic on the diff (advisory)`, {schema:REVIEW}))   // muscle, not a gate
// GATE C: branch-protected CI vs the real seeded backend DECIDES merge — external, never a workflow agent.
```

Slices run concurrently in their own worktrees — this is the "cut wall-clock" lever, native and deterministic.

## Hard rules (same as every runtime)

- **Muscle never self-approves.** A workflow may *run* tests; **Gate C (external CI) decides merge.**
- **Gate A is one independent verdict** (the panel), written to a committed pre-tickets file.
- **The YAML path wins** if this binding ever drifts from it.

## Caveats

- **Claude-only.** `Workflow` is not in Codex — use `PROCESS-CODEX.md` there. Same path, different binding.
- **`model:` is Anthropic tiers** (opus/sonnet/haiku); OSS-on-GPU muscle is a Codex-runtime concern.
- **Opt-in, token-heavy.** A workflow is one fan-out phase; the full pipeline is several chained workflows with a human gate between — matching the gate discipline.
- **Binding unproven until a real run is captured.** Everything here assumes the `Workflow` API (`agent`/`schema`/`parallel`/`pipeline`/`isolation:'worktree'`/`model:`) behaves as described — that is **not verifiable from the repo**. Treat this binding as a *design*, not a proof, until a real Workflow run on a small slice is captured and checked. Same status as any spec claim: not evidence until it runs against reality.
