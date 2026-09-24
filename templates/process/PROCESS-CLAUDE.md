# Running Specflow in Claude Code

Claude Code remains the interactive builder. Codex is the independent,
read-only peer invoked through `codex exec`; it does not edit code or launch
another reviewer. Use the installed `/duo-build` skill and
[SPECIFICATION.md](SPECIFICATION.md). The same shared policy and loop paths
apply when starting in Codex.

## Start and resume

```text
/duo-build #905
/duo-build "Prepare the next justified slice of this feature"
/duo-build resume <run-id>
```

The skill loads the shared goal, actual issue, repository instructions and
acceptance. It checks Codex installation, authentication and review access.
Missing access is a blocker, never duo verification. The helper retains state,
raw captures and peer findings under `.specflow/duo/<run-id>/`; it binds the
Claude conversation to the saved run for its Stop check. An active run keeps its
pinned runtime. Starting a new run cannot reset an exhausted allowance.

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

The specification review allowance is **initial + one repair**, retained across
hosts and sessions for the issue/tier, with a **no-new-evidence** stop. Keep failed
attempts and unresolved findings. A changed agent, renamed run or ungraded fix
cannot restore the allowance or turn a blocked decision into acceptance.

## Build and collect evidence

Follow the existing feature-build rails for the selected ready slice. After a
meaningful implementation, diagnosis or verification batch, collect discoveries
or explicit none and update affected assumptions. Freeze source edits during
review. Codex independently inspects the snapshot and raw results and returns
accepted, changes required or blocked. Claude repairs actionable findings and
requests review within the existing Duo budget, preserving previous evidence.

Same-family role changes or extra lenses do not replace the independent CLI
peer. No speculative Workflow API or multi-agent fan-out is required. Required
CI, privacy, permission, human approval and release gates remain authoritative.
Skipped or absent tests do not establish acceptance; separate implemented,
tested, merged and deployed in the result.

An optional automation resumes the same run, checks the durable allowance and
stops on no new evidence, missing inputs, a human gate or exhaustion. It never
uses a new tick to restart a review. A commit per batch is unnecessary; retain
the exact uncommitted snapshot and evidence. Report outcome advanced, current
blocker and next action.
