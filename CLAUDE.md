# CLAUDE.md

This file provides guidance to Claude Code when working with the Specflow repository.

---

## Project Context

**Repository:** Hulupeep/Specflow
**Project Board:** GitHub Issues
**Board CLI:** gh (must be installed and authenticated)
**Tech Stack:** Node.js, JavaScript, Jest
**Primary Focus:** Specflow methodology framework — contracts, agents, hooks, templates

---

## Specflow Rules

### Rule 1: No Ticket = No Code

All work requires a GitHub issue before writing any code.

### Rule 2: Commits Must Reference an Issue

**NEVER run `git commit` without a `#<issue-number>` in the message.**

If you don't know the issue number, **ASK** before committing.

```bash
# Good
git commit -m "feat: add agent validation (#42)"

# Bad — hooks find nothing, no tests run
git commit -m "feat: add agent validation"
```

### Rule 3: Contracts Are Non-Negotiable

Check `docs/contracts/` before modifying protected files.

```bash
npm test -- contracts    # Must pass
```

Violation = build fails = PR blocked.

### Rule 4: Tests Must Pass Before Closing

```bash
npm test                 # All tests (558+)
npm test -- contracts    # Contract tests only
npm test -- hooks        # Hook tests only
npm test -- schema       # Schema validation only
npm test -- compile      # Compiler tests only
```

Work is NOT complete if tests fail.

### Rule 5: Contracts Are YAML, Not Markdown

**NEVER write contract content (invariants, forbidden patterns, required patterns) into .md files.**

Contracts MUST be YAML files in `docs/contracts/`:
- Feature contracts: `docs/contracts/feature_*.yml`
- Journey contracts: `docs/contracts/journey_*.yml`
- Default contracts: `docs/contracts/*_defaults.yml`

Wrong: `docs/specflow/my-feature-invariants.md`
Right: `docs/contracts/feature_my_feature.yml`

### Contract Locations

| Type | Location |
|------|----------|
| Project contracts | `docs/contracts/*.yml` |
| Template contracts | `templates/contracts/*.yml` |
| Contract tests | `tests/contracts/*.test.js` |
| Schema tests | `tests/schema/*.test.js` |
| Hook tests | `tests/hooks/*.test.js` |
| Compiler tests | `tests/compile/*.test.js` |

### Active Contracts

| Contract | Protects | Rules |
|----------|----------|-------|
| `feature_preflight` | Board-auditor compliance | ARCH-001 through ARCH-008 |
| `feature_specflow_project` | Project structure & code quality | PROJ-001 through PROJ-004 |
| `security_defaults` | OWASP baseline patterns | SEC-001 through SEC-005 |
| `test_integrity_defaults` | Test quality and anti-mock rules | TEST-001 through TEST-005 |
| `accessibility_defaults` | WCAG AA baseline patterns | A11Y-001 through A11Y-004 |
| `production_readiness_defaults` | Production hygiene patterns | PROD-001 through PROD-003 |
| `component_library_defaults` | UI library composition patterns | COMP-001 through COMP-004 |

### Override Protocol

Only humans can override. User must say:
```
override_contract: <contract_id>
```

---

## 🚨 NEW SESSION ONBOARDING (For Other Projects)

**If you are using Specflow in a DIFFERENT project and don't know the project context, ASK FIRST:**

Before doing any work, you MUST know:

1. **Repository** - Which repo are we working in?
2. **Project Board** - Where are issues/stories tracked?
3. **Board CLI** - What tool manipulates the board?
4. **Current focus** - What wave/milestone/issues should I work on?
5. **Tech stack** - What framework/language is this project?

**If any of this is missing from your CLAUDE.md context, ASK the user.**

### Supported Project Boards

| Board | CLI | Install | Auth Required |
|-------|-----|---------|---------------|
| GitHub Issues | `gh` | `brew install gh` | `gh auth login` |
| Jira | `jira` | `brew install jira-cli` | `jira init` |
| Linear | `linear` | `npm i -g @linear/cli` | `linear auth` |
| Shortcut | `sc` | `brew install shortcut-cli` | API token env var |
| Notion | MCP server | MCP config | API key |

### Commit Message Format (Critical for Hooks)

**RULE: NEVER run `git commit` without a `#<issue-number>` in the message.**

If you don't know the issue number, **ASK** before committing. Do not guess, do not omit it.

```bash
# ✅ GOOD - hooks find #375 and run its journey tests
git commit -m "feat: add signup validation (#375)"

# ✅ GOOD - bare number works too
git commit -m "feat: add signup validation #375"

# ❌ BAD - hooks find nothing, no tests run, no enforcement
git commit -m "feat: add signup validation"
```

After `pnpm build` or `git commit`, hooks automatically:
1. Extract issue numbers from recent commits
2. Fetch each issue for journey contract (`J-SIGNUP-FLOW`)
3. Run only relevant Playwright tests
4. Block on failure (exit 2)

**Without an issue number, journey tests are silently skipped — the commit succeeds but nothing is verified.**

**Install hooks:** `bash Specflow/install-hooks.sh .`

**DO NOT assume or guess.** Different projects have different boards, contracts, and conventions.

---

## Using Specflow In Another Project

This repository is the source of truth for the reusable Specflow kit. When you are
applying Specflow to another repository, copy the relevant assets from here rather
than inventing a fresh layout.

### Recommended Adoption Paths

1. **Quick start:** Use [SKILL.md](SKILL.md) when you want the minimal agent-facing setup.
2. **Project CLAUDE setup:** Use [CLAUDE-MD-TEMPLATE.md](CLAUDE-MD-TEMPLATE.md) when a target repo needs a full, project-specific `CLAUDE.md`.
3. **Wave execution:** Use [templates/WAVE_EXECUTION_PROTOCOL.md](templates/WAVE_EXECUTION_PROTOCOL.md) when the target repo uses dependency-driven execution across multiple tickets.

### What To Copy Into A Target Repository

| Asset | Destination in target repo | Purpose |
|------|----------|---------|
| `agents/` | `scripts/agents/` | Subagent library for orchestration and execution |
| `templates/contracts/*.yml` | `docs/contracts/` | Reusable default contracts |
| `hooks/` via `install-hooks.sh` | `.claude/hooks/` and `.git/hooks/` | Local enforcement and journey verification |
| `templates/ci/*.yml` | `.github/workflows/` | PR and post-merge contract enforcement |
| `CLAUDE-MD-TEMPLATE.md` | `CLAUDE.md` | Project-specific operating instructions |

### Source Repo Maintenance Notes

- Keep the contracts listed in `docs/contracts/CONTRACT_INDEX.yml` aligned with the files in `docs/contracts/`.
- Keep `templates/contracts/` as the canonical default-contract source, and mirror the active defaults into `docs/contracts/` for verifier coverage and documentation.
- Update `CLAUDE.md`, `SKILL.md`, and the CI templates together when the operating model changes so downstream repos receive a coherent kit.

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
| [CONTRACT-SCHEMA-EXTENSIONS.md](CONTRACT-SCHEMA-EXTENSIONS.md) | **NEW: DPAO parallel execution extensions** |
