# Specflow v1.0 — Planning Documents

This directory contains the planning, architecture, and design documents for transforming Specflow from a repository of scripts into a standalone, installable CLI tool.

**Start here:** [Master Execution Plan](plan/MASTER-PLAN.md)

---

## Document Index

### Plan

| Document | Description |
|----------|-------------|
| [MASTER-PLAN.md](plan/MASTER-PLAN.md) | Top-level execution plan with 6 phases, dependencies, risks, and success metrics |

### PRDs (Product Requirement Documents)

| Document | Phase | Description |
|----------|-------|-------------|
| [PRD-001: CLI Rewrite](prds/PRD-001-cli-rewrite.md) | 2 | Replace bash scripts with Node.js CLI commands |
| [PRD-002: MCP Server](prds/PRD-002-mcp-server.md) | 3 | Stdio MCP server exposing contract tools to Claude Code |
| [PRD-003: Installation & Packaging](prds/PRD-003-installation-packaging.md) | 4 | One-line install, clean npm package, global CLI |
| [PRD-004: Agent System](prds/PRD-004-agent-system.md) | 5 | Agent frontmatter, registry, CLI commands, MCP tools |

### ADRs (Architecture Decision Records)

| Document | Decision |
|----------|----------|
| [ADR-001: Repository Structure](adrs/ADR-001-repository-structure.md) | Clean root, move docs, remove sample apps |
| [ADR-002: Node.js Over Bash](adrs/ADR-002-nodejs-over-bash.md) | Rewrite all bash scripts in Node.js, eliminate jq dependency |
| [ADR-003: CLI Architecture](adrs/ADR-003-cli-architecture.md) | Single entry point, mode detection, no CLI framework dependency |
| [ADR-004: MCP Server Design](adrs/ADR-004-mcp-server-design.md) | Stdio JSON-RPC, minimal protocol, reuse contract engine |
| [ADR-005: Agent Registry](adrs/ADR-005-agent-registry.md) | YAML frontmatter on agent files, runtime index, no manifest file |

### DDDs (Domain Design Documents)

| Document | Domain |
|----------|--------|
| [DDD-001: Contract Engine](ddds/DDD-001-contract-engine.md) | YAML loading, regex compilation, file scanning, violation reporting |
| [DDD-002: Enforcement Pipeline](ddds/DDD-002-enforcement-pipeline.md) | Git/build/edit/CI gates, hook protocol, journey enforcement, deferrals |
| [DDD-003: Agent Registry](ddds/DDD-003-agent-registry.md) | Agent discovery, search, contract context injection |

---

## Phase Dependencies

```
Phase 1: Clean Foundation (ADR-001)
    |
    v
Phase 2: CLI Rewrite (PRD-001, ADR-002, ADR-003, DDD-001, DDD-002)
    |           |
    v           v
Phase 3:     Phase 4:
MCP Server   Install Script
(PRD-002,    (PRD-003)
 ADR-004)
    |           |
    v           v
Phase 5: Agent System (PRD-004, ADR-005, DDD-003)
    |
    v
Phase 6: Documentation & Polish
```
