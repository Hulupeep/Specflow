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

The helper pins goal/task/reference content. Resume reads it and past findings;
changed acceptance requires explicit reconciliation and a linked new run. Use
the same interactive runtime on resume. Keep the same batch ID for repairs:
initial review plus at most three repair rounds. Unchanged failed input blocks.
Optional improvements remain separate from evidenced acceptance/gate/risk findings.

Status always reports **Outcome advanced / Current blocker / Next action** and
run ID. `accepted` means peer acceptance within the batch's stated scope. Required
CI, release and human gates still apply; it never means merged or deployed.

For debugging, the skill calls these helpers automatically:

```sh
node scripts/duo-build.cjs check --builder codex
node scripts/duo-build.cjs start '#905' --builder codex --context .specflow/duo-context.json
node scripts/duo-build.cjs review <run-id> --batch .specflow/duo-batch.json
node scripts/duo-build.cjs resume <run-id>
```

`specflow duo-build` exposes the same helper subcommands. It does not start a new
interactive builder; use the native skill for the single-invocation workflow.
See [the skill](../skills/duo-build/SKILL.md) for the small context/batch JSON shapes.

Attempts are journaled before the provider starts, so an interrupted call remains
visible and its artifacts are not overwritten on retry. Resume rechecks pinned
acceptance and invalidates current acceptance if reviewed bytes changed. Helper
review/resume exit codes are 0 accepted, 1 changes required, 2 blocked.
