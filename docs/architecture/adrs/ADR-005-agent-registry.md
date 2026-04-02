# ADR-005: Agent Registry Design

**Status:** Proposed
**Date:** 2026-04-02
**Phase:** 5

## Context

Specflow has 32 agent markdown files. These are prompt templates designed to be used with Claude Code or other LLMs. Currently they have no structured metadata — you have to read each file to know what it does, what it expects as input, and what it produces.

For agents to be discoverable (via CLI or MCP), they need structured metadata that can be parsed programmatically.

## Decision

### YAML Frontmatter

Add YAML frontmatter to each agent `.md` file, delimited by `---` markers:

```yaml
---
name: board-auditor
description: Audits GitHub project board for Specflow compliance
category: compliance
trigger: "Run board audit"
inputs:
  - repo
  - milestone
outputs:
  - compliance-report
  - violations
contracts:
  - feature_preflight
---

# Agent: Board Auditor
... (existing content unchanged)
```

### Frontmatter is additive

The existing markdown content is NOT modified. Frontmatter is prepended. Any tool that renders the markdown (GitHub, editors, LLMs) either renders the frontmatter as a table (GitHub) or ignores it.

### Registry at runtime

`src/agents/registry.js` scans `agents/*.md`, parses frontmatter with `js-yaml`, and builds an in-memory index. This is fast (32 files, < 10ms) and doesn't need caching to disk.

### No manifest file

We considered a separate `agents/manifest.json` index file. Rejected because:
- It would go stale when agents are added/modified
- Frontmatter is the source of truth — the registry derives from it
- One file per agent is simpler to maintain

### Contract injection

When an agent is retrieved (via CLI `show` or MCP `get_agent`), if its `contracts` field lists contract IDs, the retrieval function appends a "Active Contract Context" section with the current rules from those contracts. This is computed at read time, not stored.

## Alternatives Considered

### JSON sidecar files
Each agent gets a `.json` metadata file alongside the `.md` file. Rejected: doubles the file count, easy to forget updating the sidecar.

### Single agents.yml manifest
One YAML file listing all agents with metadata. Rejected: merge conflicts when multiple people add agents, metadata divorced from content.

### No metadata, parse markdown headers
Extract agent name from `# Agent:` header, description from first paragraph, etc. Rejected: brittle, can't express structured fields like inputs/outputs.

## Consequences

### Positive
- Agents become searchable and indexable
- CLI and MCP can list/filter/retrieve agents programmatically
- Zero breaking changes to existing content
- Standard format (YAML frontmatter) familiar to developers

### Negative
- 32 files need frontmatter added (one-time effort)
- Frontmatter can go stale if agent content changes and metadata isn't updated
  - Mitigation: `specflow doctor` can validate frontmatter completeness
