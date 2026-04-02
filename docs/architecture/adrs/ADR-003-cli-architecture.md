# ADR-003: CLI Architecture

**Status:** Proposed
**Date:** 2026-04-02
**Phase:** 2

## Context

The CLI needs to serve two modes:
1. **Interactive CLI** — developer runs `specflow init`, `specflow doctor`, etc. in a terminal
2. **MCP server** — Claude Code pipes JSON-RPC over stdin/stdout

These modes have fundamentally different I/O requirements. The CLI must detect which mode to use and route accordingly.

## Decision

### Entry Point: `bin/specflow.js`

```
#!/usr/bin/env node

1. If stdin is not a TTY AND (no args OR first arg is "mcp"):
   → Import and start MCP server (src/mcp/server.js)
   → All output goes to stderr (stdout is protocol)

2. Otherwise:
   → Import CLI router (src/cli.js)
   → Parse args, route to command module
   → All output goes to stdout/stderr normally
```

### CLI Router: `src/cli.js`

Minimal arg parsing using Node.js built-in `util.parseArgs` (available since Node.js 18.3). No external dependency.

```
Commands:
  init [dir]              → src/commands/init.js
  doctor [dir]            → src/commands/doctor.js
  enforce [dir]           → src/commands/enforce.js
  update [dir]            → src/commands/update.js
  compile <csv>           → src/commands/compile.js
  audit <issue>           → src/commands/audit.js
  graph [dir]             → src/commands/graph.js
  status [dir]            → src/commands/status.js
  agent list|show|search  → src/commands/agent.js
  mcp start|register|unregister → src/commands/mcp.js
  --version               → print version from package.json
  --help                  → print usage
```

### Command Module Contract

Each command module exports a single async function:

```javascript
// src/commands/doctor.js
module.exports = async function doctor(args, options) {
  // args: positional arguments
  // options: parsed flags (--json, --fix, --strict, etc.)
  // returns: { exitCode: 0|1, data: object }
}
```

The CLI router calls the function, handles `--json` output formatting, and sets `process.exitCode`.

### Output Formatting

Every command supports two output modes:

1. **Human mode (default):** Colored text, tables, progress indicators to stdout
2. **JSON mode (`--json`):** Structured JSON object to stdout, no colors

This is handled by `src/utils/logger.js` which checks a global `--json` flag.

### No Framework Dependency

We use zero CLI framework dependencies (no commander, yargs, oclif). Reasons:
- The command set is small and stable (10 commands)
- `util.parseArgs` handles flag parsing
- Less dependency surface = less breakage
- Package stays small

## Alternatives Considered

### Use commander.js or yargs
These provide auto-generated help, subcommand routing, and validation. But they add 50-200KB to the package, introduce dependency maintenance, and abstract away control we need for MCP mode detection.

### Separate binary for MCP (`specflow-mcp`)
Two bin entries: `specflow` for CLI, `specflow-mcp` for MCP server. This is cleaner separation but requires users to know which binary to register. One binary with mode detection is simpler for users.

## Consequences

### Positive
- Single entry point for both CLI and MCP
- No CLI framework dependency
- Consistent command module interface
- JSON output for all commands enables CI integration

### Negative
- Must maintain our own arg parser and help text
- Mode detection based on TTY can be wrong in edge cases (piped CLI usage)
  - Mitigation: explicit `specflow mcp start` command bypasses TTY detection
