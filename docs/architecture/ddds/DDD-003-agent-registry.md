# DDD-003: Agent Registry Domain Design

**Status:** Proposed
**Date:** 2026-04-02

---

## Domain Overview

The agent registry manages Specflow's collection of 32 agent prompts. Agents are markdown documents with YAML frontmatter that define specialized roles for LLM-assisted development. The registry makes them discoverable, searchable, and retrievable — by CLI commands, MCP tools, and other agents.

---

## Ubiquitous Language

| Term | Definition |
|------|-----------|
| **Agent** | A markdown document defining a specialized LLM role with instructions, inputs, outputs, and process steps. |
| **Frontmatter** | YAML metadata block at the top of an agent file, delimited by `---`. |
| **Category** | Classification of agent purpose: orchestration, compliance, testing, generation, lifecycle, remediation, documentation. |
| **Trigger** | Natural language phrase that describes when to invoke this agent (e.g., "Run board audit"). |
| **Contract Binding** | List of contract IDs whose rules should be injected as context when the agent is retrieved. |
| **Agent Index** | In-memory map of agent name → metadata, built by scanning the agents directory. |

---

## Aggregates

### Agent (root aggregate)

```
Agent
├── name: string                # Unique identifier (e.g., "board-auditor")
├── description: string         # One-line summary
├── category: Category          # Enum: orchestration | compliance | testing | generation | lifecycle | remediation | documentation
├── trigger: string             # When to invoke (natural language)
├── inputs: string[]            # What the agent needs
├── outputs: string[]           # What the agent produces
├── contracts: string[]         # Contract IDs for context injection
├── filePath: string            # Absolute path to .md file
└── content: string             # Full markdown body (loaded on demand)
```

### Category (value object / enum)

```
orchestration   — Coordinate multi-agent workflows
compliance      — Audit and enforce standards
testing         — Generate and run tests
generation      — Create code, contracts, tests
lifecycle       — Manage issue and project lifecycle
remediation     — Fix problems and violations
documentation   — Audit and improve documentation
```

---

## Domain Services

### AgentRegistry

**Responsibility:** Scan agent files, parse frontmatter, build index, serve queries.

```
AgentRegistry
  .initialize(agentsDir) → void       # Scan directory, build index
  .list(category?) → AgentSummary[]   # List all or by category
  .get(name) → Agent                  # Full agent with content + contract context
  .search(query) → AgentSummary[]     # Fuzzy search across fields
  .categories() → CategorySummary[]   # List categories with counts
```

### AgentSummary (read model for list/search)

```
AgentSummary
├── name: string
├── description: string
├── category: string
└── trigger: string
```

Excludes content and contract context — lightweight for listing.

### Contract Context Injection

When `get(name)` is called and the agent has `contracts: ["security_defaults"]`:

1. Load `security_defaults` contract via ContractLoader (from DDD-001)
2. Extract rule IDs and descriptions
3. Append to agent content:

```markdown
---

## Active Contract Context

Your output must comply with the following active contracts.

### security_defaults
| Rule | Description |
|------|-------------|
| SEC-001 | No hardcoded secrets |
| SEC-002 | No SQL injection |
| SEC-003 | No XSS via innerHTML |
| SEC-004 | No eval() |
| SEC-005 | No path traversal |
```

This is appended at retrieval time, never stored in the file.

---

## Agent Discovery Algorithm

```
1. Glob agents/*.md (exclude README.md, PROTOCOL.md, WORKFLOW.md, agentlist.md, agentnames.md, team-names.md)
2. For each file:
   a. Read first 50 lines
   b. Check for --- delimiter on line 1
   c. Find closing --- delimiter
   d. Parse YAML between delimiters
   e. Validate required fields: name, description, category
   f. If valid: add to index
   g. If no frontmatter: log warning, skip (graceful degradation)
3. Build name → AgentSummary map
```

### Graceful Degradation

If an agent file has no frontmatter or invalid frontmatter:
- `list` excludes it but logs a warning
- `doctor` reports it as a warning ("agent board-auditor.md missing frontmatter")
- The file still works as a manual prompt — frontmatter is optional for human use

---

## Search Algorithm

Simple ranked search across agent fields:

```
score(agent, query):
  tokens = query.toLowerCase().split(/\s+/)
  score = 0
  for each token:
    if agent.name.includes(token): score += 3      # Name match is strongest
    if agent.trigger.includes(token): score += 2   # Trigger match is strong
    if agent.description.includes(token): score += 1
    if agent.category === token: score += 2         # Exact category match
  return score

search(query):
  return agents
    .map(a => ({ agent: a, score: score(a, query) }))
    .filter(r => r.score > 0)
    .sort((a, b) => b.score - a.score)
```

No external search library needed. 32 agents is a trivially small corpus.

---

## File Layout

### Before (current)

```
agents/
├── README.md                    # Meta documentation
├── PROTOCOL.md                  # Agent protocol
├── WORKFLOW.md                  # Workflow guide
├── agentlist.md                 # Flat list
├── agentnames.md                # Names and aliases
├── team-names.md                # Team coordination
├── board-auditor.md             # Agent (no frontmatter)
├── contract-generator.md        # Agent (no frontmatter)
└── ... (26 more agents)
```

### After

```
agents/
├── README.md                    # Updated with frontmatter instructions
├── PROTOCOL.md                  # Unchanged
├── WORKFLOW.md                  # Unchanged
├── board-auditor.md             # Agent (with frontmatter)
├── contract-generator.md        # Agent (with frontmatter)
└── ... (30 more agents)
```

Meta files (`agentlist.md`, `agentnames.md`, `team-names.md`) are removed — the registry replaces them. Their content (aliases, team groupings) is captured in frontmatter fields.

---

## Validation Rules (for `specflow doctor`)

| Check | Severity |
|-------|----------|
| Agent file exists but has no frontmatter | WARNING |
| Frontmatter missing required field (name, description, category) | WARNING |
| Category not in allowed enum | WARNING |
| Duplicate agent names across files | ERROR |
| Contract binding references non-existent contract | WARNING |

---

## Testing Strategy

### Unit Tests

- Parse frontmatter from sample agent files
- Registry builds correct index
- Search returns ranked results
- Contract context injection appends correct content
- Graceful handling of files without frontmatter

### Integration Tests

- `specflow agent list` produces correct output
- `specflow agent show <name>` returns full content
- `specflow agent search <query>` finds relevant agents
- MCP tools return matching data
