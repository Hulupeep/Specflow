# spec-build invocation prompt (template)

Fill the three values and paste into your agent, or set as a thread automation. Don't restate the path — point at it.

```
Goal:   <one-line done-state, e.g. prepare the next justified <X> slice and retain a thin future backlog>
Path:   QA/loops/spec-build.yaml
Inputs: { slug: <kebab-slug>, grounding_ref: <a file path, OR "this discovery thread above; no PRD exists yet"> }
Automation: thread automation — re-fire until the path's done_when is met.

Load the path and follow it — do not restate it. Each tick:
1. Render the path's progress_display (the phase map).
2. Locate the current stage from the committed artifacts the path names (PRDs/<slug>-prd.md, PRDs/<slug>-verdict.md, the issues).
3. Advance exactly ONE gate; persist the result to those artifacts (never only to chat).
4. Stop / escalate exactly as the path says. The next tick continues.

First tick (no artifacts yet) → start at `discover`: distill grounding from grounding_ref into the problem + real constraints + the oracle to verify against, then `draft` PRDs/<slug>-prd.md. Stop after that gate.

Hard rules from the path: local thin backlog capture may precede review. GATE A governs selected-decision promotion and GitHub issue creation: require the scoped SHIP verdict and applicable falsification evidence bound to the current scope; get human approval before creating issues; never create tickets from a DO-NOT-SHIP PRD. Review uses the shared issue/tier allowance: initial + one repair, with a no-new-evidence stop across sessions. Only the selected build-ready slice receives applicable Gate B/B.5 checks and executable journey evidence; future work stays thin. Preserve never_without_human. Human signing is optional and policy-driven. The independent peer checks the evidence; writers cannot approve their own work.
```
