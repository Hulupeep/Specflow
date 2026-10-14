# #201 binding repair — 2026-10-14

The legacy preparation blocker is resolved. PR #200 / #199 added explicit,
history-preserving migration after #203. The original run
`1791750889080-6f95244d` retained its runtime archive, all four historical reviews,
findings and counters. A fresh round 5 failed because the reviewer omitted the
required PRD read; recorded diagnosis and one bounded recovery produced native
independent acceptance of all five BIND rows in round 6. Preparation finished,
and the supported promotion helper established build-ready evidence for #201.
No historical response was retroactively accepted and no allowance was reset.

Implementation is tracked by Duo run `1791967858404-3697cc28` and PR #202.
Q1 and Q2 were reproduced with failing tests before production changes. The
candidate binds baseline/verification evidence to its governing contract,
workspace and verifier, detects mutation, records holdout consumption before
execution, and retains the verified Git tree without commit hooks. Legacy
unbound after-results cannot authorize KEEP or an automatic holdout retry.

The executable acceptance suite is `tests/contracts/improve-core.test.js`.
Required final gates remain the full canonical suite, current independent Duo
implementation acceptance and publication/privacy validation. GitHub PR status
and its final validation record state whether these gates completed; this file
is not itself a release or acceptance receipt. Gain semantics (#178), backend
journeys (#180), broader isolation (#176) and overnight autonomy remain separate.
