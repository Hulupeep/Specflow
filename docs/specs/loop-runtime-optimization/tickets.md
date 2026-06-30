# Loop Runtime Optimization - Specflow Ticket Packet

## Parent FEAT / Story ID

LOOP-RUNTIME-OPTIMIZATION

GitHub issues:

- #77 - LOOP-RUNTIME-01: Add Local Contracted Loop Runner And Ledger
- #78 - LOOP-RUNTIME-02: Position Specflow As A Contracted Loop Runtime

## Persona Framing

- Specflow operator: wants an agent to keep going until a loop is done or
  actually blocked.
- Interrupted operator: resumes a run tomorrow and expects durable state to win
  over chat memory.
- CI maintainer: needs invalid contracts to fail before they corrupt state.
- Skeptical adopter: compares "loops" marketing with real product behavior.
- Fresh codespace agent: must discover the loop selector and contract itself
  without the human repasting instructions.

## Scope

In scope:

- Local `specflow run` CLI surface.
- Run contract schema and validator.
- Compact ledger for gate evidence and stop reasons.
- Documentation and install-positioning updates.
- Simulation evidence as a blocker for feature-build readiness.

Not in scope:

- Hosted scheduling, cron, fleet orchestration, or background agents.
- Calling an LLM provider from the local CLI.
- Automatic GitHub issue creation, PR creation, merge, or contract override.
- Replacing existing agent runtimes.

## Ticket LOOP-RUNTIME-01 - Add Local Contracted Loop Runner And Ledger

### Requirements

- REQ-01 (MUST): Add `specflow run <loop>` for `spec-build` and `feature-build`
  as an agent-supervised local controller.
- REQ-02 (MUST): Validate run_contract schema before advancing loop state.
- REQ-03 (MUST): Persist a compact ledger entry after every stage or gate.
- REQ-04 (MUST): Block feature-build readiness when simulation evidence is
  missing or stale after ticket creation.
- REQ-06 (SHOULD): Report loop counters for attempts, verifier failures,
  accepted tickets, stop reasons, and token budget fields when available.

### Data Contract

```yaml
run_contract:
  loop: spec-build | feature-build | gate-d | daily-use-teardown
  goal: string
  input_artifact: string
  path: string
  current_stage_or_rail: string
  next_gate: string
  durable_evidence: [string]
  simulation_required: boolean
  stop_condition: string
  never_without_human: [string]
  budgets:
    max_iterations: number?
    max_tokens: number?
  terminal_status: handoff | blocked | failed | in_progress
  storage:
    contract_path: .specflow/runs/<slug>/run-contract.yaml
    ledger_path: .specflow/runs/<slug>/ledger.jsonl
```

```json
{
  "ledger_entry": {
    "run_id": "loop-runtime-optimization",
    "stage": "GATE_B",
    "command": "node scripts/verify-seams.cjs ...",
    "result": "pass",
    "evidence": ["docs/specs/loop-runtime-optimization/specflow-audit.md"],
    "stop_reason": "agent_action_required",
    "next_action": "GATE_B5"
  }
}
```

### Frontend / CLI Interface

```typescript
export interface SpecflowRunOptions {
  loop: 'spec-build' | 'feature-build' | 'gate-d' | 'daily-use-teardown';
  slug: string;
  goal: string;
  input: string;
  contract?: string;
  ledger?: string;
  maxIterations?: number;
}

export interface LoopLedgerEntry {
  runId: string;
  stage: string;
  command: string;
  result: 'pass' | 'fail' | 'skipped';
  evidence: string[];
  stopReason?: 'agent_action_required' | 'human_required' | 'gate_failed' | 'done';
  nextAction?: string;
}
```

### Invariants Referenced

- I-LOOP-001: A loop may advance only from durable run_contract state.
- I-LOOP-002: A gate result is not green unless a verifier command or durable
  simulation artifact exists.
- I-LOOP-003: Human-controlled actions remain blocked by `never_without_human`.

### Acceptance Criteria

- [ ] AC-1: Running `specflow run spec-build --slug loop-runtime-optimization
  --goal <text> --input <path>` writes `.specflow/runs/loop-runtime-optimization/run-contract.yaml`
  and `.specflow/runs/loop-runtime-optimization/ledger.jsonl`.
- [ ] AC-2: Re-running after interruption resumes from the persisted current
  stage.
- [ ] AC-3: Invalid run contracts fail with named missing fields and no state
  advance.
- [ ] AC-4: Missing simulation evidence blocks feature-build readiness.
- [ ] AC-5: Ledger entries include command, result, evidence, stop reason, and
  next action.
- [ ] AC-6: Generative stages stop with `agent_action_required`; they are not
  marked executed by the CLI.

### Gherkin Scenarios

```gherkin
Feature: Local contracted loop runner
  Scenario: Start a spec-build loop
    Given the spec-build loop YAML exists
    When the operator runs specflow run spec-build with a slug, goal, and input
    Then a run_contract is written for spec-build
    And the ledger records the selected path and first gate result

  Scenario: Stop at a generative stage
    Given the next stage requires PRD writing by an agent
    When the runner reaches that stage
    Then the ledger records stop_reason agent_action_required
    And the next_action names the required agent work

  Scenario: Resume an interrupted loop
    Given a run_contract exists at GATE_B5
    When the operator runs the same specflow run command again
    Then the runner resumes at GATE_B5
    And discovery and draft are not rerun

  Scenario: Reject an invalid contract
    Given a run_contract is missing next_gate
    When the runner validates the contract
    Then the command exits non-zero with next_gate named
    And the current stage remains unchanged
```

### Definition of Done

- [ ] Contract schema validator added and tested.
- [ ] CLI command added to `bin/specflow.js`.
- [ ] Ledger persistence has unit tests.
- [ ] Resume behavior has a contract test.
- [ ] Simulation-required readiness block has a test.
- [ ] Generative-stage stop behavior has a contract test.

### SpecFlow Contract Mapping

#### Contracts
- `docs/specs/loop-runtime-optimization/contract.yml` - REQ-01 through REQ-04 and REQ-06.

#### Contract Tests
- `tests/contracts/loop-run-contract.test.js` - validates schema, resume, and readiness block.

#### Journey Tests
- CLI journey evidence is command-based, not Playwright UI.
- J-LOOP-RUN-SPECBUILD
- J-LOOP-RESUME
- J-LOOP-INVALID-CONTRACT

### Relevant ADRs

N/A - this repository does not currently use an ADR directory. Reuse existing
CLI, loop YAML, and verifier scripts.

## Ticket LOOP-RUNTIME-02 - Position Specflow As A Contracted Loop Runtime

### Requirements

- REQ-05 (MUST): Update README, loop docs, and installed AGENTS guidance to say
  Specflow is a contracted loop runtime.
- REQ-05A (MUST): Include a prompt-vs-loop distinction: prompt equals one
  instruction; Specflow loop equals goal, state, verifier, and stop condition.
- REQ-05B (MUST): Explicitly state that hosted scheduling and background agents
  are not part of the current local runtime.
- REQ-05C (SHOULD): Explain the adoption order: reliable manual run, skill,
  loop runner, then optional automation.

### Data Contract

N/A - docs/install positioning only. The relevant contract surface is the
run_contract schema owned by LOOP-RUNTIME-01.

### Frontend / CLI Interface

```typescript
export interface LoopPositioningSection {
  headline: 'contracted loop runtime';
  promptVsLoop: string;
  currentBoundary: 'local runtime, not hosted scheduler';
  installDiscoveryPaths: string[];
}
```

### Invariants Referenced

- I-LOOP-004: Documentation must not claim a capability that the local CLI does
  not provide.
- I-LOOP-005: Installed agent guidance must tell agents to emit a run_contract,
  not only reference a YAML path.

### Acceptance Criteria

- [ ] AC-1: README positions Specflow as a contracted loop runtime.
- [ ] AC-2: README and loop docs include prompt-vs-loop language.
- [ ] AC-3: Installed AGENTS instructions tell fresh agents to direct-read the
  loop selector if their skill registry does not list it.
- [ ] AC-4: Docs explicitly say hosted scheduling/background execution is out of
  scope for the local runner.
- [ ] AC-5: Install or help output mentions `specflow run` after
  LOOP-RUNTIME-01 lands.

### Gherkin Scenarios

```gherkin
Feature: Loop runtime positioning
  Scenario: User compares prompting with Specflow loops
    Given the user reads README after install
    When they reach the loop positioning section
    Then they see state, verifier gates, and stop conditions named
    And hosted scheduling is not claimed

  Scenario: Fresh codespace agent discovers the loop selector
    Given Specflow init has installed AGENTS.md and skills
    When an agent is asked to run spec-build
    Then AGENTS.md points to the local loop selector paths
    And the agent is required to emit a concrete run_contract
```

### Definition of Done

- [ ] README updated.
- [ ] `templates/QA/loops/README.md` updated.
- [ ] `templates/AGENTS.md` updated if needed.
- [ ] CLI help text updated after `specflow run` exists.
- [ ] Docs reviewed for hosted scheduling overclaim.

### SpecFlow Contract Mapping

#### Contracts
- `docs/specs/loop-runtime-optimization/contract.yml` - REQ-05 family.

#### Contract Tests
- `tests/contracts/loop-positioning.test.js` - verifies docs contain the local-runtime boundary and run_contract guidance.

#### Journey Tests
- CLI/docs journey evidence is file-read and command-help based, not Playwright UI.
- J-LOOP-POSITIONING
- J-LOOP-INSTALL-DISCOVERY

### Relevant ADRs

N/A - this repository does not currently use an ADR directory. Reuse existing
README, install script, loop docs, and AGENTS template.
