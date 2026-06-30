# Genuine Looper Completion PRD

**Date:** 2026-06-30
**Loop:** spec-build
**Goal:** Make `specflow run` behave like a bounded contracted loop runner instead of a reference-doc launcher.

## Problem

Specflow now installs loop YAML, skills, adapter policies, and a local run contract, but an agent can still stop after one stage, cherry-pick instructions, or treat the YAML as background reading. A genuine looper needs executable stage state, bounded continuation, materialized stage prompts for generative work, provider resume evidence, provenance checks over changed code, install health checks, and CI/Gate C readback.

## Requirements

- `LOOP-RUNTIME-04`: `specflow run --until-terminal` continues through all unblocked mechanical gates until handoff, a human gate, missing evidence, adapter failure, or iteration budget exhaustion.
- `LOOP-RUNTIME-05`: the runner compiles `templates/QA/loops/*.yaml` into the executable stage/rail sequence instead of relying only on hardcoded maps.
- `GEN-ADAPTER-05`: every generative stop writes a stage prompt that includes goal, current stage, next gate, durable evidence, and `never_without_human`.
- `GEN-ADAPTER-06`: provider session IDs from Claude/Codex output are persisted and can be supplied back into the next provider command.
- `GEN-ADAPTER-07`: `specflow adapter-smoke <provider> --live` remains opt-in and uses a bounded one-line smoke prompt.
- `PROVENANCE-02`: `specflow provenance` can audit a diff for value-bearing literals, mock/fake/stub paths, and missing source traces after implementation.
- `GATE-C-01`: Specflow exposes a command to read PR check status and classify Gate C as green, red, or pending.
- `LOOP-RUNTIME-06`: `specflow run status --contract <path>` reports current stage, terminal status, sequence, and ledger tail.
- `INSTALL-LOOP-01`: `specflow verify` fails install health when loop skills or safe adapter policy templates are missing in a fresh project.

## Non-Goals

- Hosted scheduling, background daemons, or automatic PR push/merge.
- Automatically trusting provider output as a gate result.
- Running live Claude/Codex smoke checks unless explicitly requested with `--live`.

## Success Criteria

- Contract tests prove YAML-derived stage order, bounded continuation, stage prompt materialization, session resume command construction, status reporting, and adapter smoke prompting.
- Provenance tests reject suspicious diff literals and unallowed mock/fake/stub additions.
- Installer tests catch missing loop selector skills and missing adapter policy templates.
- Feature-build evidence proves the changed files are source-proven and the implemented gates passed locally.
