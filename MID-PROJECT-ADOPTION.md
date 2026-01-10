# Specflow Mid-Project Adoption

> Adding contracts to existing projects without starting over

## The Challenge

You have an existing codebase with:
- ✅ Features that work
- ✅ Code already written
- ✅ Users in production
- ❌ No contracts yet
- ❌ Worried about LLMs breaking things
- ❌ No time for big rewrite

**Question:** Can you adopt contracts mid-project without disruption?

**Answer:** YES. Document what works today → make it a contract → prevent regressions.

---

## The Mid-Project Adoption Strategy

### Core Principle

> "Don't define perfection. Define and protect what currently works."

**Instead of:**
```
❌ "Define ideal architecture" → Rewrite everything
```

**Do this:**
```
✅ "Document current working behavior" → Contract → Prevent breaking it
```

---

## Step-by-Step Mid-Project Adoption

### Step 1: Inventory Current Working Behavior

**Don't think about "should." Think about "is."**

**Inventory template:**
```markdown
# Current Working Behavior Inventory

## What Works Right Now

### Feature: User Authentication
- Current behavior: Session stored in Redis, 7-day expiry
- Entry points: POST /api/auth/login, POST /api/auth/logout
- Critical files: src/auth/session.ts, src/middleware/auth.ts
- Known constraints: Uses Redis key pattern "session:{userId}"

### Feature: Payment Processing
- Current behavior: Stripe integration, webhooks handle async events
- Entry points: POST /api/payments/checkout, webhook at /api/webhooks/stripe
- Critical files: src/payments/stripe.ts
- Known constraints: Must verify webhook signatures

[... continue for all features]
```

**How to create inventory:**
```bash
# 1. List all API endpoints
grep -r "router\.(get|post|put|delete)" src/ | cut -d: -f1 | sort -u

# 2. Identify critical flows
ls src/services/

# 3. Check database interactions
grep -r "db\.query\|prisma\.\|mongoose\." src/ | cut -d: -f1 | sort -u
```

---

### Step 2: Create "Freeze Current State" Contracts

**Template: Current State Contract**

```yaml
# docs/contracts/current_auth_behavior.yml
# Created: 2025-12-02
# Purpose: Document and protect auth behavior that works today

contract_meta:
  id: current_auth_freeze
  version: 1
  created_from: "Current working production behavior (as of 2025-12-02)"
  type: freeze_current_state
  owner: "Engineering Team"

context_summary:
  short_description: >
    This contract freezes the authentication behavior that currently
    works in production. DO NOT CHANGE without explicit user approval.

  what_currently_works:
    - "Login stores session in Redis with 7-day expiry"
    - "Session key pattern: session:{userId}"
    - "Logout clears session from Redis"
    - "Auth middleware checks Redis for valid session"

  why_we_protect_this:
    - "Users depend on this behavior"
    - "Changing Redis key pattern would log everyone out"
    - "This is tested and stable in production"

non_negotiable_rules:
  - id: auth_freeze_001
    title: "Session storage pattern must not change"
    description: >
      Current production behavior stores sessions in Redis
      with key pattern "session:{userId}". This pattern is
      depended on by monitoring, session cleanup jobs, etc.
      DO NOT CHANGE without explicit approval.

    behavior_spec:
      required_patterns:
        - pattern: /session:\$\{userId\}/
          message: "Must use session:{userId} key pattern"

        - pattern: /redis\.setex/
          message: "Must use setex for automatic expiry"

      forbidden_patterns:
        - pattern: /session_\$\{userId\}/
          message: "Different key pattern would break sessions"

        - pattern: /localStorage\.setItem.*session/i
          message: "Sessions are in Redis, not localStorage"

    current_implementation: |
      // src/auth/session.ts (lines 45-52)
      async function createSession(userId: string) {
        const sessionId = generateId()
        await redis.setex(
          `session:${userId}`,
          7 * 24 * 60 * 60, // 7 days
          JSON.stringify({ sessionId, createdAt: Date.now() })
        )
        return sessionId
      }

    allowed_changes:
      - "Refactor internal code (keep behavior same)"
      - "Add logging and monitoring"
      - "Optimize Redis queries"

    disallowed_changes:
      - "Change Redis key pattern"
      - "Change expiry duration without approval"
      - "Replace Redis with different storage"
      - "Move sessions to client-side storage"

  - id: auth_freeze_002
    title: "Auth middleware validation flow must not change"

    behavior_spec:
      what_currently_happens:
        step1: "Middleware extracts session cookie"
        step2: "Looks up session in Redis"
        step3: "If found, attaches req.user"
        step4: "If not found, returns 401"

      forbidden_patterns:
        - pattern: /return\s+401(?!.*redis\.get)/
          message: "Must check Redis before returning 401"

    current_implementation: |
      // src/middleware/auth.ts (lines 12-25)
      async function authMiddleware(req, res, next) {
        const sessionId = req.cookies.sessionId
        if (!sessionId) return res.status(401).json({ error: 'Unauthorized' })

        const session = await redis.get(`session:${userId}`)
        if (!session) return res.status(401).json({ error: 'Session expired' })

        req.user = JSON.parse(session)
        next()
      }

test_requirements:
  required_test_files:
    - path: "src/__tests__/contracts/authFreeze.test.ts"
      purpose: "Ensure auth behavior doesn't regress"

  test_scenarios:
    - scenario: "Create session"
      verifies: "Redis key pattern is session:{userId}"

    - scenario: "Middleware checks Redis"
      verifies: "Auth middleware looks up session in Redis"

compliance_checklist:
  before_modifying_auth_files:
    - question: "Does this change session storage?"
      if_yes: "STOP - Protected by auth_freeze_001"

    - question: "Does this change auth middleware?"
      if_yes: "STOP - Protected by auth_freeze_002"

    - question: "User explicitly approved changes?"
      if_no: "STOP - Need approval"

enforcement:
  for_llms:
    - "This contract documents PRODUCTION BEHAVIOR"
    - "DO NOT MODIFY without user saying: override_contract: current_auth_freeze"
    - "If user requests auth changes, explain current behavior first"
```

---

### Step 3: Create Tests for Current Behavior

**Pattern: Test current reality, not ideal future**

```typescript
// src/__tests__/contracts/authFreeze.test.ts

/**
 * Auth Behavior Freeze Tests
 *
 * These tests verify that the CURRENT working auth behavior
 * remains unchanged. They document how auth works today.
 */

describe('Contract: current_auth_freeze', () => {
  describe('Session Storage Pattern (auth_freeze_001)', () => {
    it('LLM CHECK: session.ts uses Redis key pattern session:{userId}', () => {
      const fs = require('fs')
      const sessionFile = fs.readFileSync('src/auth/session.ts', 'utf-8')

      // Current working pattern
      const hasCorrectPattern = /session:\$\{userId\}/.test(sessionFile)

      if (!hasCorrectPattern) {
        throw new Error(
          `CONTRACT VIOLATION: auth_freeze_001\n` +
          `Session storage pattern changed from current production behavior\n` +
          `Current pattern: session:{userId}\n` +
          `This would log out all users!\n` +
          `See: docs/contracts/current_auth_behavior.yml`
        )
      }
    })

    it('LLM CHECK: session.ts uses setex for automatic expiry', () => {
      const fs = require('fs')
      const sessionFile = fs.readFileSync('src/auth/session.ts', 'utf-8')

      if (!/redis\.setex/.test(sessionFile)) {
        throw new Error(
          `CONTRACT VIOLATION: auth_freeze_001\n` +
          `Session creation no longer uses setex\n` +
          `This could cause sessions to never expire\n` +
          `Current behavior: Uses setex with 7-day expiry`
        )
      }
    })
  })

  describe('Auth Middleware Flow (auth_freeze_002)', () => {
    it('LLM CHECK: middleware checks Redis before returning 401', () => {
      const fs = require('fs')
      const middlewareFile = fs.readFileSync('src/middleware/auth.ts', 'utf-8')

      // Verify flow: extract cookie → check Redis → return 401 if not found
      const hasRedisCheck = /redis\.get.*session/.test(middlewareFile)
      const returns401 = /return.*401|res\.status\(401\)/.test(middlewareFile)

      if (returns401 && !hasRedisCheck) {
        throw new Error(
          `CONTRACT VIOLATION: auth_freeze_002\n` +
          `Auth middleware returns 401 without checking Redis\n` +
          `Current behavior: Must check Redis first\n` +
          `This would break authentication`
        )
      }
    })
  })

  describe('Integration: Current Auth Flow', () => {
    it('Documents current auth flow as test', async () => {
      // This test documents HOW auth works today
      // If this test needs to change, behavior changed

      // Step 1: Create session
      const userId = 'test-user-123'
      const sessionId = await createSession(userId)
      expect(sessionId).toBeDefined()

      // Step 2: Session should be in Redis
      const stored = await redis.get(`session:${userId}`)
      expect(stored).toBeDefined()

      // Step 3: Auth middleware should find it
      const req = { cookies: { sessionId } }
      const res = mockResponse()
      const next = jest.fn()

      await authMiddleware(req, res, next)
      expect(next).toHaveBeenCalled()
      expect(req.user).toBeDefined()

      // Step 4: After 7 days, should expire
      // (Use Redis TTL to verify)
      const ttl = await redis.ttl(`session:${userId}`)
      expect(ttl).toBeGreaterThan(0)
      expect(ttl).toBeLessThanOrEqual(7 * 24 * 60 * 60)
    })
  })
})
```

---

### Step 4: Incremental Rollout

**Phase 1: Critical Paths Only**

Start with the most important features:
- Authentication
- Payment processing
- Data integrity operations

**Create contracts for:**
1. ✅ What must NEVER break
2. ✅ What users depend on daily
3. ✅ What causes support tickets if broken

**Skip (for now):**
- Internal utilities
- Admin-only features
- Experimental features

---

**Phase 2: Expand Coverage**

After first contracts are stable:
```bash
# Week 1-2: Critical paths (auth, payments, core features)
# Week 3-4: Secondary features (user profiles, settings)
# Week 5-6: Admin features and internal tools
# Week 7+: Nice-to-have features
```

**Metrics:**
- Number of contracts created
- % of critical files protected
- Number of violations caught

---

### Step 5: Gradual Improvement

**Contract evolution:**

```yaml
# Version 1: Freeze current state
contract_meta:
  id: auth_behavior
  version: 1
  type: freeze_current_state

non_negotiable_rules:
  - id: auth_001
    title: "Sessions work as they do today"
    description: "Don't break current auth"
```

↓

```yaml
# Version 2: Add specific improvements
contract_meta:
  version: 2
  type: improved_state

non_negotiable_rules:
  - id: auth_001
    title: "Sessions use Redis with secure patterns"
    description: "Current: Redis sessions. Also: must be httpOnly"

  - id: auth_002  # NEW
    title: "Session tokens must be cryptographically random"
```

---

## Examples of Mid-Project Contracts

### Example 1: E-Commerce Checkout (Already Works)

```yaml
# docs/contracts/freeze_checkout.yml

contract_meta:
  id: freeze_checkout_flow
  created_from: "Current production checkout (works, don't break it)"

non_negotiable_rules:
  - id: checkout_001
    title: "Checkout flow: cart → payment → confirmation"

    what_currently_works:
      step1: "User adds items to cart"
      step2: "Cart persists across page reloads"
      step3: "Checkout validates inventory"
      step4: "Payment processed via Stripe"
      step5: "Order created in database"
      step6: "Confirmation email sent"

    behavior_spec:
      # Don't change this flow order
      required_sequence:
        - pattern: /validateInventory\(/
          must_appear_before: /processPayment\(/

        - pattern: /processPayment\(/
          must_appear_before: /createOrder\(/

      # Don't skip these steps
      required_patterns:
        - pattern: /validateInventory/
          message: "Must validate inventory before charging"

        - pattern: /createOrder.*transactionId/
          message: "Order must reference payment transaction"

  - id: checkout_002
    title: "Cart data structure must not change"

    current_structure: |
      {
        items: [{ productId, quantity, priceAtAdd }],
        subtotal: number,
        tax: number,
        total: number
      }

    forbidden_patterns:
      - pattern: /cart\.products/  # Currently uses "items" not "products"
        message: "Cart uses 'items' key, not 'products'"
```

**Key insight:** You don't need perfect architecture. You need "don't break what works."

---

### Example 2: Database Queries (Don't Introduce SQL Injection)

```yaml
# docs/contracts/freeze_db_patterns.yml

non_negotiable_rules:
  - id: db_safety_001
    title: "Database queries currently use parameterized statements"

    current_safe_patterns:
      - "All queries use $1, $2 placeholders (PostgreSQL)"
      - "No string concatenation in queries"
      - "ORM used for complex queries (Prisma)"

    behavior_spec:
      forbidden_patterns:
        - pattern: /query\(['"`].*\$\{/
          message: "String interpolation in queries (current code doesn't do this)"

        - pattern: /query\(['"`].*\+/
          message: "String concatenation in queries (current code doesn't do this)"

      required_patterns:
        - pattern: /query\(['"`].*\$1/
          message: "Must use parameterized queries like existing code"
```

---

## Migration Pattern: Bad Code → Contract

**Scenario:** You have legacy code with known issues.

**Option 1: Freeze bad behavior (short-term)**
```yaml
non_negotiable_rules:
  - id: legacy_freeze_001
    title: "Email validation currently uses regex (not ideal but works)"

    known_issues:
      - "Regex doesn't validate all edge cases"
      - "Would prefer email-validator library"

    behavior_spec:
      required_patterns:
        - pattern: /validateEmail.*regex/
          message: "Keep current regex until we can test replacement"

    improvement_plan:
      - "Phase 1: Freeze current behavior"
      - "Phase 2: Test email-validator library"
      - "Phase 3: Update contract to require email-validator"
```

**Option 2: Allow specific improvements**
```yaml
soft_rules:
  - id: email_improvement_010
    title: "Email validation can be improved if tested"

    current_behavior: "Uses regex /^[^@]+@[^@]+$/"

    llm_may_replace_if:
      - "Uses well-tested library (email-validator, validator.js)"
      - "Adds tests for edge cases"
      - "User approves change"
```

---

## Common Mid-Project Scenarios

### Scenario 1: "We use localStorage but know it's not ideal"

**Contract approach:**
```yaml
# Freeze current behavior
non_negotiable_rules:
  - id: storage_freeze_001
    title: "Auth tokens currently in localStorage (not ideal but works)"

    current_reality:
      - "Tokens stored in localStorage.authToken"
      - "Users stay logged in across browser restarts"
      - "Known limitation: Vulnerable to XSS"

    behavior_spec:
      required_patterns:
        - pattern: /localStorage\.getItem\(['"]authToken/
          message: "Currently uses localStorage (don't break it yet)"

soft_rules:
  - id: storage_improvement_010
    title: "Should migrate to httpOnly cookies"

    migration_plan:
      phase1: "Add cookie-based auth alongside localStorage"
      phase2: "Test cookie auth with beta users"
      phase3: "Migrate all users to cookies"
      phase4: "Remove localStorage code"
      phase5: "Update contract to require cookies"
```

---

### Scenario 2: "Inconsistent patterns across codebase"

**Contract approach:**
```yaml
non_negotiable_rules:
  - id: consistency_freeze_001
    title: "API error handling is inconsistent (but don't break existing behavior)"

    current_inconsistency:
      pattern1: "Some routes return { error: 'message' }"
      pattern2: "Some routes return { message: 'error' }"
      pattern3: "Some routes just return text"

    behavior_spec:
      required_patterns:
        - pattern: /res\.(json|send|status)\(/
          message: "Keep current response format per endpoint"

      forbidden_patterns:
        - pattern: /throw new Error(?!.*catch)/
          message: "Unhandled errors crash server"

    improvement_plan:
      - "Phase 1: Contract freezes current behavior"
      - "Phase 2: Add error handler that normalizes responses"
      - "Phase 3: Migrate routes one by one"
      - "Phase 4: Contract requires consistent format"
```

---

## Advantages of Mid-Project Adoption

✅ **No big rewrite required**
- Start with 1-2 critical contracts
- Add more gradually
- Working code stays working

✅ **Immediate value**
- Prevents regressions from day 1
- Catches LLM mistakes before production
- Documents current behavior

✅ **Low risk**
- Tests verify current behavior
- Not enforcing ideal architecture
- Can evolve contracts over time

✅ **Team alignment**
- Contracts document "how things work"
- New team members read contracts
- Debates about architecture explicit

---

## Anti-Patterns to Avoid

### ❌ Anti-Pattern 1: "Document ideal, not reality"

**Wrong:**
```yaml
# This is what auth SHOULD do
required_patterns:
  - pattern: /httpOnly.*cookies/
```

**Right:**
```yaml
# This is what auth DOES do
required_patterns:
  - pattern: /localStorage\.getItem\(['"]authToken/
    message: "Currently uses localStorage (as of 2025-12-02)"
```

---

### ❌ Anti-Pattern 2: "Perfect contracts before any code"

**Wrong approach:**
```
Week 1-2: Design perfect contract system
Week 3-4: Rewrite all code to match contracts
Week 5-6: Test everything
Week 7: Deploy
```

**Right approach:**
```
Day 1: Create 1 contract for most critical feature
Day 2: Add tests
Day 3: Verify tests catch violations
Day 4: Add another contract
[Continue incrementally]
```

---

### ❌ Anti-Pattern 3: "Wait until codebase is clean"

**You'll never start.** Adopt contracts with messy code.

```yaml
# Totally fine contract for messy code
non_negotiable_rules:
  - id: messy_but_works_001
    title: "Don't break the spaghetti code in legacy_module.ts"

    known_issues:
      - "This code is terrible"
      - "But it works and users depend on it"

    behavior_spec:
      forbidden_patterns:
        - pattern: /delete.*userSessions/
          message: "Don't touch session cleanup (it's fragile but works)"
```

---

## Success Metrics for Mid-Project Adoption

**Month 1:**
- ✅ 3-5 contracts for critical features
- ✅ Tests catch at least 1 intentional violation
- ✅ Team understands contract system

**Month 3:**
- ✅ 10-15 contracts covering main workflows
- ✅ Caught 2-3 real violations (LLM mistakes)
- ✅ No production incidents from violations

**Month 6:**
- ✅ 20+ contracts covering most features
- ✅ New features include contracts from day 1
- ✅ Contract violations rare (culture shift)

---

## Quick Start: Your First Mid-Project Contract

```bash
# 1. Pick your most critical feature
# Example: User authentication

# 2. Document how it works RIGHT NOW
cat > current_auth_behavior.md <<'EOF'
## How Auth Works Today

1. User submits email/password
2. Server hashes password with bcrypt
3. If match, creates session in Redis
4. Session key: session:{userId}
5. Cookie: sessionId (httpOnly, secure)
6. Middleware checks Redis on each request
EOF

# 3. Convert to contract
cp docs/contracts/contract_template.yml docs/contracts/freeze_current_auth.yml

# 4. Fill in patterns based on current behavior
# (Use grep to find actual patterns in your code)

# 5. Create test
cp src/__tests__/contracts/contractTemplate.test.ts src/__tests__/contracts/freezeCurrentAuth.test.ts

# 6. Run test - should PASS (tests current behavior)
npm test -- freezeCurrentAuth

# 7. Intentionally violate contract - test should FAIL
# (Change Redis key pattern in code)

# 8. Revert violation - test passes again

# 9. Done! First contract protects critical feature
```

---

## Summary: Mid-Project Adoption Principles

1. **Document reality, not ideals** - Contract what works today
2. **Start small** - 1-2 critical features first
3. **Freeze, don't rewrite** - Protect current behavior
4. **Test current state** - Tests verify existing behavior
5. **Improve gradually** - Evolve contracts over time
6. **No shame in messy contracts** - "Works but ugly" is fine

**Result:** You get contract protection TODAY without disrupting working systems.

---

**Next steps:**
- Create inventory of current working behavior
- Pick 1-2 critical features to protect first
- Create "freeze current state" contracts
- Write tests that verify existing behavior
- Expand coverage incrementally

---

**Related Specflow docs:**
- `SPEC-FORMAT.md` - How to write specs with REQ IDs
- `CONTRACT-SCHEMA.md` - YAML contract format reference
- `USER-JOURNEY-CONTRACTS.md` - Journey testing for E2E flows
- `demo/` - Working example showing contracts catching violations
