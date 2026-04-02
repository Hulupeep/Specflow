# DDD-002: Enforcement Pipeline Domain Design

**Status:** Proposed
**Date:** 2026-04-02

---

## Domain Overview

The enforcement pipeline is the sequence of checkpoints that prevent non-compliant code from shipping. It operates at three layers: git (commit time), build (test time), and Claude Code (tool use time). Each layer is independent — if one fails or is absent, the others still enforce.

---

## Ubiquitous Language

| Term | Definition |
|------|-----------|
| **Enforcement Point** | A moment in the development workflow where contracts are checked. |
| **Gate** | An enforcement point that blocks progress on failure (exit code != 0). |
| **Check** | An enforcement point that reports but doesn't block (warning). |
| **Commit Gate** | Git commit-msg hook. Rejects commits without `#issue-number`. |
| **Build Gate** | Post-build hook. Runs journey tests for issues in recent commits. |
| **Edit Check** | PostToolUse hook on Write/Edit. Scans changed file against contracts. |
| **CI Gate** | GitHub Actions workflow. Blocks PR merge if contract tests fail. |
| **MCP Check** | MCP tool call. Claude checks code before writing it. |
| **Journey** | A user flow defined in CSV, compiled to contract + Playwright test. |
| **Deferral** | Temporary exemption from a journey gate, logged with reason and issue. |
| **Baseline** | Snapshot of contract compliance state at a point in time. |

---

## Pipeline Architecture

```
Developer writes code
        │
        ▼
┌─ MCP Check (proactive) ──────────────────────┐
│  Claude calls specflow_check_code before      │
│  writing. Avoids violations before they exist.│
│  NOT a gate — advisory only.                  │
└───────────────────────────────────────────────┘
        │
        ▼
┌─ Edit Check (reactive) ───────────────────────┐
│  PostToolUse hook fires after Write/Edit.     │
│  Scans changed file against all contracts.    │
│  Exit 2 = show error to Claude (soft gate).   │
└───────────────────────────────────────────────┘
        │
        ▼
┌─ Commit Gate ─────────────────────────────────┐
│  git commit-msg hook.                         │
│  Rejects if no #issue-number in message.      │
│  Exit 1 = commit rejected (hard gate).        │
└───────────────────────────────────────────────┘
        │
        ▼
┌─ Build Gate ──────────────────────────────────┐
│  PostToolUse hook fires after Bash.           │
│  Detects build/commit success.                │
│  Extracts issues from recent commits.         │
│  Maps issues → journeys → test files.         │
│  Runs Playwright tests.                       │
│  Exit 2 = show error to Claude (soft gate).   │
└───────────────────────────────────────────────┘
        │
        ▼
┌─ CI Gate ─────────────────────────────────────┐
│  GitHub Actions on pull_request.              │
│  Runs: specflow enforce                       │
│  Posts compliance report as PR comment.        │
│  Blocks merge if violations found.            │
└───────────────────────────────────────────────┘
```

---

## Hook Protocol

Claude Code hooks receive JSON on stdin and communicate via exit codes:

### Input (from Claude Code)

```json
{
  "tool_name": "Write",
  "tool_input": {
    "file_path": "/path/to/file.ts",
    "content": "..."
  },
  "tool_output": "File written successfully"
}
```

### Output (exit codes)

| Exit Code | Meaning | Effect |
|-----------|---------|--------|
| 0 | Pass (or not applicable) | Continue silently |
| 1 | Script error | Claude Code reports error |
| 2 | Enforcement failure | Error shown to model, model should fix |

### Hook Types Used

| Claude Code Hook | Specflow Handler | Purpose |
|-----------------|------------------|---------|
| `PostToolUse` matcher `Write\|Edit` | `check-compliance.js` | Scan changed file against contracts |
| `PostToolUse` matcher `Bash` | `post-build-check.js` | Detect build success → run journey tests |
| `PostToolUse` matcher `Bash` | (future) `post-push-ci.js` | Poll CI after push |

---

## Journey Enforcement Flow

The most complex enforcement path:

```
1. Developer commits with message "feat: auth (#123)"
2. Build succeeds (npm run build)
3. PostToolUse:Bash fires → post-build-check.js
4. post-build-check.js detects build success
   → Calls run-journey-tests.js

5. run-journey-tests.js:
   a. Check .claude/.defer-tests (global defer flag)
   b. Extract #123 from recent commits (git log)
   c. Fetch issue #123 via gh CLI
   d. Extract journey IDs from issue body: J-LOGIN-FLOW
   e. Check .claude/.defer-journal for J-LOGIN-FLOW
   f. Find test file:
      - First: look in journey contract YAML for test_hooks.e2e_test_file
      - Fallback: heuristic: J-LOGIN-FLOW → tests/e2e/journey_login_flow.spec.ts
   g. Run: npx playwright test tests/e2e/journey_login_flow.spec.ts

6. If test passes: exit 0 (continue)
7. If test fails: exit 2 (show error to model)
```

### Deferral System

Deferrals allow temporarily skipping journey gates:

**Global deferral:** `touch .claude/.defer-tests` — skips ALL journey tests.

**Per-journey deferral:** Add entry to `.claude/.defer-journal`:
```
J-LOGIN-FLOW: Waiting on auth service (#456)
```

Deferrals are checked at step 5e. If a journey is deferred, its test is skipped and a message is logged.

---

## Edit-Time Enforcement

The fastest feedback loop — checks contracts as code is written:

```
1. Claude writes/edits a file via Write or Edit tool
2. PostToolUse:Write|Edit fires → check-compliance.js
3. check-compliance.js:
   a. Read tool_input.file_path from stdin JSON
   b. Load all contracts from docs/contracts/
   c. Filter to rules whose scope matches the file path
   d. Scan file content against matching rules
   e. If violations found: exit 2 with violation details
   f. If clean: exit 0

4. Claude sees violation message, self-corrects
```

This is the same contract engine used by `specflow enforce`, just triggered automatically.

---

## Baseline Tracking

`.specflow/baseline.json` stores a compliance snapshot:

```json
{
  "timestamp": "2026-04-02T18:00:00Z",
  "contracts": 7,
  "rules": 35,
  "violations": 2,
  "details": [
    { "rule": "SEC-003", "file": "src/legacy.js", "status": "known" }
  ]
}
```

This allows `specflow status` to show regression (new violations since baseline) vs known issues. The baseline is updated manually with `specflow enforce --update-baseline`.

---

## State Machine: Issue Lifecycle Through Pipeline

```
OPEN (issue created)
  → Code written (MCP check advisory)
  → Code committed (commit gate: has #issue)
  → Build passes (build gate: journey tests pass)
  → PR created (CI gate: contract tests pass)
  → PR merged
  → Issue closed (all gates passed)
```

Each gate is independent. Skipping one doesn't bypass others. The pipeline is defense-in-depth.
