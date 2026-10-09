# How Specflow takes an idea to verified work

Specflow keeps the goal, acceptance and evidence visible while an agent builds.
Duo adds an independent model to check whether the work advances that goal and
whether the tests support the claims. Start in either Claude Code or Codex; the
agent you started stays in charge and calls the other CLI for review.

Read [SPECIFICATION.md](SPECIFICATION.md) for the executable procedure and
[PROCESS.md](PROCESS.md) for the gates. The loop paths are in `QA/loops/`.

## Start broad and deepen only the next decision

Think of a triangle: many possible future outcomes at thin depth, a smaller set
of decisions that need contracts, and one selected slice ready to build.

- **Thin:** record the customer behaviour, value, unknowns and non-goals. Local
  thin backlog capture may precede review. Do not generate full schemas,
  fixtures or simulations merely to fill a backlog.
- **Contracted:** select the next justified decisions and material dependency
  seams. Reuse shared contracts. An independent peer reviews this scope; include
  a paper walkthrough when a selected decision involves a UI flow.
- **Build-ready:** supply the selected slice's applicable acceptance checks and
  current gate evidence. A UI slice needs its executable journey and actual
  results. Future tickets remain thin.

A label cannot prove readiness. The shared policy checks the current issue and
hashed evidence at promotion, build, resume and finish. A changed assumption or
dependency can make affected readiness stale without stopping unrelated work.

## What happens when you invoke Duo

Use `/duo-build #905` in Claude Code or `$duo-build #905` in Codex. You can supply
a feature description instead; Duo reuses the preparation flow before building.
Resume with the same command followed by `resume <run-id>`.

The builder checks that the peer CLI can review, then reads the shared goal,
repository instructions and actual task acceptance. It discovers from real
inputs, selects a bounded objective and prepares the depth justified now.
Approved sandboxed experiments can resolve unknowns before production readiness;
their findings are observations, not production acceptance.

**Gate A** governs promotion of selected decisions and GitHub issue creation.
The independent review must accept the scope. GitHub issue creation still needs
SHIP plus human approval; preserve `never_without_human`. Local thin capture
can happen before that gate. A rejected plan cannot become an approved issue.

**Gate B/B.5** check only the selected build-ready slice and relevant seams.
The auditor verifies applicable requirement, contract, journey and test links;
the uplifter adds only missing artifacts. The simulator checks relevant routes
and gaps. Reuse existing evidence and explain N/A decisions. Do not copy this
whole procedure into every future ticket.

Specification review permits **initial + one repair**, shared across sessions
and hosts for the issue/tier. A **no-new-evidence** result stops automatic review.
Keep failed attempts, unresolved findings and the actual stop reason. An ungraded
fix is not an accepted spec; an exhausted allowance needs owner resolution.

## Build, review, learn

Before production implementation, require a tracked issue and current verified
build-ready evidence. Follow the existing feature-build rails: applicable
contract, executable acceptance test, grounded expected values, then code.
After a meaningful batch, capture raw results and collect discoveries or
explicit none. Feed changed facts back into affected specifications.

The builder pauses edits while the peer inspects that snapshot. The peer reads
relevant source and raw results, not just the builder's summary. A passing test
only helps if it checks the required behaviour and actually ran. Missing or
skipped required tests stay visible. The builder fixes evidenced problems and
re-reviews within Duo's existing budget.

**Gate C** retains the project's required CI and release checks. Peer acceptance
is not a merge, deployment or customer validation. Human approval remains
required for actions listed in the path's `never_without_human` section.

Planning finishes with a mixed-tier backlog and a clear next decision. A build
finishes when scoped acceptance and required gates are verified with no evidenced
blocker. Otherwise report the specific blocker and next action. Keep the saved
run and evidence so another session can resume without redoing or weakening the
work.
