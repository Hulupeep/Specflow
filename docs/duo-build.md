# Duo build

One native skill keeps your coding agent interactive and asks the other CLI to
review each meaningful batch. No message copying, daemon, per-batch commit or PR.

The review also supplies the next instruction to the builder: how the batch
advances the customer goal, what reasoning needs correcting, and up to three
prioritized actions with an owner and observable success. The builder follows
authorized actions in the same session and reports a reasoned response in the
next batch. Waiting for owner consent or CI does not stop independent work.

`review`, `resume` and `status` print this continuation; the durable copy is
`.specflow/duo/<id>/continuation.md`. The next reviewer receives the last three
validated directions and the builder's response. Run `status` before acting:
historical direction is labelled after source/evidence changes or failed review.
The pinned goal, acceptance and existing permission/release gates remain
authoritative. Advice cannot grant permission, and a completed batch is not a
completed goal. The interactive agent chooses commands; the helper never executes
reviewer-written shell text.

Malformed/interrupted peer responses are recorded and capped at three consecutive
failures, separately from the maximum three product repairs after the initial
validated review. Valid feedback clears only the response-failure streak. Resume
preserves earlier recorded budgets. Keep narrative notes in the excluded run
directory: editing a root `audit.md` still changes the source snapshot. The helper
does not exempt arbitrary source files or require identical tests to run for its
generated audit/continuation.

Both hosts follow the skill's continuation instructions. Claude's bound Stop hook
can request one corrective continuation when authorized builder work remains.
Codex has the explicit per-batch skill loop and cadence command; no background
daemon or equivalent automatic Codex Stop hook is claimed. Structural validation
cannot guarantee the quality of model reasoning; executed model demonstrations
and independent review are still required.

Install the local checkout into your project (after publication the equivalent is
`npx @colmbyrne/specflow update . --runtime codex`):

```sh
bash /path/to/Specflow/install-hooks.sh /path/to/project --runtime codex
# Or use --runtime claude-code
```

Reload your agent session so the new skill is indexed. Both provider CLIs must be
installed and authenticated (`claude auth status`, `codex login status`). The
helper uses native permission controls and never bypasses approvals. A CLI that
lacks the required flags is reported as blocked.

| Interactive agent | Issue | Feature | Resume |
|---|---|---|---|
| Claude Code | `/duo-build #905` | `/duo-build "Explain an employee’s leave balance"` | `/duo-build resume <run-id>` |
| Codex | `$duo-build #905` | `$duo-build "Explain an employee’s leave balance"` | `$duo-build resume <run-id>` |

These use native [Claude skills](https://code.claude.com/docs/en/skills) and
[Codex skills](https://developers.openai.com/codex/skills), installed by the
existing installer in `.claude/skills`, `.agents/skills` and `.codex/skills`.
The user runs just the skill. The interactive agent performs preparation and
implementation using the existing `spec-build` and `feature-build` paths; the
small helper only saves state, freezes a review copy and invokes the peer.

Codex builds → `claude -p` reviews with Read/Glob/Grep and allowlisted `gh` reads.
Claude builds → `codex exec` reviews with a read-only filesystem permissions
profile and network enabled for authenticated GitHub reads. Only the per-round
`gh-cache/` directory is writable, so `gh run view --log` can cache downloaded
job logs without gaining write access to product files. For repositories
without a GitHub origin it uses `--sandbox read-only` without enabling network.
The helper checks `gh --version` and `gh auth status` for GitHub repositories.
The peer can read issues, PRs, diffs, checks and raw job logs directly. It must
identify the remote head SHA and distinguish it from uncommitted local changes.
GitHub mutation commands are forbidden by the reviewer instructions; the local
sandbox does not reduce the token's GitHub scopes. Claude grants the listed GitHub read commands alongside its built-in safe reads. Missing required access returns blocked. Reviewer recursion is
forbidden in the prompt and rejected by the helper's inherited environment guard.
The Codex sandbox limits writes; as with native coding agents, the reviewer
instruction also forbids arbitrary provider commands and external mutations.
This is not an isolation service for hostile agents.

Denied optional parsing utilities do not discard a completed Claude review when
the raw transcript proves successful Read calls for every required artifact.
The denials and recovery receipts remain recorded. Missing receipts, denied
GitHub/artifact access and recursive-review attempts still block; no tool gains
additional permissions through this recovery.

The builder and reviewer read the same run `goal.md`, generated from an existing
goal/mission with a bounded objective, finish condition and authoritative task
references. Timebreez's ambition is accurate, explainable leave entitlements and
balances across arrangements/jurisdictions, traced to rules, facts, calculation
evidence and transactions. The goal must separately state current support and
unknowns. No supported jurisdictions are inferred from this ambition.

Records live at `.specflow/duo/<run-id>/`: `run.json`, `goal.md`, generated `audit.md`, and ordered
`round-NNN/` directories containing batch input, exact file/hash manifest, copied
source tree, staged/working diff, recent commit metadata, request, invocation,
raw peer stdout/stderr and structured findings. Explicit evidence paths include
ignored logs. No secret/environment files should be submitted as evidence.
Snapshots use Git's tracked and nonignored untracked file list, excluding
node_modules, duo run records and nested Claude worktrees (recorded in snapshot-policy.json); symlinks and
submodules block rather than silently reviewing different bytes. The source
must stay paused during review. Any source or evidence drift rejects acceptance.
The generated audit distinguishes actual peer calls from preflight-only failures
and records feedback and resolutions. It is excluded from product snapshots.
A root `audit.md` is ordinary source: updating it invalidates captures/reviews.

The builder reviews each completed implementation, diagnosis or verification
batch immediately, before its turn ends. It does not wait for the full goal or
unavailable live tests. The peer can review current evidence while retaining
those missing gates as blockers. Actionable feedback starts the next repair in
the same conversation; unchanged reviewed work needs no duplicate call.

For Claude, the native skill passes its expanded `CLAUDE_SESSION_ID` via
`--host-session` when starting/resuming. The installed Stop hook checks only
runs bound to that conversation. It redirects an unreviewed turn back to review
once, then reports an explicit blocker if the builder still has no fresh result.
It does not launch reviewers or take over runs. Other conversations, non-duo
sessions and reviewers are unaffected. Existing Claude runs must resume through
the updated skill to bind their session; installing files alone does not bind
an already-running conversation. Codex follows the same per-batch skill rule
and can run `node scripts/duo-cadence.cjs <run-id>`; no Codex turn-end hook is installed.

A run belongs to its goal rather than its initial CLI. Start in Claude, then
resume the same ID in Codex (or vice versa). The native skill claims the current
host and automatically selects the opposite reviewer. A recorded takeover rotates
the owner token; old tokens cannot review, capture, finish or release the run.
Review/capture and takeover share one operation lock. This governs cooperating
helpers; it cannot prevent an unrelated editor from modifying files. Snapshot
freshness checks still detect those changes.

The acceptance index references exact anchors in existing task and gate sources.
Each row is unverified, verified or blocked. The peer assesses submitted criterion
IDs with inspected evidence and checks that the index includes all required gates.
An accepted batch is distinct from a completed goal. `finish` requires all rows
verified, current source/evidence, peer-confirmed index completeness and no open
findings. Source changes conservatively invalidate older verification; do a final
review of the complete acceptance set. Unknown facts do not become supported
behaviour because a model agreed with another model.

Finding IDs persist across reviews, batch names and hosts. Every prior open
finding requires a peer disposition; closure needs a submitted builder resolution
and evidence. Progress is newly verified criteria, confirmed closures or new
observations backed by changed evidence. Two consecutive no-progress reviews stop
the run; an open repair cycle also has at most three repairs after its initial
review. Cosmetic edits, renamed batches and host switches cannot reset it.

The native skill runs these helpers for you (examples use Claude as the builder):

```sh
node scripts/duo-build.cjs check --builder claude-code
node scripts/duo-build.cjs start '#905' --builder claude-code --context context.json
# Keep the returned run ID and Owner session token.
node scripts/duo-build.cjs capture <id> --session <token> -- npm test -- --runInBand
node scripts/duo-build.cjs review <id> --session <token> --batch .specflow/duo/<id>/batch.json
node scripts/duo-build.cjs status <id>
# In a new Codex conversation, claim the same run explicitly:
node scripts/duo-build.cjs resume <id> --builder codex --takeover --reason 'User resumed in Codex'
# Use the newly returned token for subsequent operations.
node scripts/duo-build.cjs finish <id> --session <new-token>
```

Capture records argv, raw output, exit code and source hashes in the run directory.
Nonzero exits remain visible and cannot pass an execution gate. A peer may still
verify a separately observed fact from that output; the overall run remains
incomplete until the required gate passes. Source-mutating or
stale captures are rejected. Keep batch metadata inside the run directory too.
No reviewer suggestion is automatically executed as a shell command.

Legacy runs preserve their ID/history and budgets when claimed. They need an
acceptance index before finish can pass. `index <id> --session <token> --criteria
<array.json>` attaches it or adds a previously omitted required gate; it cannot
remove/change existing definitions. Pinned source changes need explicit user scope
reconciliation in a new linked run. No model may silently weaken acceptance.

`specflow duo-build` exposes the same helper subcommands. Use the native skill for
the single-invocation interactive workflow. Only Claude Code and Codex are supported;
other CLIs need tested adapters. See [the skill](../skills/duo-build/SKILL.md) for
context, criterion and batch shapes.

Review/resume status codes: 0 accepted batch, 1 changes required, 2 blocked. Only
`finish` establishes goal completion; it exits nonzero for incomplete goals.
Durable pending attempts survive interruption. Successful local completion is not
an implicit CI, merge, deployment or customer-validation claim.

## TypeSafe advice (optional)

The installed workflow includes a small TypeSafe HTTP adapter; Python and the
Python SDK are not required. Both coding CLIs still perform the build/review
loop. TypeSafe never approves a batch, closes a finding, skips a required test or
replaces the peer. Configuration without a key yields `missing_credentials`;
there is no implicit search for environment files.

Ask the interactive builder to configure TypeSafe for the current run. It writes
a JSON configuration and invokes the existing helper with its owner session:

```json
{"mode":"shadow","model":"jev-1.13.0","maxCalls":20,"envFile":".env.local"}
```

```sh
node scripts/duo-build.cjs typesafe RUN_ID --session OWNER_SESSION \
  --config typesafe-config.json --reason "Evaluate optional advice in shadow"
```

The configuration is explicit; `envFile` is optional, must have a protected
`.env` filename, and may be absolute. Prefer `TYPESAFE_API_KEY`; `TYPESAFE_API`
is supported when the primary key is absent/empty. Values never enter run
configuration or the peer environment. Keep credential files untracked.

Modes: `off` makes no calls; `shadow` saves advice without adding it to the peer
request; `advisory` shares the same saved advice with both agents and requires
an evidence-backed disposition for every flag. Default is shadow, with no
network call until credentials and selected inputs are available. A 0.8
confidence cutoff only highlights uncertain advice; it is not a calibrated
acceptance threshold or permission to act.

For each batch, the builder adds selected inputs using existing criterion IDs,
claim indices and paths in the frozen source/evidence manifest:

```json
{"typesafe":[{"criterion":"AC-1","claimIndex":0,"assertionPath":"tests/balance.test.js","evidencePaths":["evidence/balance-test.txt"],"repair":{"description":"Correct the scoped calculation","observation":"The rerun now observes 18 days"}}]}
```

`repair` is optional. Independent questions are batched into one request; the
adapter records omitted criteria, refuses missing/oversize/sensitive selections,
and retains explicit unavailable results. Never select raw production logs or
customer secrets. File filtering and credential-pattern checks are safeguards,
not a complete sensitive-data classifier: the builder must minimize inputs.

Records live under `.specflow/duo/RUN_ID/typesafe/round-NNN/`, excluded from the
product fingerprint. Advisory copies are explicitly included for the peer;
shadow records are absent from its tree and request. Read these records locally;
they may contain selected source and must not be published automatically.

Default maximum is 20 attempts per run, configurable from 1 to 100. Two consecutive
provider failures suppress further calls. An owner may submit `{"recover":true}`
with a recorded reason after resolving an outage; this clears only the failure
streak. Calls already consumed survive recovery, resume and host takeover. Budget
exhaustion disables advice while ordinary peer review continues. No automatic
retry occurs. A new model or question set requires a new evaluation/qualification;
changing a setting does not establish that it performs well.

### Private evaluation

The synthetic corpus is in `tests/fixtures/typesafe/corpus.json` in the source
checkout. It is evaluation tooling, not a requirement for installed target
projects. It contains 50 evidence/coverage cases and 20 repair cases, split by
originating task family. Controlled paired cases are exploratory and do not
establish production reliability. No archived peer baseline is invented.

```sh
node scripts/typesafe-eval.cjs live --corpus tests/fixtures/typesafe/corpus.json \
  --model jev-1.13.0 --env-file /absolute/path/.env.local
node scripts/typesafe-eval.cjs replay --corpus tests/fixtures/typesafe/corpus.json \
  --model jev-1.13.0 --output /private/directory/from/previous/run
node scripts/typesafe-eval.cjs qualify /private/directory/live-report.json \
  --mode shadow --reason "Reviewed measured errors and limitations"
```

The first command prints only a private report location. Default destination is
`~/.local/share/specflow/typesafe-evals/<timestamp>`; `--output` accepts a selected
private directory outside Git worktrees. Directories use 0700 and files 0600.
Reports remain until the operator deletes their selected report directory.
Never upload provider benchmarks without checking applicable publication
permission under TypeSafe's agreement. Public synthetic fixtures and simulated
transport tests are not provider benchmarks.

Qualification records describe an explicit operator decision; they do not
change workflow mode automatically. Reports separate probabilities from
confidence, include unavailable cases and split denominators, label replay,
and retain model/question/dataset identity. Required peer reviews are never
skipped to claim savings. TypeSafe review itself remains fallible.

The peer request lists `omittedPaths` by name whenever the snapshot excludes
`.env*`, private-key/credential filenames or identified production-log paths.
Their contents are withheld from the tree and both diffs. The peer must block
claims that depend on those missing contents; exclusion is not evidence of
acceptance. This rule applies even when TypeSafe is off.

Runtime verified for this integration: Node.js 22.19.0. The package and installed
helpers were exercised on that version; no Python runtime or SDK was involved.

## Instruction accountability (#149–#155)

Each validated next step receives a stable run-local ID. Every subsequent review
includes all outstanding instructions, their goal/criterion and observable success,
regardless of what the builder reports or which criteria its batch selects. A missing
`direction_response` is `unreported`, not a pre-call refusal. This deliberately replaces
#147's missing-response behavior; malformed reported responses remain invalid.

The reviewer must independently assess each instruction as `satisfied`,
`attempted_failed`, `not_attempted`, `unproven`, `externally_blocked`, or
`replaced_with_justification`. Missing visibility is unproven. Replacements require a
new linked step under the same criterion and an explicit reason; history remains.
Only current independently inspected evidence can establish satisfaction. A changed
source/evidence hash reopens historical satisfaction for reassessment.

Before a costly capture or peer request:

```sh
node scripts/duo-build.cjs eligibility RUN_ID --session OWNER_TOKEN --batch BATCH_JSON
```

This returns all known allowance/evidence blockers and unreported-response warnings.
Protocol-invalid replies retain raw output and leave validated progress intact.
They use the separate three-failure protocol limit, not a validated repair attempt.
The existing initial-plus-three-repair and two-no-progress limits remain. Exhaustion
preserves read-only inspection; renaming or switching hosts cannot replenish it.

Claude's bound Stop hook names outstanding builder work and requests one corrective
continuation; a second ignored stop reports the blocker. Codex uses the same skill,
ledger and finish gate, but has no equivalent supported turn-end hook here. Neither
host's prose instructions constitute an OS sandbox or guarantee arbitrary compliance.

## Stable runtime during a run

New runs save helper/skill bytes and hashes in `runtime/` under their excluded run
directory. The existing helper entrypoint selects those bytes for run operations.
Read `runtime/SKILL.md` when resuming. Status shows active, installed and staged
identities and warns about a goal guide naming a predecessor without modifying it.
Legacy runs report unknown historical runtime provenance.

The normal installer stages managed duo updates while unfinished runs exist, then
returns before modifying the installation. After those runs finish, rerun the same
installer and begin a new native conversation to load the new skill. Custom files,
concurrent installation/start operations and changed runtime bytes block replacement.
There is no hot reload, automatic migration of an active conversation, or hidden
budget refund. Application files and lockfiles retain normal freshness protection.

## What TypeSafe does

TypeSafe is an optional semantic evidence check. In advisory mode its findings go
to the independent reviewer; shadow mode records them for comparison. Neither mode
can decide that the goal is complete. The existing client uses the HTTP API; a new
Python dependency is unnecessary for this Node.js project.

For instruction advice, the batch explicitly selects `typesafe_actions` entries with
`instructionId`, `claim`, and `evidencePaths`. Prepare small JSON evidence containing
only `instructionId`, `criterion`, `snapshotHash` (the capture's `sourceAfter`),
`observation`, `expected`, `actual`, `exitCode`, and `sourceEvidence`. Keep the original
raw capture in the same batch for independent review. Candidate files must be current
and scoped to the instruction. Do not include credentials, tokens, mailbox content
or raw external logs. The helper withholds protected/unscoped candidates and records
omissions; no usable candidate means no paid call.

Two separate Choice questions ask whether the evidence concerns the requested action
and whether it establishes the claim. For example, passing unit tests may be unrelated
to a claim of working live Google consent. A relevant failed request can contradict a
success claim. Every advisory flag requires the peer's evidenced disposition.
Confidence reflects answer-distribution concentration, not guaranteed correctness.
The existing 0.8 disclosure heuristic is unchanged; it never grants acceptance.

Evaluation uses separately labelled broad and instruction evidence on the same
held-out families, retains errors/unavailable outcomes, and reports actual calls,
token usage and latency. Synthetic fixtures demonstrate workflow behavior, not
customer validation. Live native proof and provider results are reported separately
from deterministic tests that substitute a provider boundary.

For instruction advice, `sourceEvidence` must point to a submitted current
`duo_capture` record. Its stdout must be a small JSON object containing only
`status`, `providerReason`, `expected`, `actual`, `passed`, `failed`, `skipped`,
`success`, or `exitCode`, with scalar values. The helper copies these observed
fields and the capture's hash/exit into the model input. A prepared observation
without that actual source capture is insufficient input. Keep `providerReason`
to a safe enumerated code; never put mailbox content or credentials in it.

Run the native workflow proofs with `node scripts/duo-live-action-proof.cjs
claude-code complete` and the same command with `codex complete`. The driver
uses the installed skill and actual opposite CLI, introduces one controlled skipped
instruction, then lets the builder solve the problem from peer feedback. Variants
`claude-code stop`, `claude-code ignore` and `claude-code owner` check turn-end
interception, the bounded second ignored stop, and honest owner-only handoff. They use a synthetic executable product and retain private
raw records under `~/.local/share/specflow/evidence/duo-actions-149/`. A failed
attempt is retained; no adapter response is substituted in these live runs.

Keep prepared TypeSafe JSON under `.specflow/duo/<run-id>/`, alongside batch
metadata. Creating it there after a capture does not change the product snapshot.
The recorded source capture remains the evidence; the summary is only context.

An owner may explicitly cease a run without claiming it finished:
`node scripts/duo-build.cjs cease RUN_ID --session OWNER_TOKEN --reason "Owner requested end of this run"`.
This retains all criteria, findings and budgets, releases ownership, and makes
that run read-only. It permits a staged installer update between runs. Ceasing
is never permission to reset an exhausted goal or start an automatic successor.
A legacy installation without this command may invoke `specflow duo-build cease`
from the newer kit/package while keeping the old project runtime intact. This
metadata operation is handled by the current entrypoint, without migrating the
active run's code. Do not cease a run merely to install an update or avoid a limit;
it is an explicit owner decision.
