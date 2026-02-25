# Team Workflows

How different roles contribute to a Specflow project, how to compile journeys from CSV, and how Agent Teams mode works for parallel execution.

[← Back to README](../README.md)

---

## Roles and Responsibilities

| Role | Authors | Format | Tool |
|------|---------|--------|------|
| **Tech Lead** | Architecture contracts | YAML | Text editor / LLM |
| **Product Designer** | User journeys | CSV | Google Sheets / Excel |
| **Developer** | Implementation | Code | IDE + git |
| **CI** | Enforcement | GitHub Actions | Automated |

---

## CSV Journey Format

Product designers define user journeys in a simple CSV — no YAML knowledge required:

```csv
journey_id,journey_name,step,user_does,system_shows,critical,owner,notes
J-SIGNUP-FLOW,User Signup,1,Clicks "Sign Up",Shows registration form,yes,@alice,
J-SIGNUP-FLOW,User Signup,2,Fills email + password,Validates in real-time,yes,@alice,
J-SIGNUP-FLOW,User Signup,3,Clicks submit,Shows success + redirect,yes,@alice,Must send email
```

See `templates/journeys-template.csv` for a ready-to-use template.

### Compile CSV to contracts

```bash
npm run compile:journeys -- path/to/journeys.csv
```

Generates:
- `docs/contracts/journey_*.yml` — one journey contract per `journey_id`
- `tests/e2e/journey_*.spec.ts` — Playwright test stubs per `journey_id`

Commit the CSV + generated files together. The CSV is the source of truth; the generated files are checked in so CI can enforce them.

---

## CI Enforcement Templates

Two GitHub Actions templates for team enforcement:

| Template | Trigger | Purpose |
|----------|---------|---------|
| `templates/ci/specflow-compliance.yml` | PR to main | Posts compliance report as PR comment, blocks on violations |
| `templates/ci/specflow-audit.yml` | Push to main | Opens issue if violations found (catches bypass) |

```bash
cp Specflow/templates/ci/*.yml .github/workflows/
```

### Local enforcement flow

```
Designer authors journeys.csv
  → npm run compile:journeys -- journeys.csv
  → Commits CSV + generated contracts + test stubs
  → Developer pulls, makes changes, hooks enforce contracts
  → PR created → CI runs specflow-compliance.yml
  → Developer pushes to main without Specflow → audit catches it
```

---

## Agent Teams Mode (Default, Claude Code 4.6+)

Agent Teams is the default execution model when Claude Code 4.6+ is available. Instead of stateless subagents that spawn, work, and terminate, Agent Teams creates persistent teammates that maintain context and communicate directly with each other.

Detection is automatic — no environment variable needed. When TeammateTool is available, Agent Teams activates. When unavailable, Specflow falls back to subagent mode automatically.

### How It Differs from Subagents

| Aspect | Subagent Mode (Fallback) | Agent Teams (Default) |
|--------|--------------------------|----------------------|
| **Lifecycle** | Stateless: spawn, execute, terminate | Persistent: agents live for the session |
| **Communication** | Hub-and-spoke via orchestrator | Peer-to-peer: agents message each other directly |
| **Error recovery** | Orchestrator must re-spawn | Agent fixes its own bugs (retains context) |
| **Context** | Lost between invocations | Maintained for the full session |

### Three-Tier Journey Enforcement

| Tier | When It Runs | What It Checks |
|------|--------------|----------------|
| **Tier 1: Issue Gate** | Before implementation starts | Journey contract, Gherkin criteria, data-testid selectors |
| **Tier 2: Wave Gate** | After a wave completes | All journey tests for the wave pass, no regressions |
| **Tier 3: Regression Gate** | Before release/merge | Full journey suite passes, no critical failures |

### Execution Visualizations

Agent Teams renders 5 ASCII visualizations so you can see what's executing and what's being tested:

| Visualization | When |
|--------------|------|
| EXECUTION TIMELINE | Phase 1 and Phase 8 |
| ENFORCEMENT MAP | Phase 1 (per wave) |
| DEPENDENCY TREE | Phase 1 (per wave) |
| PARALLEL AGENT MODEL | Phase 4 |
| SPRINT SUMMARY TABLE | Phase 8 |

Run `/specflow status` to render all 5 at any point.

### Team Agents

- `issue-lifecycle` — Full lifecycle management per issue (spec, implement, test, close)
- `db-coordinator` — Migration number management and conflict prevention
- `quality-gate` — Test execution service with pass/fail coordination
- `journey-gate` — Three-tier journey enforcement

### Same command regardless of mode

```
Execute waves
```

The `waves-controller` auto-detects TeammateTool and uses the appropriate model. No changes to existing setup required when upgrading.

---

## Production Track Record

The Timebreez project delivered 280+ GitHub issues using Specflow with autonomous wave execution:

- **0 critical E2E anti-patterns** (down from 117) — tests fail when features break
- **Autonomous wave execution** — "Execute waves" → controller orchestrates everything
- **CI quality gates** — PRs blocked if test quality violations detected
- **280+ issues delivered** — across 30 waves

See [README_FRONTIER.md](../README_FRONTIER.md) for full details and the extraction script.

---

→ **Setting up CI?** See [CI Integration](../CI-INTEGRATION.md)
→ **Browse all agents?** See [Agent Library](../agents/README.md)
→ **Commands reference?** See [Reference](reference.md)
