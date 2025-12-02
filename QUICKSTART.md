# Contractee Quick Start

## 🚀 Get Started in 3 Minutes

Choose your path:

---

## Path 1: Complete Automation (Recommended)

**For: New projects with a product spec**

### Step 1: Give Claude Your Spec
```
Execute MASTER-ORCHESTRATOR.md with this spec:

[Paste your entire product specification here]
```

### Step 2: Wait for Completion
Claude will:
- ✅ Generate all contracts from your spec
- ✅ Create all verification tests
- ✅ Implement features satisfying contracts
- ✅ Verify everything passes
- ✅ Report when ready to deploy

**Time:** 30-60 minutes for medium project

---

## Path 2: Add to Existing Project

**For: Existing codebases**

### Step 1: Read the Guide
```
Read MID-PROJECT-ADOPTION.md
```

### Step 2: Document Current Behavior
Pick your most critical feature and document how it works today:
```markdown
## Current Working Behavior

Feature: User Authentication
- Sessions stored in Redis
- Key pattern: session:{userId}
- 7-day expiry
- Auth middleware on all /api/* routes
```

### Step 3: Create "Freeze" Contract
```
Use contract-generator subagent to create a contract
documenting current auth behavior from above
```

### Step 4: Generate Tests
```
Use test-generator subagent to create tests for
the auth contract
```

### Step 5: Verify
```bash
npm test -- contracts
```

**Time:** 15 minutes per feature

---

## Path 3: Using Subagents (Advanced)

**For: Maximum efficiency with Claude Code**

### Step 1: Install Subagents
```bash
mkdir -p .claude/agents
# Copy the 4 subagent files from SUBAGENT-CONTRACTS.md
```

### Step 2: Use Contract Orchestrator
```
Use contract-orchestrator subagent with this spec:
[paste spec]
```

The orchestrator spawns specialized subagents for each phase:
- contract-generator (clean context)
- test-generator (clean context)
- contract-verifier (clean context)

**Time:** 45-90 minutes, more efficient context usage

---

## Path 4: Manual Setup

**For: Learning or custom workflows**

### Step 1: Set Up Infrastructure
```
Read META-INSTRUCTION.md and execute sequentially
```

### Step 2: Create Your First Contract
```bash
cp contract-example.yml docs/contracts/my_first_contract.yml
# Edit to match your constraint
```

### Step 3: Create Tests
```bash
cp test-example.test.ts src/__tests__/contracts/myFirstContract.test.ts
# Edit patterns to match your contract
```

### Step 4: Verify
```bash
npm test -- myFirstContract
```

**Time:** 1-2 hours for initial setup

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

**Documentation:**
- MASTER-ORCHESTRATOR.md - Complete automation
- META-INSTRUCTION.md - Step-by-step setup
- SPEC-TO-CONTRACT.md - Spec conversion guide
- USER-JOURNEY-CONTRACTS.md - Journey testing
- MID-PROJECT-ADOPTION.md - Existing projects
- SUBAGENT-CONTRACTS.md - Subagent implementation

**Templates:**
- contract-example.yml - Real contract example
- test-example.test.ts - Complete test suite

**Tools:**
- verify-setup.sh - Verify infrastructure
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
│ Contractee Quick Reference                              │
├─────────────────────────────────────────────────────────┤
│ New Project:        MASTER-ORCHESTRATOR.md              │
│ Existing Project:   MID-PROJECT-ADOPTION.md             │
│ With Subagents:     SUBAGENT-CONTRACTS.md               │
│ Manual Setup:       META-INSTRUCTION.md                 │
│                                                          │
│ Spec → Contract:    SPEC-TO-CONTRACT.md                 │
│ Test Journeys:      USER-JOURNEY-CONTRACTS.md           │
│ CI/CD Setup:        CI-INTEGRATION.md                   │
│                                                          │
│ Templates:          contract-example.yml                │
│                     test-example.test.ts                │
│                                                          │
│ Verify Setup:       ./verify-setup.sh                   │
└─────────────────────────────────────────────────────────┘
```

---

**Ready to start?** Pick Path 1 (automation) or Path 2 (existing project) and go! 🚀
