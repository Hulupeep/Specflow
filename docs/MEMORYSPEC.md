# Specflow + ruvector Memory Integration

> Contracts that learn from violations.

## Overview

This specification defines how Specflow integrates with ruvector (Claude Flow's self-learning memory layer) to create contracts that improve over time. When violations occur and are fixed, that knowledge is stored and shared across all agents.

**The shift:** Contracts go from "what's forbidden" to "what's forbidden AND what to do instead."

## Architecture

```
┌─────────────────────────────────────────────────────────────────┐
│                        Agent Workflow                           │
├─────────────────────────────────────────────────────────────────┤
│                                                                 │
│  ┌──────────┐    ┌──────────┐    ┌──────────┐    ┌──────────┐  │
│  │  Query   │───▶│  Write   │───▶│  Test    │───▶│  Learn   │  │
│  │  Memory  │    │  Code    │    │ Contract │    │  Store   │  │
│  └──────────┘    └──────────┘    └──────────┘    └──────────┘  │
│       │                               │               │         │
│       │                               ▼               │         │
│       │                         ┌──────────┐          │         │
│       │                         │ Violation│          │         │
│       │                         │   or     │          │         │
│       │                         │  Pass?   │          │         │
│       │                         └──────────┘          │         │
│       │                               │               │         │
│       └───────────────────────────────┴───────────────┘         │
│                           ruvector                              │
└─────────────────────────────────────────────────────────────────┘
```

## Memory Schema

All Specflow learning data lives under the `specflow/` namespace in ruvector.

```
specflow/
├── violations/
│   ├── AUTH-001/
│   │   ├── 1704067200.json
│   │   └── 1704153600.json
│   ├── AUTH-002/
│   │   └── 1704240000.json
│   └── SEC-001/
│       └── 1704326400.json
├── fixes/
│   ├── AUTH-001/
│   │   ├── 1704067500.json
│   │   └── 1704154000.json
│   └── SEC-001/
│       └── 1704327000.json
└── patterns/
    ├── AUTH-001.json
    ├── AUTH-002.json
    └── SEC-001.json
```

### Violation Record

Stored when a contract test fails.

```json
{
  "contract_id": "AUTH-001",
  "timestamp": "2024-01-01T12:00:00Z",
  "file": "src/auth/login.ts",
  "line": 47,
  "pattern_matched": "localStorage\\.setItem.*token",
  "snippet": "localStorage.setItem('token', jwt)",
  "context": {
    "function": "handleLogin",
    "surrounding_lines": [
      "const jwt = response.data.token;",
      "localStorage.setItem('token', jwt);",
      "setUser(decoded);"
    ]
  },
  "agent_id": "coder-agent-01",
  "session_id": "swarm-abc123"
}
```

### Fix Record

Stored when a violation is resolved.

```json
{
  "contract_id": "AUTH-001",
  "violation_ref": "specflow/violations/AUTH-001/1704067200",
  "timestamp": "2024-01-01T12:05:00Z",
  "file": "src/auth/login.ts",
  "before": "localStorage.setItem('token', jwt)",
  "after": "document.cookie = `token=${jwt}; HttpOnly; Secure; SameSite=Strict`",
  "diff": "-localStorage.setItem('token', jwt)\n+document.cookie = `token=${jwt}; HttpOnly; Secure; SameSite=Strict`",
  "agent_id": "coder-agent-01",
  "verified": true
}
```

### Pattern Summary

Aggregated learning for each contract rule. Updated periodically.

```json
{
  "contract_id": "AUTH-001",
  "name": "No localStorage for auth tokens",
  "total_violations": 7,
  "total_fixes": 7,
  "success_rate": 1.0,
  "common_violations": [
    {
      "pattern": "localStorage.setItem('token', ...)",
      "occurrences": 5
    },
    {
      "pattern": "localStorage.setItem('authToken', ...)",
      "occurrences": 2
    }
  ],
  "proven_fixes": [
    {
      "description": "Use httpOnly cookie instead of localStorage",
      "example_before": "localStorage.setItem('token', jwt)",
      "example_after": "document.cookie = `token=${jwt}; HttpOnly; Secure; SameSite=Strict`",
      "success_count": 6
    },
    {
      "description": "Use secure session storage with encryption",
      "example_before": "localStorage.setItem('token', jwt)",
      "example_after": "secureStorage.set('token', encrypt(jwt))",
      "success_count": 1
    }
  ],
  "last_violation": "2024-01-15T09:30:00Z",
  "last_updated": "2024-01-15T10:00:00Z"
}
```

## Implementation Components

### 1. Violation Parser

Parses Specflow test output and extracts violation data.

**Input:** Contract test stdout/stderr
**Output:** Structured violation records

```bash
#!/bin/bash
# scripts/parse-violations.sh

parse_violation() {
  local output="$1"

  # Extract contract ID
  contract_id=$(echo "$output" | grep -oP 'CONTRACT VIOLATION: \K[A-Z]+-[0-9]+')

  # Extract file and line
  file=$(echo "$output" | grep -oP 'File: \K[^:]+')
  line=$(echo "$output" | grep -oP 'File: [^:]+:\K[0-9]+')

  # Extract matched pattern
  pattern=$(echo "$output" | grep -oP 'Pattern: \K.*')

  # Extract code snippet (if available)
  snippet=$(echo "$output" | grep -oP 'Found: \K.*')

  # Build JSON
  cat <<EOF
{
  "contract_id": "$contract_id",
  "timestamp": "$(date -Iseconds)",
  "file": "$file",
  "line": $line,
  "pattern_matched": "$pattern",
  "snippet": "$snippet"
}
EOF
}
```

### 2. Test Runner Wrapper

Runs contract tests and stores violations in ruvector.

```bash
#!/bin/bash
# scripts/specflow-learn.sh

set -e

# Run contract tests, capture output
echo "Running contract tests..."
npm run test:contracts 2>&1 | tee /tmp/specflow-output.txt
TEST_EXIT_CODE=${PIPESTATUS[0]}

# Parse and store violations
echo "Processing violations..."
while IFS= read -r line; do
  if [[ "$line" == *"CONTRACT VIOLATION"* ]]; then
    # Extract multiline violation block
    violation_block=$(sed -n "/$line/,/^$/p" /tmp/specflow-output.txt)

    # Parse to JSON
    violation_json=$(parse_violation "$violation_block")
    contract_id=$(echo "$violation_json" | jq -r '.contract_id')
    timestamp=$(date +%s)

    # Store in ruvector
    npx claude-flow memory store \
      --key "specflow/violations/$contract_id/$timestamp" \
      --value "$violation_json"

    echo "Stored violation: $contract_id"
  fi
done < /tmp/specflow-output.txt

exit $TEST_EXIT_CODE
```

### 3. Fix Tracker Hook

Claude Flow post-edit hook that detects when a violation is fixed.

```bash
#!/bin/bash
# hooks/post-edit-specflow.sh

FILE="$1"
DIFF="$2"

# Check if this file had a recent violation
recent_violations=$(npx claude-flow memory search "specflow/violations" \
  --filter "file=$FILE" \
  --since "1h" \
  --format json)

if [ -n "$recent_violations" ]; then
  # Extract the contract IDs that were violated
  contract_ids=$(echo "$recent_violations" | jq -r '.[].contract_id' | sort -u)

  for contract_id in $contract_ids; do
    # Get the violation reference
    violation_ref=$(echo "$recent_violations" | \
      jq -r "map(select(.contract_id==\"$contract_id\")) | .[0].key")

    # Store the fix
    fix_json=$(cat <<EOF
{
  "contract_id": "$contract_id",
  "violation_ref": "$violation_ref",
  "timestamp": "$(date -Iseconds)",
  "file": "$FILE",
  "diff": $(echo "$DIFF" | jq -Rs .),
  "agent_id": "${AGENT_ID:-unknown}",
  "verified": false
}
EOF
)

    timestamp=$(date +%s)
    npx claude-flow memory store \
      --key "specflow/fixes/$contract_id/$timestamp" \
      --value "$fix_json"

    echo "Stored fix for: $contract_id"
  done
fi
```

### 4. Pre-Generation Query

Query learned patterns before writing code in a domain.

```bash
#!/bin/bash
# scripts/query-patterns.sh

DOMAIN="$1"  # e.g., "AUTH" or "SEC"

# Get pattern summaries for this domain
patterns=$(npx claude-flow memory search "specflow/patterns/$DOMAIN-*" --format json)

# Get recent fixes (last 7 days)
recent_fixes=$(npx claude-flow memory search "specflow/fixes/$DOMAIN-*" \
  --since "7d" \
  --format json)

# Format for LLM context
echo "## Learned Patterns for $DOMAIN"
echo ""
echo "### Known Violations to Avoid"
echo "$patterns" | jq -r '.[] | "- \(.contract_id): \(.common_violations[0].pattern)"'
echo ""
echo "### Proven Fixes"
echo "$patterns" | jq -r '.[] | .proven_fixes[] | "- **\(.description)**\n  Before: `\(.example_before)`\n  After: `\(.example_after)`"'
```

### 5. Pattern Aggregator

Periodically aggregates violations and fixes into pattern summaries.

```bash
#!/bin/bash
# scripts/aggregate-patterns.sh

# Get all unique contract IDs with violations
contract_ids=$(npx claude-flow memory list "specflow/violations" \
  | grep -oP '[A-Z]+-[0-9]+' | sort -u)

for contract_id in $contract_ids; do
  # Count violations
  violation_count=$(npx claude-flow memory count "specflow/violations/$contract_id")

  # Count fixes
  fix_count=$(npx claude-flow memory count "specflow/fixes/$contract_id")

  # Get common violation patterns
  common_patterns=$(npx claude-flow memory search "specflow/violations/$contract_id" \
    --format json | jq '[.[].snippet] | group_by(.) | map({pattern: .[0], occurrences: length}) | sort_by(-.occurrences) | .[0:3]')

  # Get proven fixes
  proven_fixes=$(npx claude-flow memory search "specflow/fixes/$contract_id" \
    --filter "verified=true" \
    --format json | jq '[.[] | {description: .diff, before: .before, after: .after}] | unique_by(.after) | .[0:3]')

  # Build pattern summary
  pattern_json=$(cat <<EOF
{
  "contract_id": "$contract_id",
  "total_violations": $violation_count,
  "total_fixes": $fix_count,
  "success_rate": $(echo "scale=2; $fix_count / $violation_count" | bc),
  "common_violations": $common_patterns,
  "proven_fixes": $proven_fixes,
  "last_updated": "$(date -Iseconds)"
}
EOF
)

  npx claude-flow memory store \
    --key "specflow/patterns/$contract_id" \
    --value "$pattern_json"

  echo "Updated pattern: $contract_id"
done
```

## LLM Prompt Integration

### Enhanced Master Prompt

Add to `LLM-MASTER-PROMPT.md`:

```markdown
## Learned Patterns from Memory

Before writing code, query ruvector for learned patterns:

{{SPECFLOW_LEARNED_PATTERNS}}

When working in a domain with known violations:
1. Review the "Proven Fixes" for that contract
2. Apply the fix pattern proactively
3. Do NOT repeat known violation patterns

If you write code that matches a known violation pattern,
STOP and apply the proven fix instead.
```

### Runtime Prompt Injection

When spawning an agent:

```bash
# Query patterns for relevant domains
patterns=$(./scripts/query-patterns.sh AUTH)

# Inject into agent prompt
npx claude-flow agent spawn \
  --type coder \
  --context "SPECFLOW_LEARNED_PATTERNS=$patterns" \
  --task "Implement login handler"
```

## Workflow Integration

### CI/CD Pipeline

```yaml
# .github/workflows/contracts.yml
name: Contract Tests with Learning

on: [push, pull_request]

jobs:
  test-contracts:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4

      - name: Setup Node
        uses: actions/setup-node@v4

      - name: Install dependencies
        run: npm ci

      - name: Run contract tests with learning
        run: ./scripts/specflow-learn.sh
        env:
          CLAUDE_FLOW_MEMORY_URL: ${{ secrets.RUVECTOR_URL }}

      - name: Aggregate patterns
        if: always()
        run: ./scripts/aggregate-patterns.sh
```

### Local Development

```bash
# Add to package.json
{
  "scripts": {
    "test:contracts": "jest --testPathPattern=contracts",
    "test:contracts:learn": "./scripts/specflow-learn.sh",
    "specflow:patterns": "./scripts/query-patterns.sh",
    "specflow:aggregate": "./scripts/aggregate-patterns.sh"
  }
}
```

## Agent Coordination

### Broadcasting Learned Patterns

When a fix is verified, broadcast to swarm:

```bash
npx claude-flow hooks notify \
  --type "specflow:fix-learned" \
  --data '{"contract_id": "AUTH-001", "fix": "localStorage→httpOnly cookie"}'
```

### Requesting Pattern Context

Agent requests patterns before starting work:

```bash
npx claude-flow hooks pre-task \
  --request-context "specflow/patterns/AUTH-*,specflow/patterns/SEC-*"
```

## Metrics and Monitoring

### Key Metrics

| Metric | Description | Target |
|--------|-------------|--------|
| Violation Rate | Violations per 100 edits | < 5% |
| Fix Success Rate | Fixes that pass re-test | > 95% |
| Pattern Reuse | Times a learned fix is applied | Increasing |
| Time to Fix | Time from violation to fix | Decreasing |

### Dashboard Query

```bash
# Get learning effectiveness metrics
npx claude-flow memory stats "specflow/*" --format table
```

## Migration Path

### Phase 1: Capture Only (Week 1)
- Deploy violation parser
- Store violations in ruvector
- No changes to agent behavior

### Phase 2: Fix Tracking (Week 2)
- Deploy fix tracker hook
- Store before/after diffs
- Manual pattern aggregation

### Phase 3: Pattern Queries (Week 3)
- Deploy pre-generation queries
- Inject patterns into prompts
- Monitor pattern reuse

### Phase 4: Full Loop (Week 4)
- Automated pattern aggregation
- Swarm broadcasting
- Metrics dashboard

## Configuration

### Environment Variables

```bash
# ruvector connection
SPECFLOW_MEMORY_ENABLED=true
SPECFLOW_MEMORY_NAMESPACE=specflow
CLAUDE_FLOW_MEMORY_URL=https://memory.claude-flow.dev

# Retention
SPECFLOW_VIOLATION_RETENTION_DAYS=90
SPECFLOW_FIX_RETENTION_DAYS=365
SPECFLOW_PATTERN_REFRESH_HOURS=24

# Thresholds
SPECFLOW_MIN_FIXES_FOR_PATTERN=3
SPECFLOW_PATTERN_SUCCESS_THRESHOLD=0.8
```

### Claude Flow Hooks Config

```yaml
# .claude-flow/hooks.yml
hooks:
  post-edit:
    - script: ./hooks/post-edit-specflow.sh
      enabled: true

  post-task:
    - script: ./scripts/specflow-learn.sh
      on: test:contracts
      enabled: true
```

## Security Considerations

1. **Sanitize snippets** - Remove secrets/credentials from stored violations
2. **Access control** - Limit who can write to pattern summaries
3. **Validation** - Verify fixes before marking as proven
4. **Audit trail** - Log all pattern modifications

## Related Documents

- [CONTRACTS-README.md](../CONTRACTS-README.md) - Specflow overview
- [LLM-MASTER-PROMPT.md](../LLM-MASTER-PROMPT.md) - LLM enforcement prompt
- [Claude Flow Documentation](https://github.com/ruvnet/claude-flow) - ruvector and hooks
