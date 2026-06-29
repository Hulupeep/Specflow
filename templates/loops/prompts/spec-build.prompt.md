# spec-build invocation prompt (template)

Fill the three values and paste into your agent, or set as a thread automation. Don't restate the path — point at it.

```
Goal:   <one-line done-state, e.g. SHIP the <X> spec — hardened PRD + audited, journey-contracted tickets>
Path:   QA/loops/spec-build.yaml
Inputs: { slug: <kebab-slug>, grounding_ref: <a file path, OR "this discovery thread above; no PRD exists yet"> }
Automation: thread automation — re-fire until the path's done_when is met.

Load the path and follow it — do not restate it. Each tick:
1. Render the path's progress_display (the phase map).
2. Locate the current stage from the committed artifacts the path names (PRDs/<slug>-prd.md, PRDs/<slug>-verdict.md, the issues).
3. Advance exactly ONE gate; persist the result to those artifacts (never only to chat).
4. Stop / escalate exactly as the path says. The next tick continues.

First tick (no artifacts yet) → start at `discover`: distill grounding from grounding_ref into the problem + real constraints + the oracle to verify against, then `draft` PRDs/<slug>-prd.md. Stop after that gate.

Hard rules from the path: GATE A is a committed SHIP verdict — no tickets before it; get human approval before creating issues; never create tickets from a DO-NOT-SHIP PRD. The writers are muscle; trust lives in the one hostile critic, not their agreement.
```
