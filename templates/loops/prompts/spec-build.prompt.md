# spec-build invocation prompt (template)

Fill the three values and paste into your agent, or set as a thread automation. Don't restate the path — point at it.

```
Goal:   <one-line done-state, e.g. prepare the next justified <X> slice and retain a thin future backlog>
Path:   QA/loops/spec-build.yaml
Inputs: { slug: <kebab-slug>, grounding_ref: <a file path, OR "this discovery thread above; no PRD exists yet"> }
Automation: continue in this invocation until the path's done_when is met, or until a true HITL/blocker is reached.

Load the path and follow it — do not restate it. In this invocation:
1. Render the path's progress_display (the phase map).
2. Locate the current stage from the committed artifacts the path names (PRDs/<slug>-prd.md, PRDs/<slug>-verdict.md, the issues).
3. Advance through every unblocked gate; persist the result after each gate to those artifacts (never only to chat).
4. Stop only at a true human gate, a `never_without_human` action, missing required evidence/input, exhausted repair/escalation, or done_when/handoff.

First invocation (no artifacts yet) → start at `discover`: distill grounding from grounding_ref into the problem + real constraints + the oracle to verify against, then continue until blocked or handoff.

Hard rules from the path: local thin backlog capture may precede review. GATE A governs selected-decision promotion and GitHub issue creation: require the scoped SHIP verdict and applicable falsification evidence bound to the current scope; get human approval before creating issues; never create tickets from a DO-NOT-SHIP PRD. Review uses the shared issue/tier allowance: initial + one repair, with a no-new-evidence stop across sessions. Only the selected build-ready slice receives applicable Gate B/B.5 checks and executable journey evidence; future work stays thin. Preserve never_without_human. Human signing is optional and policy-driven. The independent peer checks the evidence; writers cannot approve their own work.
```
