# Specflow-to-Sprint: Agentic Execution Workflow

**How to go from raw GitHub issues to parallel, dependency-ordered implementation using Claude Code's Task tool and the Specflow agent chain.**

---

## The Problem

You have 30+ GitHub issues on a board. Some are one-liners ("Add leave request feature"), some have partial specs, some are well-written. You want to:

1. Make them all build-ready with executable contracts
2. Know which ones depend on which
3. Execute them in parallel waves, respecting dependencies
4. Have agents post status updates on every ticket as they go

This workflow does all four.

---

## The Agent Chain

```
┌─────────────────────┐
│  1. specflow-writer  │  Raw issues → full-stack tickets with executable contracts
└──────────┬──────────┘
           │
┌──────────▼──────────┐
│  2. board-auditor    │  Audit: are all tickets spec-compliant?
│     + specflow-      │  Produces gap report, triggers remediation
│     uplifter         │
└──────────┬──────────┘
           │
┌──────────▼──────────┐
│  3. dependency       │  Parse SQL REFERENCES, TypeScript imports, epic hierarchy
│     mapper           │  → topological sort → sprint waves
└──────────┬──────────┘
           │
┌──────────▼──────────┐
│  4. implementation   │  Per-issue agents using:
│     agents           │  • migration-builder (SQL)
│     (parallel)       │  • edge-function-builder (Deno)
│                      │  • frontend builder (React hooks + components)
└──────────┬──────────┘
           │
┌──────────▼──────────┐
│  5. contract-        │  Verify implementation matches contracts
│     validator        │  → close tickets or flag gaps
└──────────┬──────────┘
           │
┌──────────▼──────────┐
│  6. playwright-      │  Generate e2e tests from Gherkin scenarios
│     from-specflow    │
└──────────┬──────────┘
           │
┌──────────▼──────────┐
│  7. ticket-closer    │  Post final comments, close issues
└─────────────────────┘
```

---

## Step-by-Step Walkthrough

### Phase 1: Make Issues Build-Ready

**What you tell Claude Code:**

> Take issues #67-#86 and #98-#103 and run the specflow-writer agent on each one. Make them compliant with full Gherkin, SQL contracts, RLS policies, TypeScript interfaces, invariants, and acceptance criteria.

**What happens:**

Claude Code reads `scripts/agents/specflow-writer.md`, then launches one Task per issue (or batches them into a few agents that handle multiple issues each):

```javascript
// Claude Code spawns these in a single message — all run in parallel
Task("Uplift #67-#72", "Read specflow-writer.md. For each of issues 67-72,
  read the issue, generate full-stack ticket sections, post as a comment.
  Include: Gherkin scenarios, SQL data contracts (CREATE TABLE, RLS, triggers,
  RPCs), TypeScript interfaces, invariant references, acceptance criteria.",
  "general-purpose", { run_in_background: true })

Task("Uplift #73-#78", "...", "general-purpose", { run_in_background: true })
Task("Uplift #79-#86", "...", "general-purpose", { run_in_background: true })
```

**What each agent produces (posted as GitHub comments):**

```markdown
## Scope
**In Scope:** Notification inbox table, mark-read RPCs, bell component
**Not In Scope:** Email delivery, SMS, push sending

## Data Contract

### Table: `notification_inbox`
```sql
CREATE TABLE notification_inbox (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  employee_id UUID NOT NULL REFERENCES employees(id),
  organization_id UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  notification_queue_id UUID REFERENCES notifications_queue(id),  -- ← DEPENDENCY SIGNAL
  title TEXT NOT NULL,
  body TEXT,
  read_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
```

### RLS Policies
```sql
CREATE POLICY "inbox_select" ON notification_inbox FOR SELECT
  USING (employee_id IN (SELECT id FROM employees WHERE user_id = auth.uid()));
```

### RPCs
```sql
CREATE OR REPLACE FUNCTION mark_notification_read(p_notification_id UUID)
RETURNS BOOLEAN AS $$ ... $$ LANGUAGE plpgsql SECURITY DEFINER;
```

## Frontend Interface
```typescript
interface UseNotificationInboxReturn {
  notifications: NotificationInboxItem[];
  unreadCount: number;
  markAsRead: (id: string) => Promise<void>;
  markAllAsRead: () => Promise<void>;
}
```

## Invariants Referenced
- I-NTF-006: Unread count must be non-negative
- I-NTF-007: read_at is immutable once set

## Acceptance Criteria
- [ ] Inbox table created with RLS
- [ ] mark_notification_read RPC works
- [ ] NotificationBell shows unread count
- [ ] Clicking notification marks as read

## Gherkin Scenarios
```gherkin
Feature: In-app Notification Inbox

Scenario: Employee sees unread notification count
  Given an employee has 3 unread notifications
  When they view the dashboard
  Then the notification bell shows "3"
```
```

**Why this matters:** Every issue now has *executable* SQL, *typed* interfaces, and *testable* scenarios. This is what makes dependency detection possible.

---

### Phase 2: Audit Compliance

**What you tell Claude Code:**

> Run the board-auditor agent across all uplifted issues. Tell me which ones are fully compliant and which have gaps.

**What happens:**

Claude Code reads `scripts/agents/board-auditor.md` and launches an audit agent:

```javascript
Task("Audit all issues", "Read board-auditor.md. For issues 67-86 and
  98-112, check each for: Gherkin (Y/N), Invariants (Y/N), Acceptance
  Criteria (Y/N), SQL contracts (Y/N), Scope section (Y/N), RLS policies
  (Y/N). Produce a compliance report and create a GitHub issue with results.",
  "general-purpose", { run_in_background: true })
```

**Output example:**

```
# 73 | Ghk=Y Inv=Y AC=Y SQL=Y Scp=Y RLS=Y | Channel router DB migration
# 74 | Ghk=Y Inv=Y AC=Y SQL=N Scp=Y RLS=N | Notification Router         ← GAPS
#107 | Ghk=Y Inv=Y AC=Y SQL=Y Scp=Y RLS=N | Org Vocabulary              ← GAPS
```

Issues with gaps get remediation — either re-run specflow-writer on them or have a targeted uplift agent add the missing sections.

---

### Phase 3: Map Dependencies

**What you tell Claude Code:**

> Read all compliant issues and build a dependency map. For each issue, find what tables it REFERENCES, what RPCs it calls, what hooks it imports. Produce a topological sort into sprint waves.

**What happens:**

```javascript
Task("Map dependencies", "Read every open issue. For each:
  1. Extract CREATE TABLE statements → note table names created
  2. Extract REFERENCES clauses → note table names depended on
  3. Extract TypeScript imports → note hooks/components depended on
  4. Match created-tables to referenced-tables across issues
  5. Build a directed dependency graph
  6. Topological sort into sprint waves (depth-first)
  7. Identify bottleneck issues (most downstream dependents)
  8. Create a GitHub issue with the full map + Mermaid diagram",
  "general-purpose", { run_in_background: true })
```

**How the agent detects dependencies from code contracts:**

| Signal | Example | Dependency |
|--------|---------|------------|
| SQL `REFERENCES` | `notification_queue_id UUID REFERENCES notifications_queue(id)` | #67 → #73 |
| SQL table usage in RPC | `SELECT ... FROM push_subscriptions` in #68's RPC | #68 → #73 |
| TypeScript import | `import { registerServiceWorker } from '@/lib/...'` | #69 → #71 |
| RLS join chain | `zone.space_id → space.site_id → site.org_id` | #109 → #108 |
| Epic child numbering | `TB-ADM-SPACES-001.3` depends on `001.2` | #109 → #108 |
| Explicit "Depends on" | Issue body says "Requires #73 notification tables" | Explicit |

**Output — sprint waves:**

```
Sprint 0 (depth=0, no blockers, all parallel):
  #64, #34, #62, #107, #108, #71, #67, #73, #104

Sprint 1 (depth=1, blocked by Sprint 0):
  #63→#62  #109→#108  #70→#73  #69→#71  #85→#71  #106→#104

Sprint 2 (depth=2):
  #99→#62,#63  #68→#73,#70  #110→#109  #61→#62,#63  #113→#106,#104
```

---

### Phase 4: Execute Sprints

**What you tell Claude Code:**

> Create tasks for Sprint 0 issues and execute them in parallel using the right agent for each. Pre-assign migration numbers to avoid conflicts. Each agent should read the issue spec, build the code, post a comment on the issue, and add the "in-progress" label.

**What happens:**

Claude Code creates `TaskCreate` entries with `blockedBy` relationships, then launches all Sprint 0 agents in a single message:

```javascript
// First: create tasks with dependency tracking
TaskCreate({ subject: "Sprint 0: #73 — Notification Engine DB" })  // Task 1
TaskCreate({ subject: "Sprint 0: #108 — Site + Space CRUD" })      // Task 3
TaskCreate({ subject: "Sprint 1: #109 — Zone CRUD" })              // Task 11
TaskUpdate({ taskId: "11", addBlockedBy: ["3"] })                  // #109 waits for #108

// Then: launch all Sprint 0 agents (single message = parallel)
Task("Build #73 notification DB", `
  You are a Supabase migration builder. Read scripts/agents/migration-builder.md.
  Read issue #73 with gh issue view 73.
  Create supabase/migrations/028_notification_engine.sql.
  [detailed requirements...]
  Post comment on issue. Add in-progress label.`,
  "general-purpose", { run_in_background: true })

Task("Build #108 site+space CRUD", `...`, "general-purpose", { run_in_background: true })
Task("Build #71 service worker", `...`, "general-purpose", { run_in_background: true })
// ... 6 more agents, all in the same message
```

**Pre-assigned collision resources:**

```
Migration 028 → #73 (notification engine)
Migration 029 → #107 (org vocabulary)
Migration 030 → #108 (sites and spaces)
Migration 031 → #67 (notification inbox)
Migration 032 → #104 (country rule packs)
Migration 033 → #64 (pg_cron)
```

This prevents two agents from both writing `028_*.sql`.

**As agents complete, the parent cascades:**

```
[Agent #62 completes] → TaskUpdate(7, "completed") → Task 10 (#63) is unblocked
[Agent #71 completes] → TaskUpdate(4, "completed") → Tasks 13, 14 (#69, #85) unblocked
[Agent #73 completes] → TaskUpdate(1, "completed") → Task 12 (#70) unblocked
... all Sprint 0 done ...
→ Launch all 6 Sprint 1 agents in next message
```

**Each agent self-reports on the GitHub issue:**

```markdown
## Implementation: Migration 028

**File:** `supabase/migrations/028_notification_engine.sql`

### Tables Created
- `notification_events` — delivery lifecycle tracking
- `notification_channels` — per-org channel config
- `push_subscriptions` — Web Push API subscriptions
- `notification_preferences` — user channel prefs
- `escalation_config` — escalation ladders

### Included
- RLS policies (SELECT/INSERT/UPDATE/DELETE) for all tables
- updated_at triggers
- Indexes for FKs and common queries
- Demo org seed data

**Status:** Migration file created, ready for review.
```

---

### Phase 5-7: Validate, Test, Close

After implementation sprints complete:

```javascript
// Validate contracts match implementation
Task("Validate Sprint 0+1", "Read contract-validator.md. For each implemented
  issue, verify: tables exist in migrations, RLS matches spec, RPCs have
  correct signatures, hooks exist in src/, all ACs are met.",
  "general-purpose", { run_in_background: true })

// Generate e2e tests from Gherkin
Task("Generate tests", "Read playwright-from-specflow.md. For issues with
  Gherkin scenarios, create Playwright test files in tests/e2e/.",
  "general-purpose", { run_in_background: true })

// Close validated tickets
Task("Close tickets", "Read ticket-closer.md. For each validated issue,
  post a closing comment and close the issue.",
  "general-purpose", { run_in_background: true })
```

---

## What This Unlocks

### 1. Executable Specs as Dependency Signals

Traditional issue trackers need manual "blocked by" links. With code contracts in every ticket, dependencies are **embedded in the SQL**:

```sql
-- This line in issue #67's spec IS the dependency declaration:
notification_queue_id UUID REFERENCES notifications_queue(id)
-- → notifications_queue is created by #73
-- → therefore #67 depends on #73
```

No manual linking. No dependency management tool. The code contracts *are* the dependency graph.

### 2. Parallel Execution Without Orchestration

Traditional multi-agent systems need a coordination bus (memory store, message queue, shared state). This workflow needs none — each agent is briefed with everything it needs and runs independently. The parent conversation is the orchestrator.

**9 agents, one message, ~8 minutes wall-clock for work that would take 45-60 minutes sequentially.**

### 3. Self-Documenting Implementation

Every agent posts its own status comment on the GitHub issue. The board updates itself. The commit history shows what was built. The migration files show the schema evolution. No separate status reports needed.

### 4. Sprint-Level Parallelism

Instead of one developer working through a backlog serially, you get:

```
Sprint 0:  ████████████████████  9 agents parallel  (~8 min)
Sprint 1:  ████████████████████  6 agents parallel  (~8 min)
Sprint 2:  ████████████████████  5 agents parallel  (~8 min)
Sprint 3+: ████████████████████  ...
```

Each sprint launches the moment its blockers clear. No idle time between sprints.

### 5. Deterministic Quality

Every agent reads the same `migration-builder.md` patterns. Every migration uses `gen_random_uuid()`. Every table gets RLS. Every RPC gets `GRANT EXECUTE` and `COMMENT ON FUNCTION`. The quality gates are in the agent prompt, not in a developer's memory.

### 6. Contract-Validated Closure

Tickets aren't closed because someone says "I think I'm done." They're closed because the contract-validator agent proved:
- Every table in the spec exists in a migration
- Every RLS policy matches the spec
- Every RPC has the correct signature
- Every acceptance criterion is met
- Every invariant is enforced (at DB, app, or test level)

---

## Quick Reference: What to Tell Claude Code

### "Make my issues build-ready"
```
Read scripts/agents/specflow-writer.md. For issues #X-#Y, generate full-stack
ticket specs with Gherkin, SQL contracts, RLS, TypeScript interfaces, invariants,
and acceptance criteria. Post as comments on each issue.
```

### "Audit my board"
```
Read scripts/agents/board-auditor.md. Scan issues #X-#Y for compliance:
Gherkin, invariants, ACs, SQL, scope, RLS. Report gaps.
```

### "Map dependencies and build order"
```
Read all open issues. Extract CREATE TABLE names, REFERENCES clauses, TypeScript
imports, and epic hierarchy. Build a dependency graph. Topological sort into
sprint waves. Create a GitHub issue with the map.
```

### "Execute Sprint N"
```
Create tasks for Sprint N issues using TaskCreate with blockedBy dependencies.
Pre-assign migration numbers starting at [NNN]. Launch implementation agents in
parallel — each reads its issue spec, builds code, posts a comment, adds
in-progress label. Use migration-builder.md patterns for SQL agents.
```

### "Validate and close"
```
Read scripts/agents/contract-validator.md. For each implemented issue, verify
all contracts are satisfied. Post validation reports. Close issues that pass.
Flag issues with gaps.
```

---

## Agent File Reference

| File | Agent | Phase | Role |
|------|-------|-------|------|
| `specflow-writer.md` | Specflow Writer | 1 | Raw issues → executable full-stack specs |
| `board-auditor.md` | Board Auditor | 2 | Audit spec compliance (Y/N per section) |
| `specflow-uplifter.md` | Specflow Uplifter | 2 | Fill gaps in partially-compliant issues |
| `dependency-mapper.md` | Dependency Mapper | 3 | SQL REFERENCES → topological sprint waves |
| `sprint-executor.md` | Sprint Executor | 4 | Coordinate parallel agent launches per wave |
| `migration-builder.md` | Migration Builder | 4 | Supabase PostgreSQL migration patterns |
| `frontend-builder.md` | Frontend Builder | 4 | React hooks + components |
| `edge-function-builder.md` | Edge Function Builder | 4 | Supabase Deno Edge Function patterns |
| `contract-validator.md` | Contract Validator | 5 | Verify implementation matches contracts |
| `playwright-from-specflow.md` | Playwright Generator | 6 | Gherkin → Playwright e2e tests |
| `journey-tester.md` | Journey Tester | 6 | Cross-feature e2e journey tests |
| `ticket-closer.md` | Ticket Closer | 7 | Post results, close validated issues |

---

## Real Numbers (Timebreez, Jan 2026)

| Metric | Value |
|--------|-------|
| Issues uplifted to full-stack specs | 40+ |
| Sprint 0 agents (parallel) | 9 |
| Sprint 1 agents (parallel) | 6 |
| Wall-clock time per sprint | ~8 minutes |
| Migrations created (028-036) | 9 |
| React hooks created | 12+ |
| Components created | 6+ |
| GitHub comments posted by agents | 30+ |
| Migration numbering conflicts | 0 |
| TypeScript errors introduced | 0 |
| Manual dependency linking | 0 |

The code contracts are the dependency graph. The Task tool is the orchestrator. The agents are the workforce.
