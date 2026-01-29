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

---

# ⬆️ END ⬆️

---

## About This Repository

This is the **Specflow methodology repository** containing:
- Documentation on specs and contracts
- 16 subagents for automated execution
- Templates and examples
- Demo proving contracts catch what unit tests miss

### Quick Start with Subagents

```bash
# 1. Copy agents to your project
cp -r Specflow/agents/ your-project/scripts/agents/

# 2. Tell Claude Code
"Note the agents in scripts/agents/. Execute my backlog in parallel waves."
```

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
| [LLM-MASTER-PROMPT.md](LLM-MASTER-PROMPT.md) | How to generate contracts |
| [CONTRACT-SCHEMA.md](CONTRACT-SCHEMA.md) | YAML contract format |
