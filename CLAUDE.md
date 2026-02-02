# CLAUDE.md

This file provides guidance to Claude Code when working with Specflow projects.

## For Your Project

**Add the content below to your project's CLAUDE.md** to enable Specflow enforcement.

**Two options:**
1. **Quick start:** Copy the simple version below
2. **Full template:** Use [CLAUDE-MD-TEMPLATE.md](CLAUDE-MD-TEMPLATE.md) for complete setup with agents

---

# ⬇️ COPY INTO YOUR CLAUDE.md ⬇️

---

```markdown
## Specflow Rules

### Rule 1: No Ticket = No Code

All work requires a GitHub issue with:
- Gherkin acceptance criteria
- data-testid requirements
- Contract references
- E2E test file name

### Rule 2: Contracts Are Non-Negotiable

Check `docs/contracts/` before modifying protected files.

```bash
npm test -- contracts    # Must pass
```

Violation = build fails = PR blocked.

### Rule 3: Tests Must Pass Before Closing

```bash
npm test -- contracts    # Contract tests
npm run test:e2e         # E2E journey tests
```

Work is NOT complete if tests fail.

### Contract Locations

| Type | Location |
|------|----------|
| Feature contracts | `docs/contracts/feature_*.yml` |
| Journey contracts | `docs/contracts/journey_*.yml` |
| Contract tests | `src/__tests__/contracts/*.test.ts` |
| E2E tests | `tests/e2e/*.spec.ts` |

### Override Protocol

Only humans can override. User must say:
```
override_contract: <contract_id>
```

### Active Contracts

<!-- Add your contracts here -->
_No contracts defined yet. Run specflow-writer to create them._
```

### Wave Execution & Orchestration (Optional)

If your project uses **wave-based GitHub issue orchestration**, see [CLAUDE-MD-TEMPLATE.md](CLAUDE-MD-TEMPLATE.md) for:

- Progress tracking templates with dependency graphs
- Autonomous execution requirements (5 parameters)
- Automatic parallel execution determination
- Parallelization savings reporting

**Key capabilities:**
- Parse issue dependencies automatically
- Determine which issues can run in parallel
- Execute multiple agents simultaneously (3-4x faster)
- Report time savings from parallelization

---

# ⬆️ END ⬆️

---

## About This Repository

This is the **Specflow methodology repository** containing:
- Documentation on specs and contracts
- 18 subagents for automated execution
- Templates and examples
- Demo proving contracts catch what unit tests miss

### Quick Start with Subagents

```bash
# 1. Copy agents and protocol to your project
cp -r Specflow/agents/ your-project/scripts/agents/
cp Specflow/templates/WAVE_EXECUTION_PROTOCOL.md your-project/docs/

# 2. Tell Claude Code
"Execute waves"
```

### The Orchestrator

The `waves-controller` agent is the master orchestrator. It:
- Fetches all open issues
- Builds dependency graph
- Calculates parallel waves
- Spawns all other agents
- Handles quality gates
- Closes completed issues

**One command does everything:** `"Execute waves"`

### Quick Commands

| Goal | Say this |
|------|----------|
| Execute entire backlog | "Execute waves" |
| Execute specific issues | "Execute issues #50, #51, #52" |
| Execute by milestone | "Execute waves for milestone v1.0" |
| Audit test quality | "Run e2e-test-auditor" |
| Check compliance | "Run board-auditor" |

### Demo

```bash
cd demo && npm install
npm run demo              # See contracts in action
```

### Key Docs

| Doc | Purpose |
|-----|---------|
| [README.md](README.md) | Full documentation |
| [CLAUDE-MD-TEMPLATE.md](CLAUDE-MD-TEMPLATE.md) | Complete CLAUDE.md template |
| [agents/README.md](agents/README.md) | Subagent library setup |
| [agents/waves-controller.md](agents/waves-controller.md) | Master orchestrator |
| [templates/WAVE_EXECUTION_PROTOCOL.md](templates/WAVE_EXECUTION_PROTOCOL.md) | Wave execution protocol template |
| [LLM-MASTER-PROMPT.md](LLM-MASTER-PROMPT.md) | How to generate contracts |
| [CONTRACT-SCHEMA.md](CONTRACT-SCHEMA.md) | YAML contract format |
