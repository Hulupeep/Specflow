# Agent Communication Protocol

## Overview

This protocol defines how Specflow agents communicate in Agent Teams mode.
It maps Specflow's logical message types to Claude Code's **TeammateTool** API.

When `CLAUDE_CODE_EXPERIMENTAL_AGENT_TEAMS=true` is NOT set, these agents
fall back to Task tool subagents with no inter-agent messaging.

## Claude Code TeammateTool API

Agent Teams uses three communication mechanisms:

### 1. Direct Messages (`write` operation)
Send a message to one specific teammate by name.
```
TeammateTool(operation: "write", to: "db-coordinator", message: "REQUEST_MIGRATION #50 tables:[users, sessions]")
```

### 2. Broadcast (`broadcast` operation)
Send a message to ALL teammates. Use sparingly — costs scale with team size.
```
TeammateTool(operation: "broadcast", message: "TOUCHING_FILE src/lib/auth.ts")
```

### 3. Shared Task List (TaskCreate / TaskUpdate / TaskList)
All teammates share a task list with dependency tracking. Tasks auto-unblock
when dependencies complete. File-locking prevents race conditions on claims.

## Environment Variables (set automatically on each teammate)

```
CLAUDE_CODE_TEAM_NAME       # Team identifier
CLAUDE_CODE_AGENT_ID        # Unique agent session ID
CLAUDE_CODE_AGENT_NAME      # Human-readable name (e.g., "issue-50")
CLAUDE_CODE_AGENT_TYPE      # Role (e.g., "issue-lifecycle")
CLAUDE_CODE_PARENT_SESSION_ID  # Lead session that spawned this agent
```

## Team Lifecycle

### 1. Leader creates team (`spawnTeam`)
The waves-controller (lead session) creates a named team:
```
TeammateTool(operation: "spawnTeam", name: "wave-1", config: {
  agents: [
    { name: "issue-50", prompt: "<issue-lifecycle prompt for #50>" },
    { name: "issue-51", prompt: "<issue-lifecycle prompt for #51>" },
    { name: "db-coord",  prompt: "<db-coordinator prompt>" },
    { name: "qa-gate",   prompt: "<quality-gate prompt>" }
  ]
})
```

### 2. Teammates work and communicate
Each teammate runs independently with persistent context. They use `write`
for direct messages and `broadcast` for notifications.

### 3. Graceful shutdown
Leader sends `requestShutdown` after wave completes. Teammates finish
current work before stopping.

## Message Catalog

### Direct Messages (use `write`)

| Message | From | To | Purpose |
|---------|------|----|---------|
| `REQUEST_MIGRATION #N tables:[...]` | issue-lifecycle | db-coordinator | Get migration number |
| `MIGRATION_ASSIGNED <num> <file>` | db-coordinator | issue-lifecycle | Migration number assigned |
| `QUERY_TABLE <name>` | issue-lifecycle | db-coordinator | Check table existence |
| `TABLE_EXISTS <migration>` | db-coordinator | issue-lifecycle | Table already in schema |
| `TABLE_PENDING #<issue>` | db-coordinator | issue-lifecycle | Another agent creating it |
| `TABLE_NOT_FOUND` | db-coordinator | issue-lifecycle | Doesn't exist anywhere |
| `CONFLICT <table> <details>` | db-coordinator | issue-lifecycle | Table conflict detected |
| `RUN_CONTRACTS` | issue-lifecycle | quality-gate | Run contract validation |
| `CONTRACT_RESULTS PASS` or `FAIL <details>` | quality-gate | issue-lifecycle | Contract test results |
| `RUN_JOURNEY_TIER2 issues:[...]` | waves-controller | quality-gate | Run wave gate |
| `RUN_REGRESSION wave:<N>` | waves-controller | quality-gate | Run regression gate |
| `READY_FOR_CLOSURE #N <certificate>` | issue-lifecycle | waves-controller | Issue ready to close |
| `BLOCKED #N <reason>` | issue-lifecycle | waves-controller | Issue cannot complete |

### Broadcast Messages (use `broadcast`)

| Message | From | Purpose |
|---------|------|---------|
| `TOUCHING_FILE <path>` | issue-lifecycle | About to modify shared file |

### Shared Task List (use TaskCreate/TaskUpdate)

Each issue becomes a task in the shared list:
```
TaskCreate({
  subject: "Implement #50: User Profile Page",
  description: "Full lifecycle: contract -> build -> test -> close",
  activeForm: "Implementing issue #50"
})
```

Teammates claim tasks and update status. Dependencies between tasks
(e.g., issue #51 depends on #50) use `addBlockedBy`.

## Agent Roles

### waves-controller (TEAM LEAD)
- Creates team via `spawnTeam`
- Creates shared tasks for each issue
- Receives READY_FOR_CLOSURE and BLOCKED via `write`
- Triggers Tier 2 and Tier 3 gates via `write` to quality-gate
- Issues `requestShutdown` when wave completes

### issue-lifecycle (TEAMMATE, one per issue)
- Claims its task from shared task list
- Uses `write` to db-coordinator for migration numbers
- Uses `broadcast` for TOUCHING_FILE notifications
- Uses `write` to waves-controller for READY_FOR_CLOSURE or BLOCKED
- Marks its shared task as completed when done

### db-coordinator (TEAMMATE, one per wave)
- Responds to `write` messages from issue-lifecycle agents
- Tracks state in-memory (migration numbers, table registry)
- Detects conflicts and notifies both affected agents via `write`
- Escalates unresolvable conflicts to waves-controller via `write`

### quality-gate (TEAMMATE, one per wave)
- Responds to `write` messages for test execution requests
- Runs contract tests, Tier 2 wave gate, Tier 3 regression gate
- Reports results back via `write` to the requester
- Updates `.specflow/baseline.json` on clean Tier 3 pass

## Shared File Coordination

Files requiring `broadcast` TOUCHING_FILE before modification:
- `src/services/**` — shared service layer
- `src/hooks/**` — shared hooks
- `src/lib/**` — shared utilities
- `src/features/*/index.ts` — barrel export files

### Barrel File Rule

During parallel execution, DO NOT modify `index.ts` barrel files. Instead:
1. Create your component/hook file
2. Add TODO comment: `// TODO: Add to index.ts export`
3. Report completion with TODO location
4. The coordinator consolidates exports after all agents finish

## Fallback: Subagent Mode

When `CLAUDE_CODE_EXPERIMENTAL_AGENT_TEAMS` is NOT set:
- waves-controller uses Task tool subagents (existing hub-and-spoke)
- No TeammateTool messages — agents are stateless
- Sequential phase execution (Phases 2-7)
- All existing behavior preserved
- Communication happens via return values from Task tool calls
