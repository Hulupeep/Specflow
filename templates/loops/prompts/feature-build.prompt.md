# feature-build invocation prompt (template)

One per ready ticket. Fill `issue` and paste/automate. Run in the code repo.

```
Goal:   branch for #<issue> green on branch-protected CI, ready for review
Path:   QA/loops/feature-build.yaml
Inputs: { issue: <n> }
Automation: thread automation per ticket; interval matched to CI duration.

Load the path and follow it — do not restate it. Each tick:
1. Render the path's progress_display (the rail map + CI status).
2. Locate the current rail from the branch + CI state.
3. Advance exactly ONE rail; persist the diff + an evidence note (tests WHERE/WHICH/HOW MANY/SKIPPED, oracle for each asserted number, audit row per state mutation).
4. Read GATE C (branch-protected CI vs the real seeded backend). Green → stop at "ready for review". Red → repair (inline if fast, next tick if slow). Stop / escalate per the path.

Hard rules from the path: trust lives ONLY in Gate C — you and any swarm are muscle. Keep the slice <1000 lines (else propose a 4–8 slice split). Oracle-anchor every assertion. Never push / open PR / merge / --no-verify / override a contract without the human.
```
