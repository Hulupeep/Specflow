# Running Specflow in Codex

The interactive builder and every generative role use the selected host. The
normal critic is a **fresh-native** read-only process on that host; it may use
the same model family and is never called Duo-verified. Explicit Duo remains an
opt-in cross-family workflow with its exact missing-peer blocker and no fallback.
The shared policy and loop paths govern depth, checks and human boundaries.

## Start and resume

Install the selected runtime, then use the public CLI from the Specflow package:

```bash
npx @colmbyrne/specflow init . --runtime codex
npx @colmbyrne/specflow review bind .specflow/specification/selected.json
# Bind before running the record's declared gates. Keep existing findings/history.
npx @colmbyrne/specflow specification gate .specflow/specification/selected.json GATE_ID
npx @colmbyrne/specflow review start '#905' --builder codex --context prep-context.json
npx @colmbyrne/specflow review review RUN_ID --session OWNER_SESSION --batch batch.json
npx @colmbyrne/specflow review resume RUN_ID --session OWNER_SESSION
```

`prep-context.json` names the shared goal, authoritative task, criteria and
`specification:{record:".specflow/specification/selected.json",targetTier:"build-ready"}`
with `workKind:"preparation"`. Use the existing specification and batch schema,
not a second inventory. Submit current raw gate evidence in the batch. After a
passing scoped review, finish that run and use `specification promote` as usual.

The managed installed profile authorises normal native review. Custom, stale or
contradictory routing produces an explicit repair diagnostic; a caller flag or
scope hash cannot select a weaker method. Stronger project policy
`profile.requiredReviewMethod:"duo"` requires explicit Duo. A changed selection
needs new bound scope, gates and review; old receipts remain historical.

Explicit Duo uses $duo-build and keeps the other CLI requirement:

```text
$duo-build #905
$duo-build resume <run-id>
```

Both methods retain the existing `.specflow/duo/<run-id>/` storage, frozen source,
actual content-access receipts, findings, owner session, progress and pinned
helpers. Status names the method. A takeover cannot change the pinned native
host/method, and the Duo facade cannot relabel a fresh-native run. Simulated
protocol fixtures cannot establish live readiness. No Workflow API is assumed.

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

Specification review has **continue on verified progress with bounded diagnosis**, shared across sessions and
run names for that issue/tier, with a **no-new-evidence** diagnosis guard. Inspect the durable
allowance before another call. Persist failed attempts and unresolved findings;
“fixed as specified, not re-graded” is not acceptance. A repeated failure after evidenced recovery requires a concrete blocker report.

## Feature-build: implement and verify the selected slice

Require current readiness at entry and resume. Use the existing feature-build
rails: tracked issue, applicable contract, required executable test, grounded
expected values, then implementation. After each meaningful batch, collect
observations (or explicit none), resolve affected stale assumptions and capture
raw results. Freeze edits while the peer reviews that exact snapshot. Act on
its actionable findings under the existing progress and explicit-limit policy.

Retain the distinction between implemented, tested, merged and deployed. Existing
CI and release gates still apply. Skipped tests and a green unrelated job do not
prove the acceptance criterion. Human approval remains required for the path's
`never_without_human` actions, including publication or merge where specified.

## Optional scheduled continuation

A thread automation can re-enter the same saved run. Each invocation reads the
shared tier record, pending discoveries, findings, review allowance and raw
results before advancing an unblocked step. It must not restart the run or
review counter. Stop at the bounded finish condition, a human gate, missing
required evidence, repeated failure after diagnosis, or an explicit checkpoint. An automation
schedule is not permission to keep reviewing.

Durable records support uncommitted changes; a commit per batch is unnecessary.
The live peer call and raw results establish what happened, not the automation's
narrative. Report outcome advanced, current blocker and next action.
