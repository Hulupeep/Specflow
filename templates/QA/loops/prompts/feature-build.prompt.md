# feature-build invocation prompt (template)

One per ready ticket. Fill `issue` and paste/automate. Run in the code repo.

```
Goal:   branch for #<issue> green on branch-protected CI, ready for review
Path:   QA/loops/feature-build.yaml
Inputs: { issue: <n> }
Automation: continue in this invocation until ready for review, or until a true HITL/external blocker is reached.

Load the path and follow it — do not restate it. In this invocation:
1. Render the path's progress_display (the rail map + CI status).
2. Locate the current rail from the branch + CI state.
3. Advance through every unblocked rail; persist the diff + an evidence note after each rail (tests WHERE/WHICH/HOW MANY/SKIPPED, oracle for each asserted number, provenance source → transform → API/input → output → assertion, audit row per state mutation).
4. After implementation, run the provenance rail: reject hard-coded business literals and mock/fake/stub sources on the tested path unless contract-allowed.
5. If branch-protected CI has not been triggered, stop at the human CI handoff. After the human pushes/opens the PR or otherwise triggers CI, read GATE C. Green → stop at "ready for review". Red → repair (inline if fast, next tick if slow). Stop / escalate per the path.

Hard rules from the path: trust lives ONLY in Gate C — you and any swarm are muscle. Keep the slice <1000 lines (else propose a 4–8 slice split). Oracle-anchor every assertion and source-prove every value-bearing output after code. Never push / open PR / merge / --no-verify / override a contract without the human.
```
