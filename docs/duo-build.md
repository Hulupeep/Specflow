# Duo build

One native skill keeps your coding agent interactive and asks the other CLI to
review each meaningful batch. No message copying, daemon, per-batch commit or PR.

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

Codex builds → `claude -p` reviews with only Read/Glob/Grep tools.
Claude builds → `codex exec --sandbox read-only` reviews. Reviewer recursion is
forbidden in the prompt and rejected by the helper's inherited environment guard.
The Codex sandbox limits writes; as with native coding agents, the reviewer
instruction also forbids arbitrary provider commands and external mutations.
This is not an isolation service for hostile agents.

The builder and reviewer read the same run `goal.md`, generated from an existing
goal/mission with a bounded objective, finish condition and authoritative task
references. Timebreez's ambition is accurate, explainable leave entitlements and
balances across arrangements/jurisdictions, traced to rules, facts, calculation
evidence and transactions. The goal must separately state current support and
unknowns. No supported jurisdictions are inferred from this ambition.

Records live at `.specflow/duo/<run-id>/`: `run.json`, `goal.md`, and ordered
`round-NNN/` directories containing batch input, exact file/hash manifest, copied
source tree, staged/working diff, recent commit metadata, request, invocation,
raw peer stdout/stderr and structured findings. Explicit evidence paths include
ignored logs. No secret/environment files should be submitted as evidence.
Snapshots use Git's tracked and nonignored untracked file list, excluding
node_modules, duo run records and nested Claude worktrees (recorded in snapshot-policy.json); symlinks and
submodules block rather than silently reviewing different bytes. The source
must stay paused during review. Any source or evidence drift rejects acceptance.

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
