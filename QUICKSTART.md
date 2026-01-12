# Specflow Quick Start

## TL;DR: Copy-Paste This to Your LLM

**You don't need to read anything first.** Just paste this prompt:

```
I want to use Specflow to protect my codebase. Read these docs:
- LLM-MASTER-PROMPT.md
- SPEC-FORMAT.md
- CONTRACT-SCHEMA.md
- USER-JOURNEY-CONTRACTS.md

Then interview me about my project:
- What architectural rules should NEVER be broken?
  (If I don't know, suggest best practices for my tech stack)
- What features exist and how should they behave?
- What user journeys must always work?
  (Suggest obvious ones based on my features)

From my answers:
1. Generate REQ IDs (AUTH-001, STORAGE-001, J-CHECKOUT-001, etc.)
2. Create contract YAML files in docs/contracts/
3. Create test files in src/__tests__/contracts/
4. Show me how to add to CI
5. Update this project's CLAUDE.md with contract rules

I'll describe things in plain English. You structure it.
```

**That's it.** The LLM interviews you, then generates everything.

---

## The Formula

```
Architecture + Features + Journeys = The Product
```

| Layer | What It Defines | Example |
|-------|-----------------|---------|
| **Architecture** | Structural invariants | "No payment data in localStorage" |
| **Features** | Product capabilities | "Queue orders by FIFO" |
| **Journeys** | User accomplishments | "User can add a commission" |

**Skip any layer → ship blind.** Define all three → contracts enforce them.

---

## See It Work First (2 min)

```bash
cd demo
npm install
npm run demo
```

You'll see a contract catch what unit tests miss.

---

## Choose Your Path

| Your Situation | Path |
|----------------|------|
| **I just want it to work** | Copy the prompt above, paste to LLM |
| Want to understand the system | Path 1 below |
| Existing project to protect | Path 2 below |
| Full automation | Path 3: [context/MASTER-ORCHESTRATOR.md](context/MASTER-ORCHESTRATOR.md) |

---

## Path 1: LLM Generates Everything (Recommended)

**For: Anyone who wants contracts without learning the format first**

### Step 1: Paste This Prompt

```
I want to use Specflow to protect my codebase. Read these docs:
- LLM-MASTER-PROMPT.md
- SPEC-FORMAT.md
- CONTRACT-SCHEMA.md
- USER-JOURNEY-CONTRACTS.md

Then interview me about my project:
- What architectural rules should NEVER be broken?
  (If I don't know, suggest best practices for my tech stack)
- What features exist and how should they behave?
- What user journeys must always work?
  (Suggest obvious ones based on my features)

From my answers:
1. Generate REQ IDs (AUTH-001, STORAGE-001, J-CHECKOUT-001, etc.)
2. Create contract YAML files in docs/contracts/
3. Create test files in src/__tests__/contracts/
4. Show me how to add to CI
5. Update this project's CLAUDE.md with contract rules

I'll describe things in plain English. You structure it.
```

### Step 2: Answer Questions

The LLM will ask things like:
- "What storage mechanisms are used? Any that should be forbidden?"
- "Are there API routes? Do they all need authentication?"
- "What's the critical user flow that must never break?"

Just answer in plain English. No special format needed.

### Step 3: LLM Produces

**Contract files:**
- `docs/contracts/feature_architecture.yml` - Architecture invariants
- `docs/contracts/feature_*.yml` - Feature rules
- `docs/contracts/journey_*.yml` - User journey definitions (DOD)

**Test files:**
- `src/__tests__/contracts/*.test.ts` - Contract tests (pattern scanning)
- `tests/e2e/journey_*.spec.ts` - Journey tests (Playwright E2E)

**Config:**
- `CLAUDE.md` updates - So future LLMs follow the rules
- CI config - So violations block merges

### Step 4: Run Tests

```bash
# Run contract tests (architecture + features)
npm test -- contracts

# Run journey tests (Playwright E2E)
npm test -- journeys

# Run everything
npm test
```

**Journeys are your Definition of Done, enforced by Playwright.** A feature isn't done when contract tests pass—it's done when users can accomplish their goals end-to-end.

---

## Path 2: Protect Existing Project

**For: You have working code and don't want LLMs breaking it**

### Step 1: Paste This Prompt

```
I have an existing project that works. I want to use Specflow to
prevent anyone (human or LLM) from breaking what works today.

Read LLM-MASTER-PROMPT.md and MID-PROJECT-ADOPTION.md, then:

1. Ask me what's working today that I never want broken
2. Generate "freeze contracts" from my plain English description
3. Create tests that scan the codebase for violations
4. If violations exist TODAY, tell me (we'll decide if they're ok)
5. Set up CI gates
6. Update CLAUDE.md

Start by asking: "What's working today that you never want broken?"
```

### Step 2: Describe What Works

Example answers:
```
"Our auth uses Redis sessions with 7-day TTL. Never localStorage."

"API routes all go through authMiddleware. No exceptions except /health."

"Passwords are bcrypt hashed. Never stored in plain text anywhere."

"The checkout flow: cart → payment → confirmation. If this breaks, we're dead."
```

### Step 3: LLM Creates Freeze Contracts

The LLM will generate:
- `AUTH-001`: Sessions use Redis, not localStorage
- `AUTH-002`: All /api/* routes have authMiddleware
- `SEC-001`: Passwords use bcrypt
- `J-CHECKOUT-001`: Cart → payment → confirmation flow works

Now if anyone tries to "optimize" your auth to use localStorage, **the build fails**.

---

## Path 3: I Already Have a Structured Spec

**For: Teams with existing requirement documents**

### Paste This Prompt

```
I have a spec with requirements. Use Specflow to turn it into
enforceable contracts.

Read:
- SPEC-FORMAT.md
- CONTRACT-SCHEMA.md
- LLM-MASTER-PROMPT.md

Here's my spec:

[PASTE SPEC HERE]

Generate:
1. ARCH contracts first (structural invariants)
2. FEAT contracts (feature requirements)
3. JOURNEY contracts (user flows with DOD criticality)
4. Tests for each contract
5. CI configuration
6. CLAUDE.md updates
```

The LLM will:
- Parse your existing requirements
- Generate REQ IDs if missing
- Create all contracts, tests, and config

---

## Path 4: Manual Setup (For Learning)

**For: Understanding the system deeply**

### Step 1: Read the Core Docs
```
SPEC-FORMAT.md      → How specs are structured
CONTRACT-SCHEMA.md  → YAML contract format
LLM-MASTER-PROMPT.md → How LLMs should use contracts
```

### Step 2: Create Contract Manually
```bash
cp examples/contract-example.yml docs/contracts/my_first_contract.yml
# Edit to match your constraint
```

### Step 3: Create Test Manually
```bash
cp examples/test-example.test.ts src/__tests__/contracts/myFirstContract.test.ts
# Edit patterns to match your contract
```

### Step 4: Verify
```bash
npm test -- myFirstContract
```

---

## Advanced: Subagents

For maximum efficiency with Claude Code, see [context/SUBAGENT-CONTRACTS.md](context/SUBAGENT-CONTRACTS.md).

Subagents let you spawn specialized assistants:
- `contract-generator` - Creates contracts from descriptions
- `test-generator` - Creates tests from contracts
- `contract-verifier` - Validates everything works

---

## Examples by Project Type

### API Project
```
Requirement: "All API endpoints must require authentication"

→ Read: SPEC-TO-CONTRACT.md (Example 1)
→ Creates: auth_001.yml contract
→ Tests: Scans routes for missing authMiddleware
→ Result: Build fails if route lacks auth
```

### E-Commerce
```
User Journey: "User adds to cart → checkout → payment → confirmation"

→ Read: USER-JOURNEY-CONTRACTS.md (Example 1)
→ Creates: journey_checkout.yml
→ Tests: Complete checkout flow end-to-end
→ Result: Journey breaks = tests fail
```

### Data Service
```
Requirement: "Email sending must be rate-limited"

→ Read: SPEC-TO-CONTRACT.md (Email Service Example)
→ Creates: email_rate_limit_001.yml
→ Tests: Verifies checkRateLimit() called before sendEmail()
→ Result: Violation = build blocked
```

---

## What You Get

After following any path above:

✅ **Enforceable contracts** - YAML files in `docs/contracts/`
✅ **Automated tests** - Scan source code for violations
✅ **CI/CD integration** - Blocks merges on violations
✅ **LLM guardrails** - AI checks contracts before changes
✅ **Documentation** - Contracts document architecture decisions

---

## Next Steps

1. **Choose your path** above
2. **Execute the steps**
3. **Verify tests pass**
4. **Add to CI/CD** (see CI-INTEGRATION.md)
5. **Create more contracts** as you build

---

## Common First Contracts

Start with these critical paths:

### 1. Authentication
```yaml
Requirement: "API endpoints must require authentication"
Contract: auth_001_api_endpoints.yml
Test: Scans routes for authMiddleware
```

### 2. Security
```yaml
Requirement: "No SQL string concatenation"
Contract: sql_injection_prevention.yml
Test: Scans for query() with string interpolation
```

### 3. Data Integrity
```yaml
Requirement: "Email addresses must be validated"
Contract: email_validation.yml
Test: Verifies validateEmail() called before sendEmail()
```

### 4. User Journey
```yaml
Journey: "User registration flow"
Contract: journey_registration.yml
Test: End-to-end registration process
```

---

## Getting Help

**Core Docs:**
- LLM-MASTER-PROMPT.md - How LLMs should use Specflow
- SPEC-FORMAT.md - Spec format (if writing manually)
- CONTRACT-SCHEMA.md - YAML contract format
- MID-PROJECT-ADOPTION.md - Existing projects
- USER-JOURNEY-CONTRACTS.md - Journey testing

**Deep Dives (in context/):**
- context/MASTER-ORCHESTRATOR.md - Complete automation
- context/SUBAGENT-CONTRACTS.md - Claude subagent patterns
- context/SPEC-TO-CONTRACT.md - Conversion examples

**Templates (in examples/):**
- examples/contract-example.yml - Real contract example
- examples/test-example.test.ts - Complete test suite

**Tools:**
- ./verify-setup.sh - Verify infrastructure
- CI-INTEGRATION.md - GitHub Actions, GitLab

---

## Success Criteria

You're doing it right when:

1. **Contract exists** - YAML file with clear rules
2. **Test enforces it** - Test scans source code
3. **Intentional violation fails** - Test catches it
4. **Fix makes it pass** - Test verifies fix
5. **CI runs automatically** - Every PR tested

---

## Quick Reference Card

```
┌─────────────────────────────────────────────────────────┐
│ Specflow Quick Reference                                │
├─────────────────────────────────────────────────────────┤
│                                                         │
│ FASTEST WAY: Copy the prompt at the top of this file   │
│              and paste it to your LLM.                  │
│                                                         │
│ Core Loop:                                              │
│   Describe in plain English → LLM generates REQ IDs    │
│   → Contracts created → Tests created → CI blocks      │
│                                                         │
│ File Locations:                                         │
│   docs/contracts/feature_*.yml  = Pattern rules        │
│   docs/contracts/journey_*.yml  = User flow DOD        │
│   src/__tests__/contracts/      = Contract tests       │
│                                                         │
│ Key Commands:                                           │
│   npm test -- contracts   Run contract tests           │
│   npm test -- journeys    Run journey tests            │
│   ./verify-setup.sh       Check setup                  │
│                                                         │
│ The Gate:                                               │
│   Violation = Build fails. End of story.               │
│                                                         │
└─────────────────────────────────────────────────────────┘
```

---

**Ready to start?** Copy the prompt at the top and paste it to your LLM. That's it.
