# ADR-004: MCP Server Design

**Status:** Proposed
**Date:** 2026-04-02
**Phase:** 3

## Context

Claude Code supports MCP (Model Context Protocol) servers that expose tools callable during conversations. An MCP server makes Claude Code aware of Specflow contracts without relying on hooks that fire after code is already written.

The MCP server must:
- Speak JSON-RPC 2.0 over stdio
- Expose contract-related tools
- Reuse the same contract engine as the CLI
- Be registerable with a single command

## Decision

### Transport: stdio only

Use stdin/stdout for JSON-RPC communication. This is the simplest transport, requires no network configuration, and is how Claude Code expects local MCP servers to work.

No HTTP/SSE transport for v1.0. If needed later, it can be added as an alternative transport behind the same tool handlers.

### Protocol Implementation

Build a minimal JSON-RPC 2.0 handler rather than depending on an MCP SDK. The protocol surface we need is small:

| Method | Purpose |
|--------|---------|
| `initialize` | Exchange capabilities, protocol version |
| `tools/list` | Return tool definitions |
| `tools/call` | Execute a tool |
| `ping` | Heartbeat |

This is ~150 lines of protocol code. An SDK would add thousands of lines of dependency for the same result.

### Tool Definitions

Tools map 1:1 to contract engine functions:

| MCP Tool | Engine Function | Module |
|----------|----------------|--------|
| `specflow_list_contracts` | `loader.listContracts()` | `src/contracts/loader.js` |
| `specflow_check_code` | `scanner.checkSnippet(code, contracts)` | `src/contracts/scanner.js` |
| `specflow_get_violations` | `scanner.scanPath(path, contracts)` | `src/contracts/scanner.js` |
| `specflow_validate_contract` | `loader.validateContract(file)` | `src/contracts/loader.js` |
| `specflow_audit_issue` | `audit(issueNumber)` | `src/commands/audit.js` |
| `specflow_compile_journeys` | `compile(csvFile)` | `src/commands/compile.js` |
| `specflow_verify_graph` | `graph(dir)` | `src/commands/graph.js` |
| `specflow_defer_journey` | `defer(journeyId, reason)` | `src/contracts/defer.js` |

### Logging

All diagnostic output goes to stderr. Stdout is reserved exclusively for JSON-RPC messages. This is critical — any stray `console.log` would corrupt the protocol stream.

### Contract Discovery

On initialization, the server:
1. Reads `docs/contracts/*.yml` from cwd (or specified dir)
2. Loads and compiles all patterns
3. Caches compiled contracts in memory
4. Re-scans if a tool call specifies a different directory

No file watching for v1.0. The server loads contracts once at startup. If contracts change, restart the server (Claude Code handles this via MCP lifecycle).

### Registration

```bash
# Register
specflow mcp register
# → Runs: claude mcp add specflow -- specflow mcp start

# For npx users (no global install):
claude mcp add specflow -- npx @colmbyrne/specflow mcp start

# Unregister
specflow mcp unregister
# → Runs: claude mcp remove specflow
```

## Alternatives Considered

### Use @modelcontextprotocol/sdk
The official MCP TypeScript SDK. Provides protocol handling, transport abstraction, and type safety. However:
- Adds a significant dependency
- Requires TypeScript or complex type imports
- We only need 4 protocol methods
- Building it ourselves keeps the codebase simple and educational

### HTTP/SSE transport
Would allow remote MCP server usage (shared team server). But adds complexity (port management, CORS, auth) that isn't needed for v1.0. Can be added later.

### Expose hooks via MCP instead of separate hook scripts
Instead of `.claude/hooks/` scripts, the MCP server could handle all enforcement. This would be cleaner but MCP tools are pull-based (Claude calls them) while hooks are push-based (fire automatically). Both mechanisms have value.

## Consequences

### Positive
- Claude Code becomes contract-aware natively
- Proactive checking (before writing code) not just reactive (after writing)
- Reuses existing contract engine — no duplication
- Simple protocol implementation, easy to debug
- Single command registration

### Negative
- Must keep protocol implementation in sync with MCP spec changes
  - Mitigation: MCP spec is stable, our surface is minimal
- Contracts loaded once at startup — stale if changed during session
  - Mitigation: acceptable for v1.0, file watching can be added later
