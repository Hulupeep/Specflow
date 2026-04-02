# Specflow v1.0 — Master Execution Plan

**Goal:** Transform Specflow from a repository of bash scripts and documentation into a standalone, installable CLI tool that any developer can adopt in under 5 minutes.

**Success criteria:** A developer runs `npm install -g @colmbyrne/specflow && specflow init . --wizard && specflow doctor` and has contract enforcement working in their project.

---

## Current State

Specflow v0.1.7 is a contract-driven development framework that enforces architectural rules via YAML contracts and journey tests. The core contract engine works well (425 pattern tests passing), but the delivery mechanism is fragile:

- CLI is a 154-line Node.js dispatcher that shells out to 3 large bash scripts
- Hook installer requires `jq` and fails on most systems (26 test failures)
- No MCP server (can't integrate natively with Claude Code)
- 13 markdown files in root, sample apps with node_modules, a stray supabase directory
- Agents are undiscoverable markdown files with no frontmatter or runner
- No install script for one-line setup
- No `doctor` command for self-diagnosis

## Target State

Specflow v1.0 is a Node.js CLI tool that:

1. Installs globally via npm or curl one-liner
2. Scaffolds contract enforcement into any project with `specflow init`
3. Self-diagnoses with `specflow doctor`
4. Integrates with Claude Code as an MCP server
5. Runs contract tests directly with `specflow enforce`
6. Has zero bash dependencies for core functionality
7. Ships a clean, focused package with no sample apps or project-specific files

---

## Phase 1: Clean the Foundation

**Duration:** 1-2 days
**Objective:** Remove clutter, reorganize files, establish the structure everything else builds on.

### Tasks

1.1. Remove non-framework content from repo
  - Delete `sample apps/` (move to `specflow-examples` repo or archive branch)
  - Delete `supabase/` (project-specific)
  - Delete `ruflo/` (dev tooling artifact)
  - Merge useful content from `context/` into `docs/`, delete `context/`

1.2. Move root markdown sprawl to `docs/`
  - Move to `docs/guides/`: QUICKSTART.md, MID-PROJECT-ADOPTION.md, PUSH-TO-GITHUB.md, PROMPT-TEMPLATE.md, SPEC-FORMAT.md, USER-JOURNEY-CONTRACTS.md, README_FRONTIER.md, FRONTIER_IMPROVEMENTS.md
  - Move to `docs/reference/`: CONTRACT-SCHEMA.md, CONTRACT-SCHEMA-EXTENSIONS.md, CONTRACTS-README.md, LLM-MASTER-PROMPT.md
  - Keep in root: README.md, CLAUDE.md, SKILL.md, CLAUDE-MD-TEMPLATE.md, CI-INTEGRATION.md, LICENSE

1.3. Move root bash scripts to `scripts/legacy/`
  - `setup-project.sh`, `install-hooks.sh`, `verify-setup.sh`, `extract-to-project.sh`
  - These become reference implementations for the Node.js rewrites

1.4. Update `package.json` files array to match new structure

1.5. Verify all 652 passing tests still pass after restructure

**Exit criteria:** Clean root, all passing tests still pass, `npm pack` produces a focused package.

**Related documents:**
- [ADR-001: Repository Structure](../adrs/ADR-001-repository-structure.md)

---

## Phase 2: Rewrite CLI Core in Node.js

**Duration:** 3-5 days
**Objective:** Replace bash scripts with Node.js commands. Zero system dependencies beyond Node.js 20+.

### Tasks

2.1. Design CLI command router
  - Parse args, route to command modules in `src/commands/`
  - Support `--help`, `--version`, `--json` (machine-readable output) flags
  - Detect MCP mode (stdin not TTY) vs CLI mode

2.2. Rewrite `init` command (`src/commands/init.js`)
  - Replace `setup-project.sh` (636 lines of bash)
  - Interactive wizard mode (`--wizard`): ask repo, board type, tech stack
  - Non-interactive mode with flags for CI usage
  - Scaffold: contracts, tests, hooks, CLAUDE.md, jest config, git hook
  - Use Node.js `fs` for all file operations (no `cp`, `mkdir`, `jq`)

2.3. Rewrite `doctor` command (`src/commands/doctor.js`)
  - Replace `verify-setup.sh` (763 lines of bash)
  - 13 health checks with pass/warn/fail output
  - `--fix` flag to auto-remediate common issues
  - Machine-readable JSON output with `--json`

2.4. Rewrite `update` command (`src/commands/update.js`)
  - Replace `install-hooks.sh` (313 lines of bash)
  - Install Claude Code hooks via Node.js JSON manipulation (no `jq`)
  - Install git commit-msg hook
  - Optionally install CI workflows (`--ci`)

2.5. Add `enforce` command (`src/commands/enforce.js`)
  - Run contract pattern tests directly (no `npm test` indirection)
  - Load contracts from `docs/contracts/`, compile patterns, scan target files
  - Output: which rules pass/fail, which files violate, suggested fixes
  - Exit code 0 (clean) or 1 (violations found)

2.6. Wire existing commands into new CLI
  - `compile` → wraps `specflow-compile.cjs`
  - `audit` → existing audit logic from `bin/specflow.js`
  - `graph` → wraps `verify-graph.cjs`

2.7. Add `status` command (`src/commands/status.js`)
  - Show contract compliance summary
  - Count passing/failing rules
  - Show journey test coverage
  - Show hook installation status

2.8. Rewrite hook scripts in Node.js
  - `src/hooks/post-build-check.js` — replaces bash version
  - `src/hooks/run-journey-tests.js` — replaces bash version
  - `src/hooks/check-compliance.js` — replaces bash version
  - All read JSON from stdin (Claude Code hook protocol), no `jq`

2.9. Update all tests to cover new Node.js implementations

**Exit criteria:** `specflow init . && specflow doctor && specflow enforce` works. 678/678 tests pass. No bash dependency for any core command.

**Related documents:**
- [ADR-002: Node.js Over Bash](../adrs/ADR-002-nodejs-over-bash.md)
- [ADR-003: CLI Architecture](../adrs/ADR-003-cli-architecture.md)
- [PRD-001: CLI Rewrite](../prds/PRD-001-cli-rewrite.md)
- [DDD-001: Contract Engine](../ddds/DDD-001-contract-engine.md)
- [DDD-002: Enforcement Pipeline](../ddds/DDD-002-enforcement-pipeline.md)

---

## Phase 3: MCP Server

**Duration:** 2-3 days
**Objective:** Make Claude Code contract-aware by exposing Specflow's engine as MCP tools.

### Tasks

3.1. Implement stdio MCP server (`src/mcp/server.js`)
  - JSON-RPC 2.0 over stdin/stdout
  - Protocol: initialize, tools/list, tools/call, ping
  - Mode detection in `bin/specflow.js`: if stdin is not TTY → MCP mode

3.2. Expose contract tools
  - `specflow_list_contracts` — list all contracts with rule counts and status
  - `specflow_check_code` — test a code snippet against contract patterns
  - `specflow_get_violations` — scan a file or directory against all contracts
  - `specflow_validate_contract` — validate a YAML contract's schema
  - `specflow_audit_issue` — audit a GitHub issue for compliance markers
  - `specflow_compile_journeys` — compile CSV to contracts + test stubs
  - `specflow_verify_graph` — run contract graph integrity checks
  - `specflow_defer_journey` — add/remove journey deferrals

3.3. Registration command
  - `specflow mcp register` → runs `claude mcp add specflow -- specflow mcp start`
  - `specflow mcp unregister` → removes MCP registration

3.4. Test MCP server with Claude Code end-to-end

**Exit criteria:** `claude mcp add specflow -- specflow mcp start` works. Claude Code can call `specflow_check_code` and get contract violation results.

**Related documents:**
- [ADR-004: MCP Server Design](../adrs/ADR-004-mcp-server-design.md)
- [PRD-002: MCP Server](../prds/PRD-002-mcp-server.md)

---

## Phase 4: Install Script & Packaging

**Duration:** 1-2 days
**Objective:** One-line install that works on macOS and Linux.

### Tasks

4.1. Write `scripts/install.sh`
  - Check Node.js >= 20, npm >= 9
  - `npm install -g @colmbyrne/specflow`
  - Run `specflow doctor` to verify
  - Optionally register MCP server
  - Colored output, clear error messages

4.2. Host on CDN
  - jsDelivr: `https://cdn.jsdelivr.net/gh/Hulupeep/Specflow@main/scripts/install.sh`
  - Test the full `curl | bash` flow

4.3. Update `package.json`
  - Ensure `files` array matches new structure
  - Verify `bin` entry works after global install
  - Add `engines: { node: ">=20" }`
  - Update version to 1.0.0

4.4. Publish to npm
  - Test with `npm pack` + `npm install -g ./specflow-1.0.0.tgz`
  - Publish `@colmbyrne/specflow@1.0.0`

**Exit criteria:** `curl -fsSL <url> | bash` installs Specflow globally and `specflow doctor` passes.

**Related documents:**
- [PRD-003: Installation & Packaging](../prds/PRD-003-installation-packaging.md)

---

## Phase 5: Agent System

**Duration:** 2-3 days
**Objective:** Make the 32 agent prompts discoverable, indexable, and invocable.

### Tasks

5.1. Add YAML frontmatter to all 32 agent `.md` files
  - Fields: name, description, trigger, inputs, outputs, category
  - Categories: orchestration, compliance, testing, generation, lifecycle

5.2. Create agent registry (`src/agents/registry.js`)
  - Scan `agents/` directory, parse frontmatter
  - Build searchable index
  - Cache for performance

5.3. Add CLI commands
  - `specflow agent list` — table of all agents with category, trigger
  - `specflow agent show <name>` — print full agent prompt
  - `specflow agent search <query>` — fuzzy search agents by description/trigger

5.4. Add MCP tools for agents
  - `specflow_list_agents` — machine-readable agent index
  - `specflow_get_agent` — retrieve agent prompt by name

5.5. Update agent prompts to inject contract context
  - Agents that generate code should reference active contracts
  - Agents that audit should know about contract rules

**Exit criteria:** `specflow agent list` shows all 32 agents. `specflow agent show waves-controller` prints the prompt. MCP tools return agent data.

**Related documents:**
- [ADR-005: Agent Registry Design](../adrs/ADR-005-agent-registry.md)
- [PRD-004: Agent System](../prds/PRD-004-agent-system.md)
- [DDD-003: Agent Registry](../ddds/DDD-003-agent-registry.md)

---

## Phase 6: Documentation & Polish

**Duration:** 1-2 days
**Objective:** README reflects reality. Docs are accurate. Demo works.

### Tasks

6.1. Rewrite README.md
  - Lead with install + init + doctor (the 3-command experience)
  - Accurate feature descriptions (no overclaiming)
  - MCP integration section
  - Clear distinction: contracts = YAML rules, agents = prompt templates

6.2. Update CLAUDE.md for the new structure

6.3. Update demo to use new CLI commands

6.4. Write CHANGELOG.md for v1.0.0

6.5. Update CI-INTEGRATION.md for new hook system

**Exit criteria:** README matches reality. New user can follow it end-to-end.

---

## Dependency Graph

```
Phase 1 (Clean)
    ↓
Phase 2 (CLI Rewrite)
    ↓          ↓
Phase 3      Phase 4
(MCP)        (Install)
    ↓          ↓
Phase 5 (Agents)
    ↓
Phase 6 (Docs)
```

Phases 3 and 4 can run in parallel after Phase 2 completes.

---

## Risk Register

| Risk | Impact | Mitigation |
|------|--------|------------|
| Bash→Node.js rewrite breaks existing adopters | HIGH | Keep legacy scripts in `scripts/legacy/`, document migration path |
| MCP protocol changes | MEDIUM | Pin to MCP spec version, abstract protocol layer |
| Contract loader regex performance on large codebases | MEDIUM | Add file glob filtering, lazy loading, benchmark in Phase 2 |
| Agent frontmatter breaks existing agent consumers | LOW | Frontmatter is ignored by markdown renderers |
| Sample app removal upsets contributors | LOW | Archive to separate repo with redirect in README |

---

## Success Metrics

| Metric | Target |
|--------|--------|
| Test suite | 678/678 passing (100%) |
| Install time | < 60 seconds |
| `specflow init` time | < 10 seconds |
| `specflow doctor` checks | 13+ all passing on fresh init |
| `specflow enforce` on demo project | Correctly catches all violations |
| MCP tools | 8 tools, all functional |
| Package size (`npm pack`) | < 500KB (excluding node_modules) |
| Root directory files | <= 8 (down from 20+) |
