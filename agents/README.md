# Specflow Agent Library for Claude Code

**12 reusable subagent definitions that turn GitHub issues into implemented, tested, validated code — using Claude Code's Task tool for parallel execution.**

---

## What This Is

This is a library of agent prompt files (`.md`) that Claude Code spawns as autonomous subagents via the Task tool. Each agent has a specific role in the specflow-to-implementation pipeline:

1. **Specify** — Turn raw feature descriptions into executable full-stack tickets
2. **Audit** — Check your board for spec compliance
3. **Remediate** — Fix gaps in partially-compliant issues
4. **Map Dependencies** — Build a topological sprint plan from code contracts
5. **Execute** — Launch parallel implementation agents per sprint wave
6. **Validate** — Verify implementations match contracts
7. **Test** — Generate e2e tests from Gherkin scenarios
8. **Close** — Post summaries and close validated tickets

---

## Setup: Add Agents to Your Project

### Step 1: Copy agents into your project

```bash
# From this repo
cp -r agents/ your-project/scripts/agents/

# Or clone just the agents
git clone https://github.com/Hulupeep/Specflow.git --depth 1
cp -r Specflow/agents/ your-project/scripts/agents/
rm -rf Specflow
```

### Step 2: Adapt the implementation agents to your stack

The **specification, audit, and planning agents** are stack-agnostic — they work with any project that uses GitHub issues.

The **implementation agents** ship with patterns for a **Supabase + React + TanStack Query** stack. If your stack differs, update these files:

| Agent | What to Customize |
|-------|-------------------|
| `migration-builder.md` | SQL dialect, ORM patterns, migration tool (Prisma, Knex, raw SQL, etc.) |
| `frontend-builder.md` | Framework (React/Vue/Svelte), state management, styling approach |
| `edge-function-builder.md` | Runtime (Deno/Node), hosting platform, deployment patterns |
| `playwright-from-specflow.md` | Test framework, selector strategy, auth helpers |

The structure stays the same — Role, Trigger, Process, Quality Gates — just swap the domain knowledge.

### Step 3: Reference agents in your CLAUDE.md

Add to your project's `CLAUDE.md`:

```markdown
## Specflow Agents

This project uses Specflow agents for agentic development. Agent definitions
are in `scripts/agents/`. Claude Code reads these when spawning subagents.

### Available Agents
| Agent | File | Purpose |
|-------|------|---------|
| specflow-writer | scripts/agents/specflow-writer.md | Issue → full-stack spec |
| board-auditor | scripts/agents/board-auditor.md | Board compliance scan |
| dependency-mapper | scripts/agents/dependency-mapper.md | Build order planning |
| sprint-executor | scripts/agents/sprint-executor.md | Parallel sprint execution |
| migration-builder | scripts/agents/migration-builder.md | Database migrations |
| frontend-builder | scripts/agents/frontend-builder.md | UI hooks + components |
| contract-validator | scripts/agents/contract-validator.md | Implementation verification |

### Trigger Rules
When the user says "uplift issues" → use specflow-writer
When the user says "audit the board" → use board-auditor
When the user says "map dependencies" → use dependency-mapper
When the user says "execute sprint" → use sprint-executor
When the user says "validate implementation" → use contract-validator
```

---

## Usage: Run the Pipeline

### Phase 1: Make Your Issues Build-Ready

**Tell Claude Code:**

> Read `scripts/agents/specflow-writer.md`. For issues #10 through #25, generate full-stack specs with Gherkin scenarios, SQL data contracts, RLS policies, TypeScript interfaces, invariant references, and acceptance criteria. Post as comments on each issue.

**What happens:** Claude Code launches background agents (one per batch of issues) that read each issue and post uplift comments with executable contracts:

```sql
-- This SQL in the issue comment IS the spec AND the dependency signal
CREATE TABLE notification_inbox (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  employee_id UUID NOT NULL REFERENCES employees(id),
  notification_queue_id UUID REFERENCES notifications_queue(id), -- ← dependency on another issue
  title TEXT NOT NULL,
  read_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
```

### Phase 2: Audit Your Board

**Tell Claude Code:**

> Read `scripts/agents/board-auditor.md`. Scan all open issues and check each for: Gherkin, SQL contracts, RLS, invariants, acceptance criteria, scope section. Report which are compliant and which need uplift.

**Output:** A compliance matrix showing which issues are ready and which need more work.

### Phase 3: Fix Gaps

**Tell Claude Code:**

> Read `scripts/agents/specflow-uplifter.md`. Issues #15, #18, and #22 are missing executable RLS policies. Add them as uplift comments following the project's RLS pattern.

### Phase 4: Map Dependencies and Build Order

**Tell Claude Code:**

> Read `scripts/agents/dependency-mapper.md`. Read all open issues. Extract CREATE TABLE names, REFERENCES clauses, TypeScript imports, and epic hierarchy. Build a dependency graph. Topological sort into sprint waves. Create a GitHub issue with the map.

**Output:** A sprint plan like:

```
Sprint 0 (no blockers):  #10, #12, #15, #18, #20    ← launch all parallel
Sprint 1 (depth=1):      #11, #16, #19, #22          ← launch after Sprint 0
Sprint 2 (depth=2):      #13, #17, #23               ← launch after Sprint 1
```

**The key insight:** The SQL `REFERENCES` clauses in the specflow contracts ARE the dependency graph. No manual "blocked by" linking needed.

### Phase 5: Execute Sprint Waves

**Tell Claude Code:**

> Create tasks for Sprint 0 issues and execute them in parallel. Pre-assign migration numbers starting at 028. Each agent should read its issue spec, read `scripts/agents/migration-builder.md` for patterns, build the code, post a comment on the issue, and add the "in-progress" label. Use the right agent type for each issue — migration-builder for DB tasks, frontend-builder for UI tasks.

**What happens:** Claude Code launches 5-10 agents in a single message, all running in parallel:

```
Agent 1: Building migration 028 for issue #10 (5 tables, RLS, RPCs)
Agent 2: Building migration 029 for issue #12 (vocabulary table + hook)
Agent 3: Building migration 030 for issue #15 (CRUD tables + hooks)
Agent 4: Building service worker for issue #18 (frontend only)
Agent 5: Building migration 031 for issue #20 (rule pack tables + RPC)
... all running simultaneously ...
```

Each agent posts a comment on its GitHub issue when done. The parent tracks completions and launches Sprint 1 when all Sprint 0 blockers clear.

### Phase 6: Validate and Close

**Tell Claude Code:**

> Read `scripts/agents/contract-validator.md`. For each implemented issue, verify all data contracts exist in migrations, all RLS policies match spec, all RPCs have correct signatures, all acceptance criteria are met. Post validation reports.

Then:

> Read `scripts/agents/playwright-from-specflow.md`. Generate Playwright e2e tests from the Gherkin scenarios in issues #10-#25.

Then:

> Read `scripts/agents/ticket-closer.md`. Close all validated issues with implementation summaries.

---

## The Agent Registry

### Specification Agents (stack-agnostic)

| Agent | File | Input | Output |
|-------|------|-------|--------|
| **specflow-writer** | `specflow-writer.md` | Raw issue / feature description | Full-stack spec with Gherkin, SQL, RLS, TypeScript, invariants, ACs |
| **board-auditor** | `board-auditor.md` | Issue number range | Compliance matrix (Y/N per section per issue) |
| **specflow-uplifter** | `specflow-uplifter.md` | Issues + missing sections | Uplift comments filling specific gaps |

### Planning Agents (stack-agnostic)

| Agent | File | Input | Output |
|-------|------|-------|--------|
| **dependency-mapper** | `dependency-mapper.md` | All open issues | Topological sprint plan + bottleneck ranking |
| **sprint-executor** | `sprint-executor.md` | Sprint plan + issue list | Parallel agent launches with resource pre-assignment |

### Implementation Agents (Supabase + React — adapt to your stack)

| Agent | File | Input | Output |
|-------|------|-------|--------|
| **migration-builder** | `migration-builder.md` | Issue with SQL contract | Migration SQL file |
| **frontend-builder** | `frontend-builder.md` | Issue with TypeScript interface | React hooks + components |
| **edge-function-builder** | `edge-function-builder.md` | Issue with function spec | Deno Edge Function |

### Validation & Testing Agents (stack-agnostic patterns, framework-specific tests)

| Agent | File | Input | Output |
|-------|------|-------|--------|
| **contract-validator** | `contract-validator.md` | Implemented issue numbers | Validation report (PASS / PARTIAL / FAIL) |
| **playwright-from-specflow** | `playwright-from-specflow.md` | Issues with Gherkin scenarios | Playwright e2e test files |
| **journey-tester** | `journey-tester.md` | Cross-feature journey description | Journey test file |

### Closure Agents (stack-agnostic)

| Agent | File | Input | Output |
|-------|------|-------|--------|
| **ticket-closer** | `ticket-closer.md` | Validated issue numbers | Issue comments + closures |

---

## Pipeline Diagram

```
Phase 1: SPECIFICATION
  specflow-writer ────────────────────────────────── Raw issues --> executable specs
         |
Phase 2: AUDIT & REMEDIATION
  board-auditor ──────────────────────────────────── Compliance matrix
         |
  specflow-uplifter (for partial issues) ─────────── Fill gaps
         |
  contract-validator (pre-implementation) ────────── Verify spec quality
         |
Phase 3: DEPENDENCY PLANNING
  dependency-mapper ──────────────────────────────── Topological sort --> sprint waves
         |
Phase 4: IMPLEMENTATION (sprint-executor dispatches per wave)
  sprint-executor -+- migration-builder ──────────── SQL migrations (parallel)
                   +- frontend-builder ───────────── React hooks + components (parallel)
                   +- edge-function-builder ──────── Edge Functions (parallel)
         |
Phase 5: TESTING
  contract-validator (post-implementation) ───────── Verify contracts met
         |
  playwright-from-specflow + journey-tester ──────── E2E tests (parallel)
         |
Phase 6: CLOSURE
  ticket-closer ──────────────────────────────────── Close validated issues
```

---

## How Claude Code's Task Tool Works

The Task tool spawns autonomous subagent processes. Key mechanics:

**Parallel execution:** Multiple `Task()` calls in a single message run concurrently — not queued, truly parallel.

**Background mode:** `run_in_background: true` lets agents work while the parent continues. The parent is notified on completion.

**Full tool access:** Each agent gets Bash, Read, Write, Edit, Glob, Grep — same as the parent. They can run `gh issue view`, `tsc --noEmit`, write files, and post GitHub comments.

**Prompt-as-briefing:** Agents can't see the parent conversation. The prompt IS their entire mission. Well-briefed agents operate autonomously. Poorly-briefed agents waste cycles.

**No orchestration bus:** No MCP server, no shared memory, no hooks. The parent conversation tracks state. Each agent is independent.

```javascript
// Launch 5 agents in one message — all run in parallel
Task("Build #10 DB migration", "Read scripts/agents/migration-builder.md...",
  "general-purpose", { run_in_background: true })
Task("Build #12 vocabulary", "Read scripts/agents/migration-builder.md...",
  "general-purpose", { run_in_background: true })
Task("Build #15 CRUD hooks", "Read scripts/agents/frontend-builder.md...",
  "general-purpose", { run_in_background: true })
Task("Build #18 service worker", "Read scripts/agents/frontend-builder.md...",
  "general-purpose", { run_in_background: true })
Task("Build #20 rule packs", "Read scripts/agents/migration-builder.md...",
  "general-purpose", { run_in_background: true })
```

---

## A Note on "Contracts"

Specflow uses the word "contract" in two complementary ways:

1. **YAML enforcement contracts** (the original Specflow system) — `feature_auth.yml` files with `forbidden_patterns` and `required_patterns` that CI scans against source code. These prevent architectural drift. See [CONTRACT-SCHEMA.md](../CONTRACT-SCHEMA.md).

2. **SQL data contracts** (the agents layer) — `CREATE TABLE`, `REFERENCES`, `CREATE POLICY`, and `CREATE FUNCTION` SQL embedded in GitHub issue specs. These define what each issue builds and enable automatic dependency detection.

Both serve the same purpose: **making specs executable and enforceable**. YAML contracts enforce architecture rules at build time. SQL data contracts enforce implementation contracts at the issue level and enable the dependency-mapper agent to build sprint plans automatically.

---

## Why Code Contracts Enable This

Traditional issue trackers need manual "blocked by" links. With executable code contracts in every ticket, dependencies are **embedded in the SQL**:

```sql
-- This REFERENCES clause in issue #11's spec IS the dependency declaration:
notification_queue_id UUID REFERENCES notifications_queue(id)
-- notifications_queue is created by issue #10
-- Therefore: #11 depends on #10
```

The dependency-mapper agent reads these signals from every issue and builds the graph automatically. Six signal types:

| Signal | Example | How Detected |
|--------|---------|--------------|
| SQL `REFERENCES` | `FK to notifications_queue` | Grep for REFERENCES in issue body |
| SQL table usage in RPCs | `SELECT FROM push_subscriptions` | Parse RPC bodies |
| TypeScript imports | `import { registerSW } from '@/lib'` | Parse frontend interface sections |
| RLS join chains | `zone -> space -> site -> org` | Analyze RLS USING clauses |
| Epic child numbering | `FEATURE-001.3` depends on `FEATURE-001.2` | Parse title patterns |
| Explicit mentions | "Depends on #10" | Grep for "depends on", "blocked by" |

**No code contracts = no automatic dependency detection = manual sprint planning.**
**Code contracts = automatic dependency detection = automatic sprint planning.**

---

## Real-World Results

From a production project (Timebreez, Jan 2026):

| Metric | Value |
|--------|-------|
| Issues uplifted to full-stack specs | 40+ |
| Sprint 0: agents launched in parallel | 9 |
| Sprint 1: agents launched in parallel | 6 |
| Wall-clock time per sprint wave | ~8 minutes |
| Migrations created in one session | 9 |
| React hooks created | 12+ |
| Components created | 6+ |
| GitHub comments posted by agents | 30+ |
| Migration numbering conflicts | 0 |
| TypeScript errors introduced | 0 |
| Manual dependency linking required | 0 |

Sequential equivalent for Sprint 0 (9 issues): ~60 minutes.
Parallel with Task tool: ~8 minutes.

---

## Detailed Workflow Guide

See **[WORKFLOW.md](./WORKFLOW.md)** for the step-by-step walkthrough with exact prompts, agent briefing templates, and sprint execution patterns.
