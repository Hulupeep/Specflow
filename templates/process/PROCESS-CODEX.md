# Running Specflow in Codex

Codex remains the interactive builder. Claude is the independent, read-only peer
invoked through `claude -p`; it does not edit code or launch another reviewer.
Use the installed `$duo-build` skill and [SPECIFICATION.md](SPECIFICATION.md).
The shared policy and loop paths govern depth in both hosts.

## Start and resume

```text
$duo-build #905
$duo-build "Prepare the next justified slice of this feature"
$duo-build resume <run-id>
```

The skill checks peer installation/authentication/access, loads the same goal,
current issue, repository instructions and acceptance as the peer, and retains
review evidence under `.specflow/duo/<run-id>/`. Missing peer access is a blocker,
never a verified result. The run pins its helper version; updates do not silently
change an active run.

## Spec-build: prepare only the next justified depth

Follow `QA/loops/spec-build.yaml` and the procedure in `SPECIFICATION.md`:

1. Discover from actual inputs. Capture a local thin backlog: behaviour, value,
   uncertainty and explicit non-goals. Local thin backlog capture may precede review.
2. Select the next slice and material dependency seams. Reuse shared decisions;
   leave future siblings thin. Contracted scope reviews only the decisions needed
   now, with a paper walkthrough when the selected decision has a UI flow.
3. **Gate A** governs selected-decision promotion and GitHub issue creation.
   Promotion needs its current scoped independent review receipt. GitHub issue
   creation still requires SHIP plus human approval; preserve
   `never_without_human`. A rejected plan cannot become an approved issue.
4. **Gate B/B.5** apply only to the selected build-ready slice and relevant seams:
   audit applicable artifacts, execute required checks, and retain the pre-flight
   evidence. UI acceptance requires its executable journey and real results.
5. Finish planning with a mixed-tier backlog and an explicit next decision. Only
   a selected slice with current verified build-ready evidence can be handed to
   `QA/loops/feature-build.yaml`. A depth label alone is insufficient.

Specification review has **initial + one repair**, shared across sessions and
run names for that issue/tier, with a **no-new-evidence** stop. Inspect the durable
allowance before another call. Persist failed attempts and unresolved findings;
“fixed as specified, not re-graded” is not acceptance. An exhausted allowance or
unresolved material finding needs the stated owner action, not another tick.

## Feature-build: implement and verify the selected slice

Require current readiness at entry and resume. Use the existing feature-build
rails: tracked issue, applicable contract, required executable test, grounded
expected values, then implementation. After each meaningful batch, collect
observations (or explicit none), resolve affected stale assumptions and capture
raw results. Freeze edits while the peer reviews that exact snapshot. Act on
its actionable findings within the existing Duo budget.

Retain the distinction between implemented, tested, merged and deployed. Existing
CI and release gates still apply. Skipped tests and a green unrelated job do not
prove the acceptance criterion. Human approval remains required for the path's
`never_without_human` actions, including publication or merge where specified.

## Optional scheduled continuation

A thread automation can re-enter the same saved run. Each invocation reads the
shared tier record, pending discoveries, findings, review allowance and raw
results before advancing an unblocked step. It must not restart the run or
review counter. Stop at the bounded finish condition, a human gate, missing
required evidence, no new evidence, or an exhausted allowance. An automation
schedule is not permission to keep reviewing.

Durable records support uncommitted changes; a commit per batch is unnecessary.
The live peer call and raw results establish what happened, not the automation's
narrative. Report outcome advanced, current blocker and next action.
