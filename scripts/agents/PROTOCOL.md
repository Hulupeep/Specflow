# Agent Teams Communication Protocol

## Overview

This document defines the communication protocol for all Agent Teams teammates. It is a reference document, not an executable agent.

All inter-agent communication uses Claude Code's TeammateTool API:
- **`write`** — direct message to a named teammate
- **`broadcast`** — notify all teammates (use sparingly)
- **Shared TaskList** — issue tracking with dependency management

---

## Message Catalog

| Message | Sender | Receiver | Purpose |
|---------|--------|----------|---------|
| `REQUEST_MIGRATION` | issue-lifecycle | db-coordinator | Request next migration number |
| `MIGRATION_ASSIGNED` | db-coordinator | issue-lifecycle | Return assigned migration number |
| `MIGRATION_CONFLICT` | db-coordinator | issue-lifecycle | Alert: schema conflict detected |
| `TOUCHING_FILE` | issue-lifecycle | broadcast | Announce file being modified |
| `FILE_CONFLICT` | any | issue-lifecycle | Alert: another agent modifying same file |
| `RUN_CONTRACTS` | issue-lifecycle | quality-gate | Request contract test execution |
| `RUN_JOURNEYS` | issue-lifecycle | quality-gate | Request journey test execution |
| `RUN_WAVE_GATE` | waves-controller | quality-gate | Request cross-issue validation |
| `RUN_JOURNEY_TIER2` | waves-controller | quality-gate | Request Tier 2 wave gate |
| `RUN_REGRESSION` | waves-controller | quality-gate | Request full regression suite |
| `TEST_RESULTS` | quality-gate | requester | Return test execution results |
| `ISSUE_COMPLETE` | issue-lifecycle | waves-controller | Report issue finished |
| `READY_FOR_CLOSURE` | issue-lifecycle | waves-controller | Issue ready with cert |
| `ISSUE_BLOCKED` | issue-lifecycle | waves-controller | Report issue blocked |
| `WAVE_APPROVED` | quality-gate | waves-controller | Wave passed all gates |
| `WAVE_REJECTED` | quality-gate | waves-controller | Wave failed quality gate |
| `SCHEMA_INFO` | issue-lifecycle | issue-lifecycle | Share schema discovery between peers |
| `DEFER_TEST` | issue-lifecycle | journey-gate | Defer a failing test to journal |
| `BASELINE_UPDATE` | quality-gate | broadcast | Announce baseline.json updated |

---

## Message Format

```json
{
  "type": "REQUEST_MIGRATION",
  "from": "Yeats",
  "to": "Hamilton",
  "payload": {
    "issueNumber": 42,
    "tableName": "audit_log",
    "operation": "CREATE TABLE"
  },
  "timestamp": "2026-02-05T14:30:00Z"
}
```

---

## Agent Roles

| Role | Fixed Name | Count | Purpose |
|------|-----------|-------|---------|
| waves-controller | Finn McCool | 1 | Orchestrates everything |
| issue-lifecycle | (from pool) | 1 per issue | Owns an issue end-to-end |
| db-coordinator | Hamilton | 1 per wave | Migration numbering and conflict detection |
| quality-gate | Keane | 1 per wave | Test execution and pass/fail decisions |
| journey-gate | Scathach | 1 per wave | Three-tier journey enforcement |

---

## Environment Variables

| Variable | Set By | Used By | Purpose |
|----------|--------|---------|---------|
| `ISSUE_NUMBER` | waves-controller | issue-lifecycle | Which issue to work on |
| `WAVE_NUMBER` | waves-controller | all | Current wave |
| `CLAUDE_CODE_AGENT_NAME` | TeammateTool | all | Cosmetic name |
| `CLAUDE_CODE_AGENT_TYPE` | TeammateTool | all | Functional role |
| `CLAUDE_CODE_TEAM_NAME` | TeammateTool | all | Team name |

---

## Fallback Behavior

When TeammateTool is not available (Claude Code < 4.6):
- waves-controller uses the standard subagent spawning model (Task tool)
- All existing agent prompts work unchanged
- No team names, no peer-to-peer communication
- Hub-and-spoke coordination via waves-controller

---

## Guard Rails

1. **Names are cosmetic only.** The `CLAUDE_CODE_AGENT_TYPE` env var carries the functional role.
2. **Prompts define behavior.** An agent named "Yeats" follows the issue-lifecycle prompt, not poetic instincts.
3. **Each agent prompt includes:** "Your team name is cosmetic. Your behavior is defined entirely by this prompt."
4. **Don't roleplay.** Names appear in completion messages and team spawn configs. Agents do not adopt personalities during work.
5. **Subagent mode ignores names.** When TeammateTool is not available, functional names like "issue-50" are used instead.
