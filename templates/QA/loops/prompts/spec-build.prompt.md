# spec-build invocation prompt (template)

Fill the three values and paste into your agent, or set as a thread automation. Don't restate the path — point at it.

```
Goal:   <one-line done-state, e.g. SHIP the <X> spec — hardened PRD + audited, journey-contracted tickets>
Path:   QA/loops/spec-build.yaml
Inputs: { slug: <kebab-slug>, grounding_ref: <a file path, OR "this discovery thread above; no PRD exists yet"> }
Automation: continue in this invocation until the path's done_when is met, or until a true HITL/blocker is reached.

Load the path and follow it — do not restate it. In this invocation:
1. Render the path's progress_display (the phase map).
2. Locate the current stage from the committed artifacts the path names (PRDs/<slug>-prd.md, PRDs/<slug>-verdict.md, the issues).
3. Advance through every unblocked gate; persist the result after each gate to those artifacts (never only to chat).
4. Stop only at a true human gate, a `never_without_human` action, missing required evidence/input, exhausted repair/escalation, or done_when/handoff.

First invocation (no artifacts yet) → start at `discover`: distill grounding from grounding_ref into the problem + real constraints + the oracle to verify against, then continue until blocked or handoff.

Hard rules from the path: GATE A is a committed SHIP verdict plus a PASS/PASS WITH STIPULATIONS falsification artifact bound to the current PRD hash — no tickets before it; get human approval before creating issues; never create tickets from a DO-NOT-SHIP PRD. Human signing is optional and policy-driven. The writers are muscle; trust lives in the one hostile critic, not their agreement.
```
