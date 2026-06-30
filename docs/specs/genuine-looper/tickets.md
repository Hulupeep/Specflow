# Genuine Looper Ticket Packet

## #82 - [SPECFLOW] Genuine looper runtime completion

Implement the remaining contracted-loop runtime surfaces:

- `LOOP-RUNTIME-04`: bounded `--until-terminal` execution.
- `LOOP-RUNTIME-05`: YAML-derived stage sequence.
- `GEN-ADAPTER-05`: stage prompt materialization.
- `GEN-ADAPTER-06`: provider session persistence/resume.
- `GEN-ADAPTER-07`: opt-in live adapter smoke.
- `PROVENANCE-02`: diff provenance gate.
- `GATE-C-01`: PR CI status readback.
- `LOOP-RUNTIME-06`: `specflow run status`.
- `INSTALL-LOOP-01`: install completeness verification.

**Journey contract:** `docs/specs/genuine-looper/contract.yml`
**Journey IDs:** J-LOOP-UNTIL-TERMINAL, J-LOOP-YAML-SEQUENCE, J-GEN-STAGE-PROMPT, J-GEN-SESSION-RESUME, J-GEN-LIVE-SMOKE, J-PROVENANCE-DIFF, J-GATEC-STATUS, J-LOOP-RUN-STATUS, J-INSTALL-LOOP-COMPLETE

## Acceptance Criteria

- Given a run contract at a mechanical gate, when `specflow run --until-terminal` runs, then it repeats unblocked verifier stages until the next terminal stop and records every attempt in the ledger.
- Given a loop YAML path in the contract, when the runner determines stage order, then it uses `stages[].id` or `rails[].id` from that YAML and falls back only if the YAML cannot be loaded.
- Given a generative stage, when no verifier registry applies, then a stage prompt file is written with goal, current stage, next gate, durable evidence, and human gates.
- Given provider JSON/JSONL includes a session id, when the next command is built, then Claude/Codex resume arguments include that id.
- Given `specflow adapter-smoke <provider>` runs without `--live`, then it remains a dry-run; with `--live`, it sends only the bounded smoke prompt.
- Given `specflow provenance` is run with `--diff`, `--git-diff`, or `--staged-diff`, then unallowed mock/fake/stub additions and suspicious value-bearing literals fail.
- Given a PR number, when `specflow ci-status <pr>` runs, then Gate C is reported as green, red, or pending from `gh pr checks`.
- Given a run contract path, when `specflow run status --contract <path>` runs, then current stage, terminal status, sequence, and ledger tail are printed.
- Given a fresh project is missing local loop selector skills or adapter policy templates, when `specflow verify` runs, then install health fails with actionable paths.
