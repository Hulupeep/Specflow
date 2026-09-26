# Claude Code native capabilities vs the Specflow loops (#94)

**Date:** 2026-09-12
**Scope:** `spec-build.yaml`, `feature-build.yaml`, `scripts/specflow-runner.cjs`, `templates/adapter-policies/claude-code-large-routing.yml`, `agents/`, `skills/`, `hooks/`
**Baseline:** Claude Code 2.1.260–2.1.267 release notes (Fable 5.1, `/diff`, `/effort` per model, `CLAUDE_CODE_SUBAGENT_MODEL`, `PreModelSwitch`/`PostModelSwitch` hooks, `/cost` cache stats, `/skill-doctor`, `prompt-audit`, `model:`/`effort:` frontmatter).

## TL;DR

The overlap is **the tick**, not the gates. Both loops implement "wake → locate stage from durable state → advance one step → persist → stop". Claude Code now ships that scheduler natively (Routines, PR steward, Workflow, per-model effort, subagent model tiering, hooks). Specflow's unique value is what Claude Code cannot self-certify: **mechanical gates, the seed-independence check, and the ledger**. The optimization is to stop carrying provider scaffolding Claude Code already holds, and to bind the remaining Specflow trust surfaces to Claude Code's native hook points.

## Overlap map

| Loop concern | Where Specflow implements it | Claude Code native equivalent | Verdict |
|---|---|---|---|
| Re-fire until `done_when` ("thread automation") | `specflow run --until-terminal`, routine manifest scaffold (runner ~L505) | Routines (`create_trigger`, `send_later`), `/loop` | **Duplicate.** Manifest should emit a Routine whose prompt is `specflow run … --until-terminal`; Specflow owns the stop rules, not the timer |
| Gate C red → classify → repair → re-read CI | `feature-build.yaml` `repair:` + `GATE_C.read` | PR steward (`subscribe_pr_activity`), drive-to-green rules | **Duplicate after the PR exists.** Conflict: steward pushes fixes; Specflow `never_without_human: [git push]`. Decide per repo, do not run both |
| Fresh-context critic, parallel lenses | `adversary-spawn.cjs` + `verify-seed.cjs`; `persona_lens`, `falsify_subrun` | `Workflow` `agent()` / `parallel()`; `--agents <json>` in `-p` mode | **Complementary.** Claude gives the fresh window; `verify-seed` gives the independence proof. Keep both, bind seed → `--agents` JSON |
| Judge vs muscle model tiering | `routes:` in adapter policy, `Recommended Model` prose in 18 `agents/*.md` | `CLAUDE_CODE_SUBAGENT_MODEL`, `model:` + `effort:` frontmatter on subagents/skills (fixed 2.1.259/2.1.267) | **Specflow side is prose-only.** No runtime reads `Recommended Model:`; "top-thinker work, never a cheap model" is unenforced |
| Effort level | `adapter_policy.effort` validated and ledgered | `--effort <level>` on `claude -p`; `modelSettings.<model>.effortLevel` in user settings | **Closed on `main`.** Was a bug: the policy said `xhigh`, the ledger recorded `xhigh`, the provider ran at the user's default. `buildAdapterCommand` now passes `--effort` and derives the Codex `model_reasoning_effort` arg (#160 / #161, commit 624be66) |
| Model version | policy pins `claude-fable-5`, fallback `claude-opus-4-8` | Fable 5.1 (`claude-fable-5-1`) is current and "more eager" | **Stale.** Prompts tuned for Fable 5 need `prompt-audit` before bumping |
| Effective-model provenance ("silent downgrade is a failed contract", #83) | stream-json parsing in `-p` runs only | `PostModelSwitch` hook (interactive sessions), `--fallback-model` | **Gap.** Interactive loop runs have no ledger entry on model switch. One hook closes it |
| Block a cheap model during adversary | none | `PreModelSwitch` hook (exit 2 blocks) | **Free enforcement** of the persona-lens rule |
| Re-entry ("where am I?") | runner `briefing` / durable position (~L392–430); `hooks/session-start.sh` is an empty stub | `SessionStart` hook, named sessions (`claude -n`, `/rename`) | **Stub.** The re-entry mechanic exists in the runner and is not wired to the hook |
| Slice size + evidence pack diff summary | evidence note: files, +/- lines, "<1000 lines" | `/diff` panel (2.1.260, fullscreen) with line selection → prompt | Human-gate affordance only. Keep the evidence file; point the reviewer at `/diff` |
| Prompt cost per tick | each tick re-reads YAML + artifacts; `--resume` only if `policy.session_id` set | 1-hour prompt cache; `/cost` hit-rate; effort change no longer busts cache on Fable 5.1 | Ticks under 60 min apart that `--resume` the stage session are cached. Fresh `-p` per tick is not. Adversary must stay fresh; rails 1–5 need not |
| Scaffolding drift | 360 KB of agent prompts, 83 `NEVER`/`MUST`, written for Sonnet/Haiku era | `/claude-api prompt-audit`, `/skill-doctor` | Measured audit of exactly the drift #94 names |

## Provider scope

Specflow is provider-agnostic. The loop YAMLs do not change. The split below is deliberate:

| Provider-agnostic (runner contract, all adapters) | Claude Code binding only |
|---|---|
| CB-001 policy fields are applied or rejected — **satisfied on `main` by #160 / #161**, not by this binding | CB-002 model-switch ledger entry via `PostModelSwitch` |
| CB-004 Specflow never owns a timer | CB-003 top-thinker stage guard via `PreModelSwitch` |
| CB-005 one Gate C repair owner per repo | `SessionStart` briefing, `--agents` seed JSON, `prompt-audit`, `/skill-doctor` |

Codex gets the same shape through its own binding (`PROCESS-CODEX.md`) when its CLI exposes equivalent hooks. Until then Codex runs are covered by CB-001, CB-004, CB-005 only.

## Invariants (proposed for `feature_specflow_project` or a new `feature_claude_binding`)

- **CB-001** Every field in an adapter policy that the provider surface supports is passed to the provider or the policy fails validation. No "recorded but not applied" fields. Applies to every adapter. **Status: landed on `main` via #160 / #161 (commit 624be66).** The runner keeps a hand-written effort arg that matches the policy and rejects one that drifts, so the shipped adapter templates keep theirs. Not re-implemented here.
- **CB-002** A model switch during a loop run appends a ledger entry with requested and effective model before the next stage advances.
- **CB-003** Any stage tagged `top-thinker` in a loop YAML refuses to run on a model below the policy's planner tier. Enforcement is a hook exit code, not prose.
- **CB-004** Specflow never owns a timer. Scheduling is delegated to the runtime (Routine, cron, Actions); Specflow owns `done_when`, `never_without_human`, and the stop reason.
- **CB-005** Gate C repair runs in exactly one owner per repo: the feature-build tick or the PR steward. The run contract names which.

## Acceptance criteria

1. ~~`buildAdapterCommand` for `claude-print` emits `--effort <policy.effort>` when set.~~ **Done on `main` (#160 / #161).** Out of scope for this binding.
2. `hooks/settings.json` gains `PostModelSwitch` → append `{event: model_switch, from, to}` to the active run ledger; `PreModelSwitch` → exit 2 when the run contract's current stage is `adversary`, `persona_lens`, `falsify_subrun`, or `GATE_B5` and the target model is below the planner policy. **Effort: one tick, plus hook tests.**
3. `hooks/session-start.sh` prints the runner briefing (loop, stage, next gate, blocked-on, last session) for every `.specflow/runs/*/run-contract.yaml` that is not terminal. **Effort: one tick.**
4. `agents/*.md` gain YAML frontmatter `model:` and `effort:` derived from the existing `Recommended Model` line; the adapter passes the adversary/persona agents as `--agents <json>` built from the verified seed. **Effort: two ticks; the seed byte-check must cover the JSON.**
5. Routing template bumps to `claude-fable-5-1` only after `prompt-audit` runs over `agents/`, `skills/`, `templates/loops/prompts/`, with findings committed as a proposal artifact (no silent skill mutation, per the adversary review stipulation).

## Failure cases

- Passing `--effort` when the user's `modelSettings` already pins a different level for that model: CLI flag wins for the session; ledger must record the flag, not the settings value.
- `PreModelSwitch` blocking a fallback the provider forces (Fable safeguard routing to Opus): the hook must allow provider-initiated fallback and ledger it as `fallback`, and block only user or agent-initiated downgrades.
- Steward and feature-build tick both active on one PR: two agents push to one branch. CB-005 is the guard.
- `--agents` JSON carrying anything beyond the three seed slots: `verify-seed.cjs` must reject it, same as the prompt path today.

## Definition of done

- ACs 2–3 merged with tests green (`npm test -- hooks`). AC 1 closed separately on `main` by #160 / #161.
- AC 4–5 opened as tickets referencing this doc; not blocking.
- `MODEL_ROUTING.md` states which knobs Specflow owns (ledger, gates, seed) and which it delegates to Claude Code (effort memory, subagent model, scheduling, CI steward).

## What not to build

- A Specflow scheduler. Routines exist.
- A Specflow diff viewer. `/diff` exists.
- A second CI-repair loop next to the steward.
- Anthropic-only requirements in the YAML paths. Everything above lives in the binding (`PROCESS-CLAUDE.md`, hooks, adapter policy), never in `spec-build.yaml` or `feature-build.yaml`.
