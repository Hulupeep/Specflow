# State + Worktree Hardening Ticket Packet

**Source tickets:** #85 (STATE-01), #86 (WORKTREE-01)
**Loop:** spec-build

## Scope

Turn existing state/worktree scaffolding into enforced primitives. Same pattern as #101/#103: small enforced primitive, hostile fixture, trace visibility, full test coverage. State is context, never a gate result.

## Tickets

### STATE-REENTRY-01 — Enforce safe durable re-entry over caller-assumed memory

**Journey:** `J-STATE-SAFE-REENTRY`

Acceptance:
- On resume, the runner builds a re-entry briefing from durable state: run-contract position (stage + next gate + terminal status), state digest, and recent ledger.
- A caller-assumed stage that conflicts with the durable stage is overridden by the durable stage and the conflict is recorded in the ledger (never silently accepted).
- A missing durable position is reported unsafe rather than proceeding on assumed memory.
- `specflow run status` exposes the re-entry briefing.
- Terminal loop stops append a compact state update.
- State updates never replace mechanical gate evidence.

### WORKTREE-ISOLATION-01 — Ledger isolated delegated worktrees and refuse main-tree collision

**Journey:** `J-WORKTREE-ISOLATION`

Acceptance:
- Preparing a delegated worktree refuses a path that resolves to the main working tree (no silent collision).
- The ledger records worktree path, branch, base ref, base commit, read-only, and cleanup status.
- Releasing a worktree records cleanup status (removed or kept).
- Auto-merge and auto-push remain false; Specflow never auto-merges or pushes delegated work.
