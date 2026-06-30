# Loop Runtime Optimization PRD

## Job To Be Done

When an operator asks an agent to run Specflow, they need Specflow to behave like
a contracted loop, not a prompt pack: the agent should select the right loop,
persist state, run gates until blocked or done, resume from durable evidence, and
stop only on a declared stop condition.

## Positioning

Specflow is a contracted loop runtime for software delivery. It is not a hosted
scheduler, agent fleet, or chat memory product.

The positioning should make three claims only:

- Prompting tells an agent what to do once; Specflow gives the agent a durable
  job contract, verifier gates, state, and stop rules.
- Specflow's high-leverage advantage is not "more instructions"; it is the
  combination of machine-checkable gates, resumable run contracts, and
  post-code provenance checks.
- Heavy automation should be opt-in. The first product step is a local runner
  that makes one manual run reliable and measurable before any schedule or fleet
  layer exists.

## Problem

The current loop kit has strong YAML paths, skills, and verifiers, but a fresh
agent can still treat them as reading material. That causes three failures:

1. The agent references the loop instead of contracting itself to the loop.
2. The agent stops at soft gates even when the loop says to continue.
3. Users cannot measure whether the loop produced an accepted change, how many
   gates ran, or why the loop stopped.

This is enough to make Specflow feel like a prompt workflow even though the
underlying design is closer to a loop.

## Non-Goals

- Do not build scheduling, cron, hosted workers, or multi-agent fleet control in
  this ticket set.
- Do not replace Claude Code, Codex, K2.7, or other agent runtimes.
- Do not make the local CLI call an LLM provider. The first runner is an
  agent-supervised controller: it executes mechanical gates that have commands,
  persists state, and tells the active agent the next generative action.
- Do not weaken human-controlled operations: creating issues, pushing, opening
  PRs, merging, overriding contracts, and using `--no-verify` remain governed by
  the selected loop's `never_without_human` list.

## Operating Model

The MVP runner is a local controller with two execution modes:

- Mechanical gate: if the loop stage declares a concrete command, the runner
  executes it, records exit code/stdout/stderr pointers, and advances only on
  success.
- Generative stage: if the loop stage requires agent judgment or writing, the
  runner records `stop_reason: agent_action_required`, writes the exact
  `next_action`, and leaves the active agent to perform that work before resume.

Default storage is `.specflow/runs/<slug>/run-contract.yaml` and
`.specflow/runs/<slug>/ledger.jsonl`. A caller may pass `--contract <path>` to
use a different contract file, but the ledger remains adjacent to that contract
unless `--ledger <path>` is supplied.

## Requirements

- REQ-01 (MUST): Add a `specflow run` command that selects a loop, writes or
  updates a durable `run_contract`, and advances through every unblocked
  mechanical gate until a declared stop condition or `agent_action_required`
  state is reached.
- REQ-02 (MUST): Define and validate a run contract schema with loop name, goal,
  input artifact, selected path, current stage, next gate, durable evidence,
  stop condition, simulation requirement, budgets, and `never_without_human`
  rules.
- REQ-03 (MUST): Persist a compact loop ledger after every gate with command
  evidence, verifier result, stop reason, and next action.
- REQ-04 (MUST): Treat missing simulation after ticket creation as a blocking
  state for feature-build readiness.
- REQ-05 (MUST): Document Specflow as a contracted loop runtime and explicitly
  distinguish it from a one-shot prompt and from hosted autonomous scheduling.
- REQ-06 (SHOULD): Report cost and quality counters that matter for loops:
  gate attempts, verifier failures, accepted tickets, stop reasons, and token
  budget fields when the runtime supplies them.

## Acceptance Criteria

- AC-1: `npx @colmbyrne/specflow run spec-build --slug loop-runtime-optimization
  --goal <text> --input <path>` creates or updates a run contract and ledger.
- AC-2: Running the same command after interruption resumes from the persisted
  current stage instead of restarting discovery.
- AC-3: An invalid run contract fails with actionable schema errors and does not
  advance the loop.
- AC-4: A ticket-producing spec-build run cannot report feature-build readiness
  until simulation evidence is present and current.
- AC-5: README, loop docs, and installed AGENTS instructions position Specflow
  as a contracted loop runtime and include the prompt-vs-loop distinction.
- AC-6: The docs avoid claiming hosted scheduling, background execution, or
  autonomous issue creation as current product behavior.

## Success Metrics

- A fresh codespace fixture can discover the loop selector and run contract
  instructions without the user pasting private context.
- A local fixture run writes `.specflow/runs/<slug>/run-contract.yaml` and
  `.specflow/runs/<slug>/ledger.jsonl`, then resumes from the stored stage on a
  second invocation.
- An invalid contract fixture fails before state advance and names the missing
  field.
- The default product story improves by more than a marginal wording change:
  users can run a command and inspect state, instead of only reading YAML.

## Dependencies And Reuse

- Reuse `skills/specflow-loop-selector/SKILL.md` for loop selection rules.
- Reuse `templates/QA/loops/spec-build.yaml` and
  `templates/QA/loops/feature-build.yaml` as canonical paths.
- Reuse `scripts/verify-ticket-journey.cjs`, `scripts/verify-seams.cjs`,
  `scripts/verify-adr.cjs`, and `scripts/verify-falsification.cjs` for gates.
- Extend `bin/specflow.js` rather than introducing a second CLI entry point.

## Risks

- Overclaiming "loop runtime" could make users expect hosted automation. The
  docs must say local contracted loop runtime first, hosted scheduling later if
  ever built.
- A runner that only writes YAML but does not execute gates would be a branding
  change, not a product improvement. The MVP must run verifiers and persist a
  ledger.
- A runner that pretends to perform generative agent work without an LLM adapter
  would be a silent lie. Generative stages must stop with
  `agent_action_required`.
- If the ledger grows without bounds, loops get expensive to resume. The schema
  should store compact evidence pointers, not full transcripts.
