# Dependency revalidation after actual teardown

The completed once-only #217 fixture KEEP could be read directly from its
DurableStore after deleting Git/core working files, but #216 service.inspect
failed because readProfile required the now-removed repository directory.
This is an observed historical_read_unavailable branch, not a hypothesis.

scripts/improve-profiles.cjs now permits a missing repo only for authorised
read lookup. Current grants, private record ownership, schema and revision
integrity still apply. Existing paths are still checked. Registration,
preflight and execution remain strict; no directory is recreated by a read.
Two failing-first regressions cover removed-source history, viewer scope,
denied principals, revoked read and refused registration/execution.

This changes the consumed dependency hash, so the old readiness receipt is
historical. Reexecute the current preparation/API gate, rebind the producer's
tested capability to that actual result and independently revalidate promotion.
The preparation design/persona routes and original acceptance are unchanged.
Then review all current implementation criteria with full canonical and real
live transport execution, plus separate original archive verification. Do not
rerun the consumed deciding holdout. See RESULTS.md for that actual original
cycle and post-terminal correction distinction.

Preserve original preparation run1792748966901-605c764f and implementation
run1792749594675-cc229df9, including all four operations, resolved findings and
outstanding final core/full/live instructions. The latter was explicitly ceased
for changed dependency/readiness. No allowance ceiling was reached and no
successor is being created to evade one. Prior closed findings are historical;
all current implementation rows need current independent review.
