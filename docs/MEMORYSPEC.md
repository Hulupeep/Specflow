# Specflow + ruvector Memory Integration

> Contracts that learn from violations.

## Overview

This specification defines how Specflow integrates with [ruvector](https://github.com/ruvnet/ruvector) to create contracts that improve over time. When violations occur and are fixed, that knowledge is stored and shared across all agents.

**The shift:** Contracts go from "what's forbidden" to "what's forbidden AND what to do instead."

---

## Core Idea

* **Specflow contracts** define *what must/must not happen*.
* **Contract tests** detect violations and hard-stop.
* **ruvector** stores *violation signatures + proven fixes* and broadcasts them so agents apply fixes **before** writing code.

**Specflow stays the "compiler". ruvector becomes the "lint + autofix memory" layer.**

---

## New Primitives

### 1) Violation Record (emitted by Specflow when a contract fails)

A normalized event, not prose.

| Field | Description |
|-------|-------------|
| `contract_id` | e.g., `AUTH-001`, `LAYER-001` |
| `contract_name` | e.g., `arch_layering` |
| `source_adr` | Optional, e.g., `ADR-007` |
| `signature.rule_type` | `forbidden_pattern`, `forbidden_import`, `path_ownership`, `ast_rule` |
| `signature.match` | The regex/import/AST node that triggered |
| `evidence.files` | List of paths |
| `evidence.snippets` | Minimal context lines around match |
| `evidence.commit_hash` | Git commit |
| `evidence.branch` | Git branch |
| `evidence.repo` | Repository name |
| `recommended_actions` | Optional placeholder |
| `timestamp` | ISO timestamp |

**Output locations:**
* `artifacts/specflow/violations/<run_id>.json` (CI artifact)
* `docs/violations/` (optional human-visible log)

### 2) Remediation Recipe (stored in ruvector)

Structured "what worked" attached to a violation signature.

| Field | Description |
|-------|-------------|
| `contract_id` | e.g., `AUTH-001` |
| `signature_hash` | Stable key for matching |
| `when.file_glob` | Context/language |
| `fix.type` | `patch`, `refactor_steps`, `snippet`, `instruction` |
| `fix.payload` | Structured diff patch, AST transform, or steps |
| `validation.tests_passed` | Boolean |
| `validation.contract_passed` | Boolean |
| `metrics.occurrences` | Total violations of this type |
| `metrics.applied_count` | Times this fix was applied |
| `metrics.success_count` | Times it worked |
| `metrics.success_rate` | Calculated ratio |
| `metrics.last_seen` | Timestamp |
| `provenance.agent_id` | Which agent fixed it |
| `provenance.run_id` | CI run ID |
| `provenance.links` | CI run URL |

**This is NOT "memory as vibes". It's a versioned remediation library.**

### 3) Broadcast Packet (ruvector → agents)

A small "pre-flight guard" message:

* "You are about to violate `AUTH-001`."
* "Known remediation exists: use httpOnly cookies instead of localStorage."
* "Apply patch? / follow steps?"

---

## Pipeline: How It Works End-to-End

### A) On Every Agent Attempt (pre-write / pre-commit)

1. Agent proposes a change plan (or begins editing).
2. **ruvector pre-check** runs:
   * Look at touched paths + imports + planned operations
   * Query remediation library for relevant signatures
3. If likely violation:
   * Inject "known constraints + known remedies" into the agent's working context
   * Optionally block the write unless agent acknowledges remedy

**Result:** Fewer failed test cycles, less thrash.

### B) On Contract Failure (post-write)

1. Specflow contract tests fail.
2. Specflow emits **Violation Record**.
3. ruvector ingests the Violation Record and:
   * Links it to existing signature (or creates a new one)
   * Increments `occurrences`
4. Agent fixes code.
5. Tests pass.
6. ruvector captures:
   * Diff patch (before/after)
   * Minimal "why" note (optional)
   * Stores as **Remediation Recipe**
   * Updates metrics, sets success_rate

**Result:** The same mistake becomes harder to repeat.

### C) Org-Wide Learning (broadcast)

When a Remediation Recipe reaches a threshold (e.g., 2 successes):
* Broadcast to:
  * Other agents
  * Other repos in same org
  * Same contract class (e.g., layering, auth, boundary)

**Result:** One fix pays off many times.

---

## Contract Evolution: From "NO" to "NO + DO THIS"

Contracts stay the same; remediation is separate.

**Keep contracts pure:**
* Contracts define invariants
* ruvector defines remedies

This avoids bloating YAML contracts with brittle examples.

---

## Signature Design (Important)

You need stable keys so "same violation" matches across code variations.

**Priority order:**
1. **AST signature** (best): "CallExpression prisma.* inside controller function"
2. **Import signature**: "controllers import prisma client"
3. **Regex match** (fallback): your existing forbidden patterns

Even if you start with regex, design now so AST can replace later without breaking IDs.

---

## Deterministic Gates (Non-Negotiable)

To avoid "memory rot":

* A remediation recipe is only "verified" if:
  * Contract tests pass
  * Unit tests pass (or configured suite)
* Store both:
  * Patch
  * Validation context (test suite + versions)

If validation context changes, recipe confidence decays.

---

## Min-Cut Gating: Selective Learning Injection

**Problem:** How do we inject lessons without replaying everything?

**Answer:** Min-cut is a gate that decides *how much* memory to inject and *from where*.

### The Core Insight

Min-cut in ruvector is a **real-time stress/boundary detector** on a graph:
- If the cut value is high (well-connected): inject **few remedies** (low friction)
- If the cut value is low (fragile): inject **more context** (heavier guardrails)

This gives you a dial: stable situations get hints, risky situations get guardrails.

### Build the Edit-Intent Graph

For each agent run, build a small graph (cheap, local):

```
┌─────────────────────────────────────────────────────────────────────┐
│                      Edit-Intent Graph                               │
├─────────────────────────────────────────────────────────────────────┤
│                                                                      │
│  LEFT SIDE (Intent)              RIGHT SIDE (Memory)                │
│  ─────────────────               ──────────────────                 │
│                                                                      │
│  ┌────────────────┐              ┌────────────────┐                 │
│  │ Touched Paths  │──────────────│ Remediation    │                 │
│  │ controllers/   │              │ Recipes        │                 │
│  │ auth.ts        │              │ (Violation→Fix)│                 │
│  └────────────────┘              └────────────────┘                 │
│         │                               │                            │
│         │                               │                            │
│  ┌────────────────┐              ┌────────────────┐                 │
│  │ New Imports    │──────────────│ Prior Incidents│                 │
│  │ prisma,        │   weight     │ in this repo   │                 │
│  │ jsonwebtoken   │              │                │                 │
│  └────────────────┘              └────────────────┘                 │
│         │                               │                            │
│         │                               │                            │
│  ┌────────────────┐              ┌────────────────┐                 │
│  │ API Calls      │──────────────│ ADR-derived    │                 │
│  │ localStorage   │              │ Constraints    │                 │
│  │ .setItem       │              │                │                 │
│  └────────────────┘              └────────────────┘                 │
│         │                               │                            │
│         │                               │                            │
│  ┌────────────────┐                                                 │
│  │ Contract       │                                                 │
│  │ Candidates     │                                                 │
│  │ AUTH-001,      │                                                 │
│  │ LAYER-001      │                                                 │
│  └────────────────┘                                                 │
│                                                                      │
│  ════════════════════════════════════════════════════════════════   │
│                         MIN-CUT LINE                                 │
│  ════════════════════════════════════════════════════════════════   │
│                                                                      │
└─────────────────────────────────────────────────────────────────────┘
```

### Edge Weights

| Connection | Higher Weight | Lower Weight |
|------------|---------------|--------------|
| Intent → Contract | Exact pattern match | Fuzzy similarity |
| Contract → Remediation | Same signature | Different signature |
| Remediation → Context | Same folder, stack | Different stack |
| Recency | Recent (< 7 days) | Old (> 30 days) |
| Success Rate | > 0.8 | < 0.5 |

### Min-Cut as Filter

Compute a cut between:
- **S = intent cluster** (what we're about to do)
- **T = remediation library** (what we've learned)

**Interpretation:**

| Cut Value | Tension | Action |
|-----------|---------|--------|
| High (well-connected) | Low | Inject **1-3 remedies** (hints) |
| Medium | Medium | Inject **5-7 remedies** (guidance) |
| Low (fragile) | High | Inject **10+ remedies** or **escalate** |
| Very Low | Critical | **Force stop**, require human review |

### Practical Implementation (No Research Project)

You don't need full graph theory everywhere:

1. **Signature match + weights** → shortlist 20 candidates
2. **Min-cut on subgraph** → decide injection size (3 vs 10)
3. **Default = 3 remedies max** unless min-cut says "fragile"

```typescript
interface InjectionDecision {
  candidates: Remediation[];     // shortlisted by signature match
  cutValue: number;              // min-cut result
  tension: 'low' | 'medium' | 'high' | 'critical';
  injectCount: number;           // how many to inject
  escalate: boolean;             // require human review?
}

function decideInjection(intentGraph: Graph): InjectionDecision {
  // 1. Shortlist by signature
  const candidates = matchSignatures(intentGraph.intents, remediationLibrary);

  // 2. Build subgraph
  const subgraph = buildSubgraph(intentGraph, candidates.slice(0, 20));

  // 3. Compute min-cut
  const cutValue = minCut(subgraph, intentCluster, remediationCluster);

  // 4. Decide injection size
  if (cutValue > 0.8) return { tension: 'low', injectCount: 3 };
  if (cutValue > 0.5) return { tension: 'medium', injectCount: 7 };
  if (cutValue > 0.2) return { tension: 'high', injectCount: 10 };
  return { tension: 'critical', injectCount: 20, escalate: true };
}
```

### Integration Points

**1. Preflight (before planning)**
```
Agent starts → Build intent graph → Min-cut gate → Inject "Guardrail Brief"
```

**2. On Failure (contract test fails)**
```
Test fails → Emit violation record → Store in ruvector → Connect to intent nodes
```

**3. On Success (tests pass)**
```
Tests pass → Store remediation recipe → Increase edge weight/confidence
```

### The Guardrail Brief

What gets injected (based on min-cut decision):

```markdown
## Guardrail Brief (3 items, low tension)

You are about to edit `controllers/auth.ts`.

**Known constraints:**
- AUTH-001: No localStorage for tokens (use httpOnly cookies)

**Proven fixes for similar edits:**
1. Replace `localStorage.setItem('token', ...)` with `res.cookie('token', ..., { httpOnly: true })`

**If you violate AUTH-001, the build will fail.**
```

vs.

```markdown
## Guardrail Brief (10 items, HIGH TENSION)

⚠️ This edit touches multiple protected areas.

**Active constraints:**
- AUTH-001: No localStorage for tokens
- LAYER-001: Controllers cannot import prisma directly
- SEC-002: All inputs must be validated

**Prior incidents in this repo:**
- 3 violations of AUTH-001 in past 30 days
- 2 violations of LAYER-001 in this folder

**Proven fixes:**
1. localStorage → httpOnly cookie
2. Direct prisma → service layer
3. req.body → validateInput(req.body)
...

**Recommendation:** Review docs/contracts/ before proceeding.
```

### One-Sentence Summary

> "The injection path is a mandatory preflight retrieval. Min-cut is the gate that decides how much to inject by measuring how strongly the current edit-intent connects to prior violation→remedy patterns."

---

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

---

## Where This Lives in Specflow (Minimal, Clean Extension)

### 1) Add a Specflow "Violation Emitter"

A small component inside the contract runner:

* On fail:
  * Compute `signature_hash`
  * Write Violation Record artifact
  * Optionally print a short machine-parsable line to stdout for CI pickup

### 2) Add a Specflow "Remediation Hook" (optional)

Before failing the run completely, Specflow can:

* Query ruvector: "any known remediation for this signature?"
* If found:
  * Include it in the failure output
  * Attach it to PR comment / CI log

**Specflow still fails the build. It just fails WITH a fix.**

---

## Minimal Build Order (Ship This First)

1. **Violation Record emitter** (Specflow → artifact)
2. **ruvector ingestion** of violations (counts only)
3. **Capture successful fix** as patch after pass
4. **Lookup + attach fix** on next failure
5. **Pre-flight guard** (warn before writing)

**That's enough to demonstrate "enforcement becomes teaching" without boiling the ocean.**

---

## Next Actions

1. Define the Violation Record JSON schema (v0.1).
2. Implement emitter in Specflow contract runner.
3. Create ruvector endpoint: `POST /violations` and `GET /remediations?signature_hash=...`
4. Implement "capture fix on pass" by diffing failing commit vs passing commit.
5. Add CI output: when failure occurs, print "Known fix available" with short steps/patch.

---

## Related Documents

- [CONTRACTS-README.md](../CONTRACTS-README.md) - Specflow overview
- [LLM-MASTER-PROMPT.md](../LLM-MASTER-PROMPT.md) - LLM enforcement prompt
- [ruvector Documentation](https://github.com/ruvnet/ruvector) - Distributed vector database
- [Claude Flow Documentation](https://github.com/ruvnet/claude-flow) - ruvector and hooks
