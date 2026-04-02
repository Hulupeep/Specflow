# PRD-003: Installation & Packaging

**Status:** Proposed
**Author:** Specflow Team
**Phase:** 4
**Priority:** High
**Depends on:** PRD-001 (CLI Rewrite)

---

## Problem Statement

Installing Specflow currently means cloning the repo or running `npx @colmbyrne/specflow init .`, which works but has rough edges: the postinstall banner is vague, there's no system prerequisites check, and the init process can fail silently if `jq` or other tools are missing. There's no one-line install comparable to modern CLI tools.

## Goals

1. One-line install via `curl | bash`
2. Clean global install via `npm install -g @colmbyrne/specflow`
3. `npx @colmbyrne/specflow` works without global install
4. Install script checks prerequisites and gives clear errors
5. Package contains only framework files (no sample apps, no project-specific content)

## Non-Goals

- Windows native installer (WSL works)
- Homebrew formula (future)
- Docker image (future)

---

## Install Script (`scripts/install.sh`)

### Flow

```
1. Print banner
2. Check Node.js >= 20 (fail with install instructions if missing)
3. Check npm >= 9 (fail with upgrade instructions if missing)
4. npm install -g @colmbyrne/specflow@latest
5. Verify: specflow --version
6. Run: specflow doctor (quick check)
7. Ask: Register MCP server with Claude Code? (y/n)
   → If yes: specflow mcp register
8. Print next steps
```

### Flags

- `--no-mcp` — skip MCP registration prompt
- `--version <ver>` — install specific version

### Hosting

Primary: `https://cdn.jsdelivr.net/gh/Hulupeep/Specflow@main/scripts/install.sh`
Mirror: Raw GitHub URL as fallback

### Usage

```bash
# Default install
curl -fsSL https://cdn.jsdelivr.net/gh/Hulupeep/Specflow@main/scripts/install.sh | bash

# Skip MCP registration
curl -fsSL ... | bash -s -- --no-mcp
```

---

## Package Contents (`files` in package.json)

### Included

```
bin/                  # CLI entry point
src/                  # All Node.js source (commands, hooks, contracts, mcp)
agents/               # 32 agent prompt files
templates/            # Default contracts, CI workflows, journey template
hooks/                # Hook script templates (Node.js)
scripts/              # Compiler, graph validator
examples/             # Reference contract, test, journey CSV
CLAUDE.md
CLAUDE-MD-TEMPLATE.md
SKILL.md
CI-INTEGRATION.md
LICENSE
README.md
```

### Excluded (not in `files` array)

```
sample apps/          # Moved to separate repo
supabase/             # Deleted
context/              # Merged into docs/
ruflo/                # Dev tooling
docs/                 # Reference docs (available on GitHub, not in npm package)
docs-2/               # Planning docs
tests/                # Test suite (available on GitHub, not in npm package)
demo/                 # Demo project (available on GitHub)
scripts/legacy/       # Old bash scripts
node_modules/
.claude/              # Generated per-project, not shipped
.claude-flow/         # Ruflo runtime
.swarm/               # Ruflo memory
.hive-mind/           # Ruflo sessions
```

### Package Size Target

- `npm pack` output: < 500KB
- No compiled/minified code (ship source, it's readable Node.js)

---

## package.json Updates

```json
{
  "name": "@colmbyrne/specflow",
  "version": "1.0.0",
  "description": "Specs that enforce themselves. Contract tests for LLM-guided development.",
  "license": "MIT",
  "bin": {
    "specflow": "bin/specflow.js"
  },
  "engines": {
    "node": ">=20"
  },
  "files": [
    "bin/",
    "src/",
    "agents/",
    "templates/",
    "hooks/",
    "scripts/specflow-compile.cjs",
    "scripts/verify-graph.cjs",
    "examples/",
    "CLAUDE.md",
    "CLAUDE-MD-TEMPLATE.md",
    "SKILL.md",
    "CI-INTEGRATION.md",
    "LICENSE"
  ],
  "dependencies": {
    "js-yaml": "^4.1.0"
  },
  "keywords": [
    "specflow",
    "contracts",
    "llm",
    "enforcement",
    "architecture",
    "testing",
    "claude-code",
    "mcp"
  ]
}
```

---

## Acceptance Criteria

- [ ] `curl -fsSL <url> | bash` installs Specflow on a clean Ubuntu 22.04 with Node.js 20
- [ ] `npm install -g @colmbyrne/specflow` installs cleanly
- [ ] `npx @colmbyrne/specflow --version` works without global install
- [ ] `specflow --version` prints version after global install
- [ ] `npm pack` produces < 500KB tarball
- [ ] No sample apps, supabase, or project-specific files in package
- [ ] Install script gives clear error if Node.js < 20
