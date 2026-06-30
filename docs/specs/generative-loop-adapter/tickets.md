# Generative Loop Adapter - Specflow Ticket Packet

## Parent FEAT / Story ID

GENERATIVE-LOOP-ADAPTER

GitHub issue:

- #80 - GENERATIVE-ADAPTER-01: Add Controlled Local CLI Adapters For Generative Loop Stages

## Persona Framing

- Subscription operator: has Claude Max/Pro or equivalent and wants Specflow to
  use the already-authenticated local CLI rather than new API-key plumbing.
- Codex operator: wants the same loop contract through `codex exec`.
- Safety reviewer: cares that local CLI agents cannot push, create PRs, or
  override contracts because a prompt told them to.
- CI maintainer: needs adapter tests that do not call live models by default.
- Cautious operator: wants dry-run visibility before paying for or launching a
  generative stage.

## Scope

In scope:

- Optional adapter interface for generative stages in `specflow run`.
- Provider adapters for `claude-print` and `codex-exec`.
- Adapter policy file schema.
- Ledger entries, transcript artifacts, final-output artifacts, failure states.
- Post-adapter Specflow gate rerun.
- Documentation for subscription-backed CLI auth and dry-run inspection.

Not in scope:

- Hosted scheduling or background daemons.
- Storing Claude/Codex subscription secrets in Specflow config.
- Provider API-key integration.
- Bypassing provider-native sandbox/auth controls.
- Letting adapter output alone mark a Specflow gate green.

## Ticket GENERATIVE-ADAPTER-01 - Add Controlled Local CLI Adapters For Generative Loop Stages

### Requirements

- REQ-01 (MUST): Add optional generative adapter interface to `specflow run` with
  provider IDs `claude-print` and `codex-exec`.
- REQ-02 (MUST): Require adapter policy before generative execution.
- REQ-03 (MUST): Support Claude print mode with structured output, permission
  controls, resume, and budget flags.
- REQ-04 (MUST): Support Codex exec with JSONL output, sandbox/approval controls,
  output schema, and resume.
- REQ-05 (MUST): Persist every adapter invocation to the loop ledger.
- REQ-06 (MUST): Rerun owning Specflow gate after adapter output before
  advancing.
- REQ-07 (MUST): Block `never_without_human` actions outside the provider prompt.
- REQ-08 (MUST): Document subscription-backed CLI auth without storing
  subscription secrets.
- REQ-09 (SHOULD): Provide dry-run mode for adapter command inspection.

### Data Contract

```yaml
adapter_policy:
  id: local-claude-safe
  provider: claude-print | codex-exec
  command: claude | codex
  args: [string]
  model: string?
  profile: string?
  max_budget_usd: number?
  timeout_seconds: number
  max_iterations: number
  allowed_tools: [string]
  denied_tools: [string]
  transcript_path: string
  output_path: string
  dry_run: boolean
  never_without_human: [string]
```

```json
{
  "adapter_ledger_entry": {
    "stage": "draft",
    "provider": "claude-print",
    "argv": ["claude", "-p", "--output-format", "stream-json"],
    "session_id": "provider-session-id-or-null",
    "transcript_path": ".specflow/runs/demo/adapter/claude-draft.jsonl",
    "output_path": ".specflow/runs/demo/adapter/claude-draft-final.md",
    "exit_code": 0,
    "stop_reason": "gate_rerun_required",
    "owning_gate_command": "node scripts/verify-falsification.cjs ...",
    "forbidden_action_detected": false
  }
}
```

### CLI Interface

```typescript
export type GenerativeAdapterProvider = 'claude-print' | 'codex-exec';

export interface GenerativeAdapterPolicy {
  id: string;
  provider: GenerativeAdapterProvider;
  command: string;
  args: string[];
  timeoutSeconds: number;
  maxIterations: number;
  maxBudgetUsd?: number;
  allowedTools: string[];
  deniedTools: string[];
  transcriptPath: string;
  outputPath: string;
  dryRun: boolean;
  neverWithoutHuman: string[];
}
```

### Invariants Referenced

- I-ADAPTER-001: A provider process exit code is never a Specflow gate result.
- I-ADAPTER-002: Every live adapter invocation must have a transcript artifact.
- I-ADAPTER-003: Actions listed in `never_without_human` block state advance
  outside the provider prompt.
- I-ADAPTER-004: CI adapter tests use fake providers unless explicitly opted
  into live local smoke tests.

### Acceptance Criteria

- [ ] AC-1: Claude policy invokes `claude -p` only for an
  `agent_action_required` stage and writes transcript/final-output artifacts.
- [ ] AC-2: Codex policy invokes `codex exec` only for an
  `agent_action_required` stage and writes transcript/final-output artifacts.
- [ ] AC-3: Adapter output triggers the owning Specflow gate before run contract
  advance.
- [ ] AC-4: Attempted `never_without_human` actions stop with
  `blocked_human_required` and do not advance stage.
- [ ] AC-5: Timeout, non-zero exit, budget stop, malformed JSON/JSONL, or missing
  output stops with `adapter_failed` and preserves transcript evidence.
- [ ] AC-5A: Missing or unauthenticated provider CLI stops before invocation with
  `adapter_unavailable` and a remediation hint.
- [ ] AC-6: Dry-run prints command, prompt path, policy path, transcript path,
  and output path without invoking provider CLI.
- [ ] AC-7: Docs explain Claude/Codex subscription-backed CLI auth and state that
  Specflow stores no subscription secrets.

### Gherkin Scenarios

```gherkin
Feature: Controlled generative loop adapters
  Scenario: Claude print mode executes a generative stage
    Given a run_contract is stopped at agent_action_required
    And adapter policy provider is claude-print
    When specflow run resumes with that adapter policy
    Then claude -p is invoked with configured output and permission flags
    And the ledger re-reads provider, transcript path, exit code, and gate rerun result

  Scenario: Codex exec executes a generative stage
    Given a run_contract is stopped at agent_action_required
    And adapter policy provider is codex-exec
    When specflow run resumes with that adapter policy
    Then codex exec is invoked with configured json, sandbox, and approval flags
    And the ledger re-reads provider, transcript path, exit code, and gate rerun result

  Scenario: Forbidden action blocks stage advance
    Given adapter output attempts git push
    And never_without_human includes push
    When the adapter controller audits provider output and command events
    Then the run stops with blocked_human_required
    And current_stage_or_rail remains unchanged

  Scenario: Provider failure preserves evidence
    Given the adapter command times out or emits malformed structured output
    When specflow run handles the adapter result
    Then the run stops with adapter_failed
    And the ledger includes transcript path, exit code, and failure reason

  Scenario: Provider is unavailable or unauthenticated
    Given adapter policy provider is claude-print or codex-exec
    And provider command is missing or auth readiness check fails
    When specflow run prepares the adapter invocation
    Then no provider process is invoked
    And the run stops with adapter_unavailable
    And the ledger names the failed provider and remediation hint

  Scenario: Dry-run inspects command without provider invocation
    Given adapter policy exists
    When the operator runs adapter dry-run
    Then Specflow prints provider command, prompt path, policy path, and output paths
    And no Claude or Codex process is invoked
```

### Definition of Done

- [ ] Adapter policy schema parser and validation tests added.
- [ ] Fake provider fixture covers success, malformed output, timeout, and
  forbidden-action cases.
- [ ] Provider readiness fixture covers missing command and unauthenticated CLI.
- [ ] Claude command builder tests cover `-p`, output format, permissions,
  budget, and resume flags.
- [ ] Codex command builder tests cover `exec`, JSONL, sandbox, approval,
  output schema, profile/model, and resume flags.
- [ ] Ledger tests prove transcript/output paths and gate rerun command are
  recorded.
- [ ] Docs explain subscription-backed CLI usage and dry-run.

### SpecFlow Contract Mapping

#### Contracts
- `docs/specs/generative-loop-adapter/contract.yml` - REQ-01 through REQ-09.

#### Contract Tests
- `tests/contracts/generative-adapter-policy.test.js`
- `tests/contracts/generative-adapter-ledger.test.js`
- `tests/contracts/generative-adapter-provider-builders.test.js`

#### Journey Tests
- CLI journey evidence is command/fake-provider based, not Playwright UI.
- J-ADAPTER-CLAUDE-PRINT
- J-ADAPTER-CODEX-EXEC
- J-ADAPTER-HUMAN-GATE-BLOCK
- J-ADAPTER-FAILURE-EVIDENCE
- J-ADAPTER-AUTH-UNAVAILABLE
- J-ADAPTER-DRY-RUN

### Relevant ADRs

N/A - this repository does not currently use an ADR directory. Reuse existing
CLI, loop YAML, verifier scripts, and #77 run-contract ledger work.
