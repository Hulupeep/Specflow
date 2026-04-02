# PRD-002: Specflow MCP Server

**Status:** Proposed
**Author:** Specflow Team
**Phase:** 3
**Priority:** High
**Depends on:** PRD-001 (CLI Rewrite)

---

## Problem Statement

Claude Code has no awareness of Specflow contracts. Enforcement happens reactively through hooks — after code is written, a hook detects the change and runs tests. This means violations are caught late: code is written, hook fires, test fails, code gets rewritten.

An MCP server makes Claude Code **proactively contract-aware**. Before writing code, Claude can check "would this violate any contracts?" and avoid the violation entirely. This is the difference between a speed bump and a guardrail.

## Goals

1. Expose Specflow's contract engine as MCP tools callable by Claude Code
2. Enable proactive contract checking before code is written
3. Support `claude mcp add specflow -- specflow mcp start` registration
4. Zero configuration beyond registration — auto-discovers contracts in the project

## Non-Goals

- Web-based MCP transport (stdio only for v1.0)
- Real-time contract file watching (future)
- Multi-project support in one server instance
- Authentication or access control

---

## MCP Tools

### `specflow_list_contracts`

**Description:** List all contracts in the project with their rules and status.

**Input:** `{ "dir": "string (optional, defaults to cwd)" }`

**Output:**
```json
{
  "contracts": [
    {
      "id": "security_defaults",
      "file": "docs/contracts/security_defaults.yml",
      "rules": 5,
      "rule_ids": ["SEC-001", "SEC-002", "SEC-003", "SEC-004", "SEC-005"],
      "covers": ["OWASP Top 10 baseline"]
    }
  ],
  "total_contracts": 7,
  "total_rules": 35
}
```

### `specflow_check_code`

**Description:** Test a code snippet against all contract patterns. Use this before writing code to check if it would violate any contracts.

**Input:**
```json
{
  "code": "string — the code to check",
  "file_path": "string (optional) — target file path for scope matching",
  "contract": "string (optional) — check against specific contract only"
}
```

**Output:**
```json
{
  "clean": false,
  "violations": [
    {
      "contract": "security_defaults",
      "rule": "SEC-001",
      "pattern": "hardcoded secret detected",
      "match": "password = 'hunter2'",
      "line": 3,
      "message": "Hardcoded secret detected — use environment variable"
    }
  ],
  "rules_checked": 35,
  "rules_passed": 34
}
```

### `specflow_get_violations`

**Description:** Scan a file or directory against all contracts.

**Input:**
```json
{
  "path": "string — file or directory to scan",
  "contract": "string (optional) — specific contract to check"
}
```

**Output:**
```json
{
  "scanned_files": 12,
  "violations": [
    {
      "file": "src/auth.js",
      "line": 15,
      "contract": "security_defaults",
      "rule": "SEC-001",
      "message": "Hardcoded secret detected"
    }
  ],
  "summary": { "files_clean": 11, "files_violated": 1, "total_violations": 1 }
}
```

### `specflow_validate_contract`

**Description:** Validate a YAML contract file's schema and patterns.

**Input:** `{ "file": "string — path to contract YAML file" }`

**Output:**
```json
{
  "valid": true,
  "errors": [],
  "warnings": ["Rule SEC-003 has no example_compliant code"],
  "rules_found": 5,
  "patterns_compiled": 12
}
```

### `specflow_audit_issue`

**Description:** Audit a GitHub issue for compliance markers.

**Input:** `{ "issue_number": "number", "repo": "string (optional)" }`

**Output:**
```json
{
  "compliant": false,
  "checks": {
    "has_gherkin": true,
    "has_journey_id": true,
    "has_contract_ref": false,
    "has_acceptance_criteria": true
  },
  "missing": ["contract_ref"],
  "journey_ids": ["J-LOGIN-FLOW"]
}
```

### `specflow_compile_journeys`

**Description:** Compile a journey CSV file into contract YAML and Playwright test stubs.

**Input:** `{ "csv_file": "string", "output_dir": "string (optional)" }`

**Output:**
```json
{
  "contracts_generated": 3,
  "test_stubs_generated": 3,
  "files": [
    "docs/contracts/journey_login.yml",
    "tests/e2e/journey_login.spec.ts"
  ]
}
```

### `specflow_verify_graph`

**Description:** Run contract graph integrity checks.

**Input:** `{ "dir": "string (optional)" }`

**Output:**
```json
{
  "passed": 6,
  "failed": 1,
  "checks": [
    { "name": "contract_files_exist", "passed": true },
    { "name": "test_file_references", "passed": false, "details": "journey_signup.spec.ts not found" }
  ]
}
```

### `specflow_defer_journey`

**Description:** Add or remove a journey deferral.

**Input:**
```json
{
  "journey_id": "J-LOGIN-FLOW",
  "reason": "Waiting on auth service deployment",
  "issue": "#456",
  "action": "defer | undefer"
}
```

**Output:** `{ "deferred": true, "journal_entries": 3 }`

---

## Technical Design

### Protocol

- Transport: stdio (stdin/stdout)
- Protocol: JSON-RPC 2.0 (MCP specification)
- Logging: stderr only (stdout reserved for protocol)

### Mode Detection

In `bin/specflow.js`:
```
if (!process.stdin.isTTY && (no args OR args[0] === 'mcp')) {
  → start MCP server
} else {
  → start CLI
}
```

### Server Lifecycle

1. Read JSON-RPC messages from stdin (newline-delimited)
2. Handle `initialize` → return capabilities and tool list
3. Handle `tools/list` → return 8 tool definitions
4. Handle `tools/call` → execute tool, return result
5. Handle `ping` → return pong
6. On stdin close → exit cleanly

### Contract Engine Reuse

The MCP server uses the same `src/contracts/loader.js` and `src/contracts/scanner.js` as the CLI `enforce` command. No duplication.

---

## Registration UX

```bash
# Register with Claude Code
specflow mcp register

# This runs:
# claude mcp add specflow -- specflow mcp start

# Or manually:
claude mcp add specflow -- npx @colmbyrne/specflow mcp start

# Unregister
specflow mcp unregister
```

---

## Acceptance Criteria

- [ ] `specflow mcp start` starts a stdio MCP server
- [ ] `claude mcp add specflow -- specflow mcp start` registers successfully
- [ ] All 8 MCP tools return correct results
- [ ] `specflow_check_code` catches violations the contract tests catch
- [ ] Server exits cleanly when stdin closes
- [ ] All output goes to stderr (stdout is protocol-only)
- [ ] Works with Claude Code's MCP protocol version
