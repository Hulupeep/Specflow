# PRD-004: Agent System

**Status:** Proposed
**Author:** Specflow Team
**Phase:** 5
**Priority:** Medium
**Depends on:** PRD-001 (CLI Rewrite), PRD-002 (MCP Server)

---

## Problem Statement

Specflow has 32 agent prompt files in `agents/`. They're valuable — each defines a specialized role for LLM-assisted development (board auditor, contract generator, journey enforcer, etc.). But they're undiscoverable: flat markdown files with no structured metadata, no index, no way to search or invoke them programmatically. A developer has to browse the directory and read each file to know what's available.

## Goals

1. Add structured YAML frontmatter to all 32 agents
2. Provide CLI commands to list, search, and display agents
3. Expose agents through MCP tools
4. Make agents contract-aware (inject active contract context)

## Non-Goals

- Autonomous agent execution (agents are prompts, not daemons)
- Multi-agent orchestration runtime (that's what Claude Code + waves-controller handles)
- Agent marketplace or community contributions (future)

---

## Agent Frontmatter Schema

Every agent `.md` file gets YAML frontmatter:

```yaml
---
name: board-auditor
description: Audits GitHub project board for Specflow compliance
category: compliance        # orchestration | compliance | testing | generation | lifecycle
trigger: "Run board audit"  # Natural language trigger phrase
inputs:
  - repo                    # GitHub repository (owner/name)
  - milestone               # Optional milestone filter
outputs:
  - compliance-report       # Markdown report of issues checked
  - violations              # List of non-compliant issues
contracts:                  # Contracts this agent should be aware of
  - feature_preflight       # ARCH-001 through ARCH-008
---

# Agent: Board Auditor
... (existing content unchanged)
```

### Categories

| Category | Description | Agents |
|----------|-------------|--------|
| `orchestration` | Coordinate multi-agent workflows | waves-controller, sprint-executor |
| `compliance` | Audit and enforce standards | board-auditor, contract-validator, quality-gate, journey-gate |
| `testing` | Generate and run tests | e2e-test-auditor, test-runner, journey-tester, journey-enforcer |
| `generation` | Create code, contracts, tests | contract-generator, contract-test-generator, frontend-builder, edge-function-builder, migration-builder, db-coordinator, playwright-from-specflow |
| `lifecycle` | Manage issue and project lifecycle | specflow-writer, ticket-closer, issue-lifecycle, dependency-mapper |
| `remediation` | Fix problems | heal-loop, specflow-uplifter, pre-flight-simulator |
| `documentation` | Audit and improve docs | readme-audit, readme-restructure |

---

## CLI Commands

### `specflow agent list [--category <cat>] [--json]`

Output:
```
AGENTS (32 total)

  ORCHESTRATION (2)
    waves-controller     Orchestrate wave-based parallel execution
    sprint-executor      Execute a sprint's worth of issues

  COMPLIANCE (4)
    board-auditor        Audit GitHub board for Specflow compliance
    contract-validator   Validate contract YAML schema and patterns
    quality-gate         Enforce quality standards before merge
    journey-gate         Gate on journey test completion

  TESTING (4)
    ...
```

### `specflow agent show <name>`

Prints the full agent prompt markdown to stdout. Useful for piping into Claude Code or copying.

### `specflow agent search <query>`

Fuzzy search across name, description, trigger, inputs, outputs.

```bash
$ specflow agent search "audit"
  board-auditor        Audit GitHub board for Specflow compliance
  e2e-test-auditor     Audit E2E test quality and coverage
  readme-audit         Audit README for accuracy and completeness
```

---

## MCP Tools

### `specflow_list_agents`

**Input:** `{ "category": "string (optional)" }`
**Output:** Array of agent objects with name, description, category, trigger, inputs, outputs.

### `specflow_get_agent`

**Input:** `{ "name": "string" }`
**Output:** Full agent prompt text with frontmatter parsed into structured fields.

---

## Contract-Aware Agents

Agents that generate code or audit compliance should receive active contract context. When `specflow agent show` is called (or the MCP tool retrieves an agent), if the agent's `contracts` field lists contract IDs, append a section:

```markdown
## Active Contract Context

The following contracts are active in this project. Your output must not violate these rules.

### security_defaults (5 rules)
- SEC-001: No hardcoded secrets
- SEC-002: No SQL injection
- SEC-003: No XSS via innerHTML
- SEC-004: No eval()
- SEC-005: No path traversal
```

This injection happens at retrieval time, not stored in the file.

---

## Implementation

### Agent Registry (`src/agents/registry.js`)

```
1. Scan agents/*.md files
2. Parse YAML frontmatter from each
3. Build in-memory index: { name → { metadata, filePath } }
4. Provide: list(), get(name), search(query), categories()
```

### Frontmatter Parsing

Use existing `js-yaml` dependency. Split file on `---` markers, parse first block as YAML, rest is markdown content.

---

## Acceptance Criteria

- [ ] All 32 agent files have valid YAML frontmatter
- [ ] `specflow agent list` shows all agents grouped by category
- [ ] `specflow agent show waves-controller` prints the full prompt
- [ ] `specflow agent search "audit"` returns relevant matches
- [ ] MCP tools `specflow_list_agents` and `specflow_get_agent` work
- [ ] Agents with `contracts` field get contract context injected
- [ ] Existing agent content is unchanged (frontmatter is additive)
