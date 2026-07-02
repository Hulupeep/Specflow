# Verifier Runtime Lifecycle PRD

**Date:** 2026-07-02
**Loop:** spec-build
**Slug:** `verifier-runtime-lifecycle`
**Source issue:** #100
**Goal:** Make frontier-agent verification a first-class Specflow lifecycle, not a reviewer prompt.

## Problem

Fable-class and other frontier coding agents can now run longer, produce larger changes, and explain those changes with high confidence. That increases Specflow's value, but it also makes a weak harness dangerous. A powerful maker can become planner, implementer, summarizer, reviewer, and judge unless the runtime keeps those authorities separate.

The existing Fable packet already names independent verification (#84) and maker-verifier negotiation (#92). Issue #100 sharpens those into a lifecycle: the maker proposes how the slice should be verified, an independent verifier accepts or rejects that proposal, the maker implements, the verifier attacks the built artifact with runtime evidence where applicable, and a mechanical gate decides whether the run advances.

## Positioning

Specflow is the trust harness for frontier coding agents. It lets Fable, Claude Code, Codex, Ruflo, or any other worker produce the work, but only contracts, gates, and evidence decide what ships.

The model is the actuator. The gate is the sensor. Provider output, provider confidence, verifier prose, and provider exit codes are never gate verdicts.

## Requirements

- `VERIFIER-CONTRACT-01`: Persist a slice-local verification proposal and accepted verification contract before maker implementation starts.
- `VERIFIER-POLICY-01`: Run verifier policy separately from maker policy, with artifact/spec/rubric input and no maker reasoning trace by default.
- `VERIFIER-RUNTIME-01`: Collect adversarial runtime evidence for UI/workflow changes, including Playwright/browser execution, console or network signals, and value-bearing API/backend rereads where applicable.
- `VERIFIER-TRACE-01`: Record maker claim, verifier finding, mechanical gate result, and divergence in ledger/status/trace output.

## Non-Goals

- Making Specflow a swarm orchestrator.
- Trusting Fable, Claude, Codex, Oracle, or any model as a gate.
- Requiring vision for every verifier run.
- Adding cron, hosted routines, or background scheduling.
- Over-specifying implementation details that should be negotiated inside feature-build.

## Operating Model

```text
outer ticket contract
  -> maker verification proposal
  -> independent verifier accepts/rejects
  -> accepted verification contract on disk
  -> maker implementation
  -> verifier runtime findings
  -> mechanical gate rerun
  -> ledgered disposition
```

The verifier sees artifacts, app behavior, spec, and rubric. The verifier does not inherit maker reasoning trace unless a human explicitly approves that exception and the ledger records it.

Runtime verification is required when a change can pass static checks while failing in the app. For UI and workflow slices, a screenshot alone is weak evidence. The verifier must pair visual evidence with at least one executable assertion or reread when the slice has value-bearing state.

## Success Criteria

- Feature-build can create and persist `verification-proposal.md` and `verification-contract.json` under `.specflow/runs/<slug>/`.
- A verifier can reject a proposal that lacks runtime checks, value rereads, or negative paths.
- Verifier output is separate from maker output and ledgered separately.
- Runtime verifier evidence can include Playwright steps, console logs, network logs, screenshot refs, API rereads, DB rereads, or custom script results.
- Gate advance is impossible from verifier approval alone.
- Operators can inspect maker claim vs verifier finding vs gate result without reading the whole transcript first.
