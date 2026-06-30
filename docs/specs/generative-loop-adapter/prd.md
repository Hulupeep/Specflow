# Generative Loop Adapter PRD

## Job To Be Done

When Specflow reaches a generative loop stage, the operator needs the loop to
continue through an approved local agent runtime instead of stopping for manual
copy/paste, while still preserving Specflow's contract: durable state, explicit
budgets, strict tool permissions, reproducible evidence, and hard human gates.

## Product Positioning

This is not a hosted agent fleet and not a new model provider. It is a tightly
controlled adapter layer that lets `specflow run` delegate generative work to an
operator-owned CLI runtime such as Claude Code or Codex, including subscription
backed usage where the runtime already supports it.

The product promise is:

- Specflow owns the loop contract, gates, ledger, and stop policy.
- The adapter owns one generative turn against a configured local CLI.
- Human-controlled operations remain blocked by `never_without_human` even if
  the underlying CLI could perform them.

## Grounded CLI Facts

Local command help was checked on 2026-06-30:

- `claude -p` / `claude --print` runs Claude Code non-interactively.
- Claude Code exposes `--output-format json|stream-json`, `--input-format`,
  `--resume`, `--continue`, `--session-id`, `--permission-mode`,
  `--allowedTools`, `--disallowedTools`, `--max-budget-usd`, `--model`,
  `--fallback-model`, and `--settings`.
- `codex exec` runs Codex non-interactively.
- Codex exec exposes `--json`, `--output-schema`, `--model`, `--profile`,
  `--sandbox`, `--ask-for-approval`, `--cd`, `--add-dir`,
  `--output-last-message`, and `codex exec resume`.

## Problem

The loop runtime ticket correctly stops at `agent_action_required` for
generative stages. That is honest, but it still leaves the operator driving the
loop by hand. For high-friction stages such as PRD drafting, adversary repair,
ticket uplift, and simulation application, the next meaningful improvement is to
execute the generative stage under a controlled adapter.

The danger is that this can easily become an unsafe autonomous wrapper:

1. The adapter might let an agent push, open PRs, create issues, or override
   contracts.
2. The adapter might lose provenance by keeping output only in terminal scrollback.
3. The adapter might run without cost, iteration, or timeout budgets.
4. The adapter might treat CLI success as Specflow success without rerunning the
   required gates.

## Non-Goals

- Do not create a hosted scheduler or background daemon.
- Do not require API keys when the selected CLI can use the operator's existing
  subscription/authentication.
- Do not bypass Claude/Codex native auth, sandbox, or permission systems.
- Do not allow adapters to perform `never_without_human` actions.
- Do not mark a Specflow gate green from model output alone.

## Requirements

- REQ-01 (MUST): Add an optional generative adapter interface to `specflow run`
  with provider IDs `claude-print` and `codex-exec`.
- REQ-02 (MUST): Require an adapter policy file before generative execution. The
  policy must declare provider, command, allowed tools, denied tools, sandbox or
  permission mode, timeout, max iterations, max budget where supported, output
  format, and transcript path.
- REQ-03 (MUST): For Claude, support `claude -p` with JSON or stream-json output,
  explicit permission/tool controls, session resume, and `--max-budget-usd`
  when configured.
- REQ-04 (MUST): For Codex, support `codex exec` with JSONL output, sandbox and
  approval controls, profile/model selection, output schema where configured,
  and resume support.
- REQ-05 (MUST): Persist every adapter invocation to the loop ledger with command
  argv, provider, session ID when available, output artifact path, exit code,
  timeout/budget status, and parsed final response.
- REQ-06 (MUST): After a generative stage returns, rerun the owning Specflow gate
  or verifier before advancing the run contract.
- REQ-07 (MUST): Block and surface any attempted action listed in
  `never_without_human`, even if the underlying CLI exits successfully.
- REQ-08 (MUST): Document how operators with Claude Max/Pro or Codex Pro/Max use
  existing CLI authentication without storing subscription secrets in Specflow.
- REQ-09 (SHOULD): Allow adapter dry-run mode that prints the exact command,
  prompt file, policy, and expected artifacts without invoking the provider.

## Adapter Policy Contract

```yaml
adapter_policy:
  id: local-claude-safe
  provider: claude-print
  command: claude
  args:
    - -p
    - --output-format
    - stream-json
    - --permission-mode
    - default
  model: sonnet
  max_budget_usd: 3.00
  timeout_seconds: 900
  max_iterations: 1
  allowed_tools:
    - Read
    - Grep
    - Glob
  denied_tools:
    - Bash(git push *)
    - Bash(gh pr create *)
    - Bash(gh issue create *)
  transcript_path: .specflow/runs/<slug>/adapter/claude-<stage>.jsonl
  output_path: .specflow/runs/<slug>/adapter/claude-<stage>-final.md
  never_without_human:
    - git push
    - open PR
    - merge
    - --no-verify
    - override contract
```

## Acceptance Criteria

- AC-1: Given an adapter policy for Claude, `specflow run` invokes `claude -p`
  only for a stage marked `agent_action_required`, writes transcript and final
  output artifacts, and appends a ledger entry.
- AC-2: Given an adapter policy for Codex, `specflow run` invokes `codex exec`
  with configured sandbox/approval/output controls and writes the same ledger
  fields.
- AC-3: If the adapter output modifies a spec or ticket, Specflow reruns the
  owning gate before advancing the run contract.
- AC-4: If the adapter attempts a `never_without_human` action, the run stops
  with `blocked_human_required` and does not advance.
- AC-5: If timeout, budget, malformed JSON/JSONL, or non-zero exit occurs, the
  run stops with `adapter_failed`, preserving transcript evidence.
- AC-5A: If the provider CLI is missing or not authenticated, the run stops
  before provider invocation with `adapter_unavailable` and a remediation
  message that names the provider auth command or docs.
- AC-6: Dry-run mode prints the provider command, prompt path, policy path, and
  output paths without invoking Claude or Codex.
- AC-7: Documentation explains subscription-backed CLI use without asking users
  to put Claude or Codex subscription secrets into Specflow config.

## Success Metrics

- A fixture generative stage can run through a fake adapter and prove ledger
  parsing, stop states, and gate rerun behavior without calling a live model.
- A real local Claude adapter smoke test can run with dry-run disabled when
  `claude` is installed and authenticated.
- A real local Codex adapter smoke test can run with dry-run disabled when
  `codex` is installed and authenticated.
- A provider-unavailable fixture fails without invoking a model and records
  `adapter_unavailable`.
- No adapter test performs a networked model call by default in CI.

## Dependencies And Reuse

- Depends on #77 local contracted loop runner and ledger.
- Reuse `bin/specflow.js` for CLI entry.
- Reuse `skills/specflow-loop-selector/SKILL.md` for run contract behavior.
- Reuse `templates/QA/loops/spec-build.yaml` and
  `templates/QA/loops/feature-build.yaml` for stage semantics.
- Reuse existing verifier scripts for post-generative gate checks.

## Risks

- Subscription-backed CLI execution may behave differently across operator
  machines. The adapter must detect command availability and auth readiness
  before execution.
- Provider CLIs can change flags. The adapter should centralize provider command
  construction and include help-output contract tests where feasible.
- If transcripts include sensitive data, Specflow must let operators configure
  transcript location and redaction policy before enabling live adapter runs.
