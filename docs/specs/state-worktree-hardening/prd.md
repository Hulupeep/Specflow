# State + Worktree Hardening PRD

**Date:** 2026-07-02
**Loop:** spec-build
**Slug:** `state-worktree-hardening`
**Parent tickets:** #85 (STATE-01), #86 (WORKTREE-01)
**Goal:** Turn the existing state/worktree *scaffolding* into *enforced* primitives that protect long-running continuity and delegated isolation.

## Problem

Frontier-class agents run long, resume across sessions, and delegate work to sub-agents. Two failure modes follow that are distinct from self-approval (already handled by the verifier rail, #100/#102):

1. **Unsafe re-entry.** On resume, an agent may trust its own (compacted, drifting) memory of "where it was" instead of the durable run state. If the model's assumed position disagrees with the durable contract, work resumes at the wrong stage.
2. **Silent delegation collision.** Delegated maker/verifier work may run in the main working tree, colliding with other work, with no branch/base/path/cleanup record — and could be auto-merged or auto-pushed.

The bar is not "STATE.md exists" or "prepareWorktree exists." The bar is: **a resumed agent re-enters from durable state, not memory; and delegated execution is isolated, ledgered, and never silently collides with the main tree.**

## Requirements

- `REQ-STATE-REENTRY-01` (MUST): On resume, the runner produces a re-entry briefing from durable state (run contract position + state digest + recent ledger), and the durable position overrides any caller-assumed position; a conflict is recorded, never silently accepted.
- `REQ-STATE-REENTRY-02` (MUST): If no durable position exists, re-entry is reported unsafe rather than proceeding on assumed memory.
- `REQ-WORKTREE-ISO-01` (MUST): Preparing a delegated worktree records branch, base ref, base commit, path, read-only, and cleanup status in the ledger, and refuses a path that resolves to the main working tree.
- `REQ-WORKTREE-ISO-02` (MUST): Delegated worktrees never auto-merge or auto-push; cleanup status is tracked on release.

## Non-Goals

- Replacing mechanical gate evidence with state memory. State is context, not a gate result.
- Auto-merging or auto-pushing delegated work.
- A distributed job scheduler. Isolation is per-lane; orchestration stays out of scope.
- Saving facts already represented by repo files, contracts, or transcripts.

## Operating Model

State and worktree are **durable, file-backed context** the runner reads on re-entry and delegation. They never decide a gate; the mechanical gate still owns pass/fail. Trace/status surfaces the re-entry briefing and the worktree record so a human can see where a long run stands and where delegated work lives.

## Success Criteria

- A resumed run whose caller assumes the wrong stage proceeds from the durable stage and records the conflict.
- A delegated worktree cannot be prepared against the main tree, and its branch/base/path/cleanup are ledgered.
- Full test suite passes with dedicated hostile-fixture coverage for both.
