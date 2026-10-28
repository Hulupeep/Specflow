# Running Specflow in Claude Code

The interactive builder and every generative role use the selected host. The
normal critic is a **fresh-native** read-only process on that host; it may use
the same model family and is never called Duo-verified. Explicit Duo remains an
opt-in cross-family workflow with its exact missing-peer blocker and no fallback.
The shared policy and loop paths govern depth, checks and human boundaries.

## Start and resume

Install the selected runtime, then use the public CLI from the Specflow package:

```bash
npx @colmbyrne/specflow init . --runtime claude-code
npx @colmbyrne/specflow review bind .specflow/specification/selected.json
# Bind before running the record's declared gates. Keep existing findings/history.
npx @colmbyrne/specflow specification gate .specflow/specification/selected.json GATE_ID
npx @colmbyrne/specflow review start '#905' --builder claude-code --context prep-context.json
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

Explicit Duo uses /duo-build and keeps the other CLI requirement:

```text
/duo-build #905
/duo-build resume <run-id>
```

Both methods retain the existing `.specflow/duo/<run-id>/` storage, frozen source,
actual content-access receipts, findings, owner session, progress and pinned
helpers. Status names the method. A takeover cannot change the pinned native
host/method, and the Duo facade cannot relabel a fresh-native run. Simulated
protocol fixtures cannot establish live readiness. No Workflow API is assumed.

## One invocation, depth as needed

Follow `QA/loops/spec-build.yaml` and `SPECIFICATION.md`:

1. Inspect real inputs. Local thin backlog capture may precede review.
   Thin records describe behaviour, value, unknowns and non-goals, without full
   schemas, fixtures or simulations for future work.
2. Select the next slice and material seams. Reuse decisions already supported
   by current evidence; future siblings remain thin. Contracted review covers
   only the selected decisions, plus a paper walkthrough for relevant UI flows.
3. **Gate A** governs selected-decision promotion and GitHub issue creation.
   Promotion requires the live scoped peer receipt. GitHub issue creation still
   requires SHIP and human approval. Preserve `never_without_human`; do not
   publish tickets from a rejected PRD.
4. **Gate B/B.5** apply only to the selected build-ready slice and relevant seams.
   Prepare applicable acceptance checks, execute required gates and retain
   pre-flight evidence. A UI slice needs its executable journey and real results.
5. Planning can finish with a mixed-tier backlog and the next justified decision.
   Hand only a currently verified build-ready slice to
   `QA/loops/feature-build.yaml`; labels alone cannot grant readiness.

The specification review allowance is **continue on verified progress with bounded diagnosis**, retained across
hosts and sessions for the issue/tier, with a **no-new-evidence** diagnosis guard. Keep failed
attempts and unresolved findings. A changed agent, renamed run or ungraded fix
cannot restore the allowance or turn a blocked decision into acceptance.

## Build and collect evidence

Follow the existing feature-build rails for the selected ready slice. After a
meaningful implementation, diagnosis or verification batch, collect discoveries
or explicit none and update affected assumptions. Freeze source edits during
review. The selected fresh critic independently inspects the snapshot and raw results and returns
accepted, changes required or blocked. Claude repairs actionable findings and
requests review under the existing progress and explicit-limit policy, preserving previous evidence.

Explicit Duo still requires the opposite-family CLI peer; ordinary role review
uses the trusted selected host in a new read-only process. No speculative Workflow API or multi-agent fan-out is required. Required
CI, privacy, permission, human approval and release gates remain authoritative.
Skipped or absent tests do not establish acceptance; separate implemented,
tested, merged and deployed in the result.

An optional automation resumes the same run, checks the durable allowance and
diagnoses no new evidence and stops on repeated failure, missing inputs, a human gate or an explicit checkpoint. It never
uses a new tick to restart a review. A commit per batch is unnecessary; retain
the exact uncommitted snapshot and evidence. Report outcome advanced, current
blocker and next action.
