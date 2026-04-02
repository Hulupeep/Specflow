# DDD-001: Contract Engine Domain Design

**Status:** Proposed
**Date:** 2026-04-02

---

## Domain Overview

The contract engine is Specflow's core domain. It loads YAML contract files, compiles regex patterns, scans source code for violations, and reports results. Everything else in Specflow — the CLI, MCP server, hooks, agents — consumes the contract engine's output.

---

## Ubiquitous Language

| Term | Definition |
|------|-----------|
| **Contract** | A YAML file defining architectural rules for a codebase. Lives in `docs/contracts/`. |
| **Rule** | A single enforceable constraint within a contract. Has an ID (e.g., SEC-001), scope, and patterns. |
| **Scope** | Glob patterns defining which files a rule applies to (e.g., `src/**/*.ts`). |
| **Forbidden Pattern** | A regex that must NOT match in scoped files. A match = violation. |
| **Required Pattern** | A regex that MUST match in scoped files. No match = violation. |
| **Violation** | A forbidden pattern match or missing required pattern in a scoped file. |
| **Example Violation** | Code snippet in the contract that SHOULD trigger the pattern (test fixture). |
| **Example Compliant** | Code snippet that should NOT trigger the pattern (test fixture). |
| **Contract Meta** | Metadata block: contract ID, version, covered requirements, LLM policy. |
| **LLM Policy** | Instructions for LLMs about how to handle this contract (severity, auto-fix eligibility). |
| **Journey Contract** | A contract generated from a journey CSV, defining user flow steps. |
| **Deferral** | A temporary exemption for a journey test, logged in `.defer-journal`. |

---

## Aggregates

### Contract (root aggregate)

```
Contract
├── contract_meta
│   ├── id: string              # e.g., "security_defaults"
│   ├── version: string         # e.g., "1.0.0"
│   ├── covers_reqs: string[]   # e.g., ["OWASP Top 10"]
│   └── status: string          # "active" | "draft" | "deprecated"
├── llm_policy
│   ├── severity: string        # "error" | "warning"
│   ├── auto_fixable: boolean
│   └── instructions: string    # Natural language for LLMs
└── rules
    └── non_negotiable: Rule[]
```

### Rule (entity within Contract)

```
Rule
├── id: string                  # e.g., "SEC-001"
├── description: string
├── scope: string[]             # Glob patterns for target files
├── behavior
│   ├── forbidden_patterns: Pattern[]
│   └── required_patterns: Pattern[]
├── example_violation: string   # Code that triggers the pattern
└── example_compliant: string   # Code that doesn't trigger
```

### Pattern (value object)

```
Pattern
├── pattern: string             # Regex as string: "/regex/flags"
├── message: string             # Human-readable violation message
└── compiled: RegExp            # Compiled regex (runtime only, not serialized)
```

### Violation (value object, output of scanning)

```
Violation
├── contract_id: string
├── rule_id: string
├── file: string                # Path to violating file
├── line: number                # Line number of match
├── match: string               # Matched text
├── message: string             # Pattern's violation message
└── severity: string            # From llm_policy
```

---

## Domain Services

### ContractLoader

**Responsibility:** Read YAML files, parse into Contract aggregates, compile regex patterns.

```
ContractLoader
  .loadContract(filePath) → Contract
  .loadAll(directory) → Contract[]
  .validateContract(contract) → { valid, errors, warnings }
  .compilePattern(patternString) → RegExp
```

**Invariants:**
- Every pattern string must be a valid regex (compilation must not throw)
- Every rule must have at least one forbidden or required pattern
- Contract IDs must be unique across all loaded contracts
- Scope globs must be valid glob syntax

### ContractScanner

**Responsibility:** Scan files against compiled contracts, produce Violations.

```
ContractScanner
  .scanFile(filePath, contracts) → Violation[]
  .scanDirectory(dirPath, contracts) → Violation[]
  .checkSnippet(code, contracts, filePath?) → Violation[]
```

**Algorithm:**
```
For each contract:
  For each rule:
    Resolve scope globs → target files
    For each target file:
      Read file content
      For each forbidden pattern:
        Find all matches → create Violation per match
      For each required pattern:
        If no match found → create Violation
```

**Performance considerations:**
- Files are read once and cached for the scan session
- Scope resolution is done first to minimize file reads
- Patterns are compiled once in the loader, not per scan

### ContractReporter

**Responsibility:** Format Violations into human-readable or JSON output.

```
ContractReporter
  .formatHuman(violations, contracts) → string  # Colored terminal output
  .formatJSON(violations, contracts) → object   # Machine-readable
  .formatSummary(violations) → string           # One-line summary
```

---

## Domain Events

These are logical events that different parts of the system react to:

| Event | Produced by | Consumed by |
|-------|-------------|-------------|
| `ContractsLoaded` | ContractLoader | CLI status, MCP server cache |
| `ViolationFound` | ContractScanner | Reporter, hook error output |
| `ScanComplete` | ContractScanner | CLI exit code, MCP tool response |
| `ContractInvalid` | ContractLoader | Doctor check, MCP validation tool |

For v1.0, these are function return values, not an event bus. The structure exists so they can become events later if needed (e.g., for file watching).

---

## Bounded Context Boundaries

```
┌─────────────────────────────────────────────┐
│             Contract Engine                  │
│  (loader, scanner, reporter)                │
│                                             │
│  Owns: YAML parsing, regex compilation,     │
│        file scanning, violation reporting    │
│                                             │
│  Does NOT own: file system watching,        │
│        git operations, issue tracking,      │
│        test execution, hook lifecycle       │
└──────────────┬──────────────────────────────┘
               │ Violation[]
    ┌──────────┼──────────────┐
    │          │              │
    ▼          ▼              ▼
  CLI       MCP Server     Hooks
(enforce)  (check_code)   (compliance check)
```

The contract engine is a pure domain — it takes file paths and contract YAML as input and produces Violations as output. It has no knowledge of CLI, MCP, hooks, git, or GitHub. All integration happens in the consuming layers.

---

## Contract YAML Schema (existing, documented here for reference)

```yaml
contract_meta:
  id: string                    # Required. Unique identifier.
  version: string               # Required. Semver.
  covers_reqs: string[]         # Required. What requirements this covers.
  status: string                # Optional. "active" | "draft" | "deprecated"

llm_policy:
  severity: string              # "error" | "warning"
  auto_fixable: boolean         # Can an LLM auto-fix violations?
  instructions: string          # Natural language policy for LLMs

rules:
  non_negotiable:
    - id: string                # Required. Rule identifier (e.g., SEC-001)
      description: string       # Required. What this rule enforces.
      scope:                    # Required. Which files to check.
        - "src/**/*.ts"
        - "!src/**/*.test.*"    # Exclusion patterns with !
      behavior:
        forbidden_patterns:     # Patterns that MUST NOT appear
          - pattern: "/regex/flags"
            message: "Human-readable violation message"
        required_patterns:      # Patterns that MUST appear
          - pattern: "/regex/flags"
            message: "Human-readable missing-pattern message"
      example_violation: |      # Code that triggers forbidden pattern
        const password = 'hunter2'
      example_compliant: |      # Code that doesn't trigger
        const password = process.env.DB_PASSWORD
```

---

## Testing Strategy

### Unit Tests (contract engine internals)

- `loader.test.js` — YAML parsing, pattern compilation, validation
- `scanner.test.js` — file scanning, snippet checking, violation reporting
- `reporter.test.js` — output formatting

### Integration Tests (existing, keep as-is)

- `tests/contracts/*.test.js` — load real contracts, test real patterns against fixtures
- These are the 425 pattern tests that already pass

### Property Tests (future)

- Any valid regex string compiles without error
- Any violation from scanning has a non-empty file, line, and message
- JSON output is always valid JSON
