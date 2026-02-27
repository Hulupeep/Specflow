# CLAUDE.md Contract Section Template

This is the **full template** with placeholders for customization.

**Just tell your LLM:**
```
Use Specflow's CLAUDE-MD-TEMPLATE.md to add contract enforcement to my CLAUDE.md.
Fill in the placeholders for my project.
```

For a simpler version, see [CLAUDE.md](CLAUDE.md).

---

## 🚨 NEW SESSION ONBOARDING (For LLMs)

**If you are starting a fresh session with this template but don't have project context, ASK FIRST:**

```
I see this is a Specflow project, but I need context before I can help:

1. What repository/project are we working in?

2. Where is your project board?
   - GitHub Issues/Projects → I'll use `gh` CLI
   - Jira → I'll need `jira` CLI configured
   - Linear → I'll need `linear` CLI configured
   - Notion → I'll need Notion MCP or API
   - Other → Please specify tool and auth method

3. What's the current focus? (issues, milestone, or "show me the backlog")

4. What's the tech stack? (React, Node, Python, etc.)

Please provide this info or point me to a project CLAUDE.md with context.
```

### Supported Project Boards

| Board | CLI | Install | Auth |
|-------|-----|---------|------|
| GitHub Issues | `gh` | `brew install gh` | `gh auth login` |
| Jira | `jira` | `brew install jira-cli` | `jira init` |
| Linear | `linear` | `npm i -g @linear/cli` | `linear auth` |
| Shortcut | `sc` | `brew install shortcut-cli` | API token env var |
| Notion | MCP server | MCP config | API key |

**DO NOT assume or guess.** Each project has its own board, contracts, schemas, and conventions.

Once you have context, add it to the project's CLAUDE.md so future sessions don't need to ask.

---

## Instructions for LLMs:

**Copy the section below and add it to the TOP of your project's CLAUDE.md file.**

Replace placeholders in [brackets] with your project-specific information.

---

## TEMPLATE START (Copy everything below this line)

```markdown
# [PROJECT_NAME] - Development Guide

## Project Context

<!-- REQUIRED: Fill this in so Claude knows the project context -->

**Repository:** [org/repo-name]
**Project Board:** [GitHub Issues | Jira | Linear | Notion | Other]
**Board CLI:** [gh | jira | linear | other] (must be installed and authenticated)
**Tech Stack:** [e.g., React + Vite + Tailwind, Supabase, Vercel]
**Primary Focus:** [e.g., Scheduling SaaS for childcare providers]

<!-- If this section is empty, Claude MUST ask the user for context before proceeding -->

---

## Specflow Rules

### Rule 1: No Ticket = No Code

All work requires a GitHub issue before writing any code.

### Rule 2: Commits Must Reference an Issue

**NEVER run `git commit` without a `#<issue-number>` in the message.**

If you don't know the issue number, **ASK** before committing. Do not guess, do not omit it.

```bash
# ✅ GOOD
git commit -m "feat: add signup validation (#375)"

# ❌ BAD — journey tests silently skip, nothing is verified
git commit -m "feat: add signup validation"
```

Without an issue number, hooks cannot find the journey contract and tests are silently skipped.

### Rule 3: Tests Must Pass Before Closing

```bash
npm test -- contracts    # Contract tests
npm run test:e2e         # E2E journey tests
```

Work is NOT complete if tests fail.

---

## 🚨 CRITICAL: Architectural Contracts - READ THIS FIRST

### MANDATORY: Check Contracts Before ANY Code Changes

This project uses **architectural contracts** (YAML files in `docs/contracts/`) that define **non-negotiable rules**. These contracts are enforced by automated tests.

**⚠️ BEFORE modifying ANY protected file, you MUST:**
1. Read the relevant contract in `docs/contracts/`
2. Run the contract verification script
3. Check the compliance checklist in the contract
4. Only proceed if the change is allowed

#### Files Protected by Contracts:

<!-- UPDATE THIS TABLE as you add contracts -->

| Files | Contract | Key Rules |
|-------|----------|-----------|
| `packages/core/**/*.ts` | `feature_architecture.yml` | ARCH-001: No browser APIs |
| `src/background/**/*.ts` | `feature_architecture.yml` | ARCH-002: API calls only here |
| `src/auth/**/*.ts` | `feature_auth.yml` | AUTH-001: Require authMiddleware |
<!-- Add more protected files here -->

**Architecture contracts apply everywhere.** Check `feature_architecture.yml` before ANY code change.

#### How to Check Contracts:

```bash
# 1. Check if file is protected
node scripts/check-contracts.js src/your-file.ts

# 2. Read the contract (SOURCE OF TRUTH)
cat docs/contracts/[contract_name].yml

# 3. Run contract verification tests
npm test -- src/__tests__/contracts/

# 4. Check specific contract
npm test -- [contractName]
```

#### Contract Violation Example:

If you try to violate a contract:
```
❌ CONTRACT VIOLATION: [contract_id]
File contains forbidden pattern: /[pattern]/
Issue: [description of violation]
See docs/contracts/[contract_name].yml
```

The build will FAIL and the PR will be BLOCKED.

#### Overriding Contracts:

**Only the human user can override non-negotiable rules.**

To override, user must explicitly say:
```
override_contract: [contract_name]
```

Then you may proceed, but should:
1. Explain why this violates the contract
2. Warn about potential consequences
3. Ask if contract should be updated permanently

#### Available Contracts:

<!-- UPDATE THIS LIST as you add contracts -->

##### 1. `[contract_name].yml`
**Protects:** [Brief description of what this contract enforces]
**Rules:** [Number] non-negotiable rules
**Status:** Active
**Key rules:**
- `[rule_id]`: [Brief description]

<!-- Add more contracts here as you create them -->

##### Default Contracts (shipped with Specflow):

| Contract | Rules | What it catches |
|----------|-------|----------------|
| `security_defaults.yml` | SEC-001..005 | Hardcoded secrets, SQL injection, XSS, eval, path traversal |
| `accessibility_defaults.yml` | A11Y-001..004 | Missing alt text, aria-labels, form labels, tabindex |
| `test_integrity_defaults.yml` | TEST-001..005 | Mocking in E2E/journey tests, suspicious patterns, placeholder markers |
| `production_readiness_defaults.yml` | PROD-001..003 | Demo/mock data in production, placeholder domains, hardcoded IDs |

Install: `cp Specflow/templates/contracts/*.yml docs/contracts/`

##### Adding New Contracts:

See `META-INSTRUCTION.md` for infrastructure setup.

**📖 Full Documentation:**
- **Core Docs (Start Here)**:
  - `CONTRACTS-README.md` - System overview
  - `SPEC-FORMAT.md` - How to write specs
  - `CONTRACT-SCHEMA.md` - YAML format
  - `LLM-MASTER-PROMPT.md` - LLM workflow
- **Reference Guides**:
  - `MASTER-ORCHESTRATOR.md` - Complete automation (heavy)
  - `SPEC-TO-CONTRACT.md` - Conversion examples
  - `MID-PROJECT-ADOPTION.md` - Existing codebases

---

## 🔄 Journey Verification Hooks

### Why Hooks Exist

**Option A: Manual** - You tell Claude "run tests" every time (you'll forget)
**Option B: Hooks** - Tests run automatically at build boundaries (can't forget)

### Project Configuration

<!-- UPDATE THESE VALUES for your project -->

- **Package Manager:** [npm | yarn | pnpm | bun]
- **Build Command:** `[package_manager] run build`
- **Test Command:** `[package_manager] run test:e2e`
- **Test Directory:** `tests/e2e`
- **Local URL:** `http://localhost:[port]`
- **Production URL:** `https://[your-domain.com]`
- **Deploy Platform:** [vercel | netlify | railway | none]
- **Deploy Wait:** [90] seconds
- **Migration Command:** [supabase db push | prisma migrate | N/A]

### Trigger Points

| Trigger | Environment | Action |
|---------|-------------|--------|
| PRE-BUILD | LOCAL | Run baseline E2E tests |
| POST-BUILD | LOCAL | Run E2E tests, compare to baseline |
| POST-COMMIT | **PRODUCTION** | Wait for deploy, verify production |
| POST-PUSH | LOCAL | Check CI status, report pass/fail |
| POST-MIGRATION | **PRODUCTION** | Test APIs, run E2E |

### Mandatory Reporting

Claude MUST report for EVERY test run:

1. **WHERE** - "Tests passed against LOCAL/PRODUCTION (URL)"
2. **WHICH** - "Ran: signup.spec.ts, login.spec.ts, ..."
3. **HOW MANY** - "12/12 passed (0 failed, 0 skipped)"
4. **SKIPPED explained** - Every skip needs a reason

```
❌ BAD:  "Tests passed"
✅ GOOD: "Tests passed against PRODUCTION (https://yourapp.com)
         Ran: signup.spec.ts, login.spec.ts
         Results: 12/12 passed (0 failed, 0 skipped)"
```

### Anti-Patterns

- ❌ "Tests mostly passed" (vague)
- ❌ "10/12 passed, 2 skipped" (skips unexplained)
- ❌ "E2E tests passed" (no environment)
- ✅ Explicit WHERE, WHAT, HOW MANY, SKIPPED reasons

**See:** `.claude/hooks/journey-verification.md` for detailed behavior.

---

## 🌊 Wave Execution & Orchestration (Optional)

<!-- INCLUDE THIS SECTION if your project uses wave-based GitHub issue orchestration -->

### Wave Execution Progress Tracking

**Status Emoji Legend:**
- ✅ Complete (committed, tests pass)
- 🔄 In Progress (agent spawned, working)
- 📋 Ready (dependencies met, can start)
- ⏸️ Blocked (waiting on dependencies)
- ❌ Failed (needs attention)
- 🎯 Next Up (priority, ready after current completes)

#### Progress Report Format:

```
═══════════════════════════════════════════════════════════════
WAVE EXECUTION PROGRESS
═══════════════════════════════════════════════════════════════

CURRENT WAVE: Wave [N]
├─ Issue #[number]: [title] [status]
├─ Issue #[number]: [title] [status]
└─ Issue #[number]: [title] [status]

NEXT WAVES:
Wave [N+1] (📋 Ready after Wave [N])
├─ Issue #[number]: [title]
└─ Issue #[number]: [title]

Wave [N+2] (⏸️ Blocked by #[number])
└─ Issue #[number]: [title]

DEPENDENCIES:
#[number] ← #[number], #[number]  (blocks 2 issues)
#[number] ← #[number]              (blocks 1 issue)

PARALLEL OPPORTUNITIES:
- Wave [N]: [X] issues can run in parallel (saves ~[Y] days)
- Wave [N+1]: [X] issues can run in parallel (saves ~[Y] days)

COMPLETION:
- Issues closed: [X]/[total]
- Waves completed: [X]/[total]
- Estimated remaining: [X] waves
```

#### Dependency Graph Format:

```
Wave Structure:
┌─────────────────────────────────────────────────────────────┐
│ Wave 1a (Foundation)                                        │
│   #[number] [EPIC Title] [P1-Critical] ✅                  │
│   └── Blocks: #[number], #[number], #[number], #[number]   │
├─────────────────────────────────────────────────────────────┤
│ Wave 1b (Parallel Group 1) - Can run simultaneously        │
│   #[number] [Title] [P1-Critical] 🔄 (Agent: [id])         │
│   #[number] [Title] [P1-Critical] 🔄 (Agent: [id])         │
│   #[number] [Title] [P1-Critical] 🔄 (Agent: [id])         │
│   └── Depends on: #[number] (complete)                     │
├─────────────────────────────────────────────────────────────┤
│ Wave 1c (Parallel Group 2) - After Group 1                 │
│   #[number] [Title] [P1-Critical] 📋                        │
│   #[number] [Title] [P1-Critical] 📋                        │
│   └── Depends on: #[number] (complete)                     │
└─────────────────────────────────────────────────────────────┘

Parallelization Savings:
- Without parallel: [X] days (sequential)
- With parallel: [Y] days (batched)
- Time saved: [Z] days ([N]% reduction)
```

### Autonomous Wave Execution

**When user requests autonomous execution**, you need these 5 parameters:

#### 1. Wave Selection Criteria
```
Execute remaining Wave [N] issues?
Move to Wave [N+1] after Wave [N] completes?
Or: Execute ALL open issues until none remain?
```

#### 2. Stop Conditions
```
Time limit: Stop after [X] hours regardless of progress?
Wave limit: Complete [N] waves then stop?
Or: Run until backlog empty or blocking error?
```

#### 3. Approval Authority
```
Can I auto-proceed through waves without checkpoints?
Can I commit directly to main? (Push = live deployment)
Or: Create branches/PRs for review?
```

#### 4. Quality Gates
```
If contract tests fail: STOP or continue with other waves?
If E2E tests fail: STOP or continue with other waves?
If migration fails: STOP or skip that wave?
Required pass threshold: 100% or allow some failures?
```

#### 5. Deployment Authority
```
Can I push database migrations to production?
Can I deploy serverless functions/Edge Functions?
Or: Commit only, no production changes?
```

**Example autonomous request:**
```
Execute all Wave 1 issues. Stop if any contract test fails.
Commit to main but don't push migrations. Time limit: 2 hours.
```

### Parallel Execution Determination

**LLM should automatically determine parallel batches by analyzing:**

1. **Parse dependencies** from issue bodies ("Depends on #XXX")
2. **Identify blockers** (issues that block multiple others = sequential)
3. **Group independent issues** (same wave, no cross-dependencies = parallel)
4. **Batch size limit** (3-4 agents max to avoid context overflow)

**Execution pattern:**
```typescript
// Batch 1 (Sequential - Foundation/Blocker)
[Single Message]:
  Task("Implement #[number] [Title]", "{full prompt}", "general-purpose")

// Wait for completion, then...

// Batch 2 (Parallel - Independent After Batch 1)
[Single Message]:
  Task("Implement #[number] [Title]", "{full prompt}", "general-purpose")
  Task("Implement #[number] [Title]", "{full prompt}", "general-purpose")
  Task("Implement #[number] [Title]", "{full prompt}", "general-purpose")
```

**Always report parallelization savings:**
```
Executed [N] agents in parallel
Estimated time saved: [X] days ([Y]% reduction)
Sequential would take [A] days, parallel took [B] days
```

---

## Team Roles & CSV Journeys

### Team Roles

| Role | Responsibility | Format |
|------|---------------|--------|
| **Tech Lead** | Define architecture contracts (YAML) | `docs/contracts/feature_*.yml` |
| **Product Designer** | Define user journeys (CSV) | `journeys.csv` → compiled to YAML |
| **Developer** | Implement features, fix violations | Code + git |
| **CI** | Enforce contracts, catch bypasses | GitHub Actions |

### CSV Journey Workflow

Product designers author journeys in CSV (Google Sheets, Excel, or text editor):

```bash
# Compile CSV to contracts + Playwright stubs
npm run compile:journeys -- path/to/journeys.csv

# Commit all outputs
git add journeys.csv docs/contracts/journey_*.yml tests/e2e/journey_*.spec.ts
git commit -m "feat: add signup + login journeys"
```

See `templates/journeys-template.csv` for the CSV format.

### CI Enforcement

Copy CI templates to catch violations on PRs and direct pushes:

```bash
cp Specflow/templates/ci/specflow-compliance.yml .github/workflows/
cp Specflow/templates/ci/specflow-audit.yml .github/workflows/
```

---

## Agent Teams (Default)

Agent Teams is the default execution model on Claude Code 4.6+. Detection is automatic — no environment variable needed.

| Goal | Command |
|------|---------|
| Execute waves (auto-detects mode) | "Execute waves" |
| View execution dashboard | "/specflow status" |
| Run journey gate for an issue | "Run journey gate tier 1 for issue #50" |
| Run wave gate | "Run journey gate tier 2 for issues #50 #51 #52" |
| Run regression check | "Run journey gate tier 3" |

When TeammateTool is unavailable, waves-controller falls back to subagent mode automatically.

## Journey Gates

| Gate | Scope | Blocks | When |
|------|-------|--------|------|
| Tier 1: Issue | J-* tests from one issue | Issue closure | After implementing issue |
| Tier 2: Wave | All J-* tests from all wave issues | Next wave | After all issues pass Tier 1 |
| Tier 3: Regression | Full E2E suite vs baseline | Merge to main | After wave passes Tier 2 |

Deferrals: `.claude/.defer-journal` (scoped by J-ID with tracking issue).
Baseline: `.specflow/baseline.json` (updated only on clean Tier 3 pass).

## [REST OF YOUR CLAUDE.MD CONTENT]
<!-- Your existing CLAUDE.md content goes here -->
```

## TEMPLATE END

---

## Customization Guide:

### Required Changes:

1. **[PROJECT_NAME]** - Replace with your actual project name
2. **Files Protected by Contracts** - Add your protected files
3. **Available Contracts** - List your contracts with descriptions
4. **Contract names** - Replace `[contract_name]` with actual contract IDs

### Optional Sections:

You can add:
- Quick reference table of contracts
- Link to security team contact
- Escalation process for contract overrides
- Project-specific contract examples

### Example Filled-In Version:

```markdown
# TabStax Extension - Development Guide

## 🚨 CRITICAL: Architectural Contracts - READ THIS FIRST

### MANDATORY: Check Contracts Before ANY Code Changes

This project uses **architectural contracts** (YAML files in `docs/contracts/`) that define **non-negotiable rules**. These contracts are enforced by automated tests.

**⚠️ BEFORE modifying ANY protected file, you MUST:**
1. Read the relevant contract in `docs/contracts/`
2. Run the contract verification script
3. Check the compliance checklist in the contract
4. Only proceed if the change is allowed

#### Files Protected by Contracts:

| Files | Contract | Key Rules |
|-------|----------|-----------|
| `packages/core/**/*.ts` | `feature_architecture.yml` | ARCH-001: Pure TypeScript |
| `src/background.ts` | `background_auth_hydration.yml` | No startup hydration |
| `src/lib/authStorage.ts` | `background_auth_hydration.yml` | chrome.storage only |
| `src/services/supabase/**` | `background_auth_hydration.yml` | Fire-and-forget |

**Architecture contracts apply everywhere.** Check `feature_architecture.yml` before ANY code change.

#### How to Check Contracts:

```bash
# 1. Check if file is protected
node scripts/check-contracts.js src/background.ts

# 2. Read the contract (SOURCE OF TRUTH)
cat docs/contracts/background_auth_hydration.yml

# 3. Run contract verification tests
npm test -- src/__tests__/contracts/

# 4. Check specific contract
npm test -- backgroundAuthHydration
```

#### Contract Violation Example:

If you try to add `localStorage` to `background.ts`:
```
❌ CONTRACT VIOLATION: bg_storage_002_chrome_storage_only
File contains forbidden pattern: /localStorage\.getItem/
Issue: localStorage.getItem() not allowed in MV3 service worker
See docs/contracts/background_auth_hydration.yml
```

The build will FAIL and the PR will be BLOCKED.

#### Overriding Contracts:

**Only the human user can override non-negotiable rules.**

To override, user must explicitly say:
```
override_contract: background_auth_hydration
```

#### Available Contracts:

##### 1. `background_auth_hydration.yml`
**Protects:** Background service worker auth and storage patterns
**Rules:** 3 non-negotiable rules
**Status:** Active
**Key rules:**
- `bg_auth_001_no_startup_hydration`: Background MUST NOT hydrate auth on startup
- `bg_storage_002_chrome_storage_only`: Background MUST use chrome.storage.local only
- `bg_messaging_003_fire_and_forget`: Popup sends sync requests fire-and-forget

**📖 Full Documentation:**
- **Core Docs (Start Here)**:
  - `CONTRACTS-README.md` - System overview
  - `SPEC-FORMAT.md` - How to write specs
  - `CONTRACT-SCHEMA.md` - YAML format
  - `LLM-MASTER-PROMPT.md` - LLM workflow
- **Reference Guides**:
  - `MASTER-ORCHESTRATOR.md` - Complete automation (heavy)
  - `SPEC-TO-CONTRACT.md` - Conversion examples
  - `MID-PROJECT-ADOPTION.md` - Existing codebases
```

---

## Verification:

After adding to CLAUDE.md, verify:

```bash
# 1. CLAUDE.md has contract section at top
head -50 CLAUDE.md | grep -i "architectural contracts"

# 2. Section is readable
cat CLAUDE.md | head -100

# 3. All links work
# Manually check that referenced files exist
```

Expected: Contract section appears in first 50 lines of CLAUDE.md

---

## Tips:

### Placement:
- Put contract section at **very top** (after title)
- Before project overview
- Before setup instructions
- LLMs read top of file first

### Brevity:
- Keep section concise (under 100 lines)
- Link to full docs for details
- Focus on "what to do" not "why"

### Updates:
- Update when adding new contracts
- Update protected files list
- Keep "Available Contracts" section current

### Testing:
After adding, test LLM workflow:
1. Ask LLM to modify a protected file
2. LLM should mention checking contract
3. LLM should run contract checker
4. LLM should read YAML contract

---

## Multi-Project Setup:

If you have multiple projects, add this to each project's CLAUDE.md:

```markdown
**Note:** Each project has its own contracts. Don't assume contracts
from Project A apply to Project B.

Current project: [PROJECT_NAME]
Contracts location: docs/contracts/
```
