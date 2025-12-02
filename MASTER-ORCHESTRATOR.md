# MASTER ORCHESTRATOR: Spec → Contracts → Implementation

## Purpose

This is a **complete, executable orchestration prompt** that takes a product spec as input and produces a fully-implemented, contract-verified application as output.

**Input:** Product specification (markdown, user stories, requirements doc)

**Output:**
- ✅ Architectural contracts (YAML)
- ✅ Contract verification tests
- ✅ Implementation todos
- ✅ Fully implemented features
- ✅ Infrastructure setup
- ✅ All contracts verified

---

## HOW TO USE THIS PROMPT

### For Product Managers:

```
Give this entire file to Claude, along with your spec:

"Execute MASTER-ORCHESTRATOR.md with this spec:
[paste your spec here]"
```

Claude will:
1. Generate contracts from your spec
2. Create implementation plan
3. Build the application
4. Verify all contracts are met
5. Report completion

---

### For LLMs Reading This:

**🚨 CRITICAL: READ THIS ENTIRE FILE BEFORE STARTING**

This is a **sequential, non-skippable orchestration**. You MUST:
- Execute every phase in order
- Complete all checkpoints before proceeding
- Create ALL artifacts (contracts, tests, code, todos)
- Verify all contracts pass before reporting completion

**DO NOT:**
- ❌ Skip phases
- ❌ Assume anything is done
- ❌ Report completion without verification
- ❌ Implement before contracts exist

---

## PHASE 1: Intake & Analysis

### Objective
Parse the input spec and identify all enforceable requirements.

### Actions

**1.1: Load the specification**
```
Input provided by user: [SPEC CONTENT]

If spec is a file path:
  Read the file completely
  Store full content

If spec is inline text:
  Store full content

HALT if no spec provided.
```

**1.2: Extract enforceable requirements**

Parse the spec for:

**MUST requirements** (non-negotiable):
- Keywords: MUST, SHALL, REQUIRED, NEVER, ALWAYS
- Pattern: "All [X] must [Y]"
- Pattern: "Never [X]"
- Pattern: "System shall [X]"

**SHOULD requirements** (soft rules):
- Keywords: SHOULD, RECOMMENDED, SUGGESTED
- Pattern: "[X] should [Y]"
- Pattern: "Preferably [X]"

**MAY requirements** (optional, ignore):
- Keywords: MAY, OPTIONAL, CAN
- Pattern: "User may [X]"

**Output format:**
```markdown
## Extracted Requirements

### MUST (Non-Negotiable)
1. [Requirement 1] - Source: [section/line of spec]
2. [Requirement 2] - Source: [section/line]
...

### SHOULD (Soft Rules)
1. [Requirement 1] - Source: [section/line]
...

### MAY (Optional, will not enforce)
1. [Feature 1]
...
```

**✅ Checkpoint 1.2:** All MUST/SHOULD requirements extracted and categorized.

---

**1.3: Identify critical paths (user journeys)**

Extract from spec:
- User flows: "User does X → sees Y → can do Z"
- Critical workflows: "Login → Dashboard → Create Item"
- Entry points: API endpoints, UI pages, webhooks

**Output format:**
```markdown
## Critical User Journeys

### Journey 1: [Name]
**User type:** [guest/authenticated/admin]
**Steps:**
1. [Action]
2. [Action]
3. [Expected outcome]

### Journey 2: [Name]
...
```

**✅ Checkpoint 1.3:** All critical journeys identified.

---

**1.4: Technology stack detection**

Parse spec for mentioned technologies:
- Language: Node.js, Python, Java, Go, etc.
- Framework: Express, Django, Spring Boot, etc.
- Database: PostgreSQL, MongoDB, Redis, etc.
- Infrastructure: Docker, AWS, Vercel, etc.

If not specified in spec:
```
ASK USER: "Spec doesn't specify tech stack. What should I use?"
Options:
- Node.js + Express + PostgreSQL
- Python + FastAPI + PostgreSQL
- [Other]
```

**✅ Checkpoint 1.4:** Tech stack confirmed.

---

**1.5: Generate project structure**

Based on tech stack, define:
```
project/
├── docs/
│   ├── spec.md (user's spec)
│   └── contracts/
├── src/ (or app/, lib/)
│   ├── services/
│   ├── routes/ (or controllers/)
│   ├── models/
│   └── utils/
├── tests/ (or __tests__/, src/__tests__/)
│   └── contracts/
├── scripts/
└── [config files]
```

**✅ Checkpoint 1.5:** Project structure defined.

---

## PHASE 2: Contract Generation

### Objective
Convert every MUST requirement into an enforceable YAML contract.

### Actions

**2.1: Create master contracts list**

For each MUST requirement:
```
Contract ID: [feature]_[number]
Requirement: [Original text from spec]
Type: [security|performance|data_integrity|workflow|other]
```

**Example:**
```
Contract ID: auth_001
Requirement: "All API endpoints must require authentication"
Type: security

Contract ID: payment_002
Requirement: "Payment webhooks must verify signatures"
Type: security
```

**✅ Checkpoint 2.1:** All MUST requirements mapped to contract IDs.

---

**2.2: Generate contract YAML files**

For EACH contract, create a file:

```bash
# File: docs/contracts/[contract_id].yml

# Use SPEC-TO-CONTRACT.md workflow
# Input: Original requirement text
# Output: Complete YAML contract with:
#   - contract_meta (id, version, created_from)
#   - non_negotiable_rules (with patterns)
#   - compliance_checklist
#   - test_requirements
```

**DO THIS SEQUENTIALLY. DO NOT SKIP CONTRACTS.**

For each contract:
1. Copy `docs/contracts/contract_template.yml`
2. Fill in metadata
3. Convert requirement → forbidden/required patterns
4. Add example_violation and example_compliant code
5. Create compliance checklist
6. Save file

**Example for "All API endpoints must require authentication":**

```yaml
# docs/contracts/auth_001_api_endpoints.yml
contract_meta:
  id: auth_001_api_endpoints
  version: 1
  created_from: "[Spec name], Section: Authentication Requirements"
  owner: "Generated from spec"

non_negotiable_rules:
  - id: auth_001
    title: "API endpoints must require authentication middleware"

    behavior_spec:
      forbidden_patterns:
        - pattern: /router\.(get|post|put|delete)\(['"]\/api\/(?!health|public).*['"]\s*,\s*(?!authMiddleware)/
          message: "API route missing authMiddleware"

      required_patterns:
        - pattern: /authMiddleware/
          message: "Must import and use authMiddleware"

      example_violation: |
        // ❌ WRONG
        router.post('/api/users', async (req, res) => {
          await User.create(req.body)
        })

      example_compliant: |
        // ✅ CORRECT
        router.post('/api/users', authMiddleware, async (req, res) => {
          await User.create(req.body)
        })

compliance_checklist:
  before_modifying_file:
    - question: "Does this add a new API route?"
      if_yes: "Add authMiddleware as first parameter"

test_requirements:
  required_test_files:
    - path: "tests/contracts/auth001.test.ts"
```

**✅ Checkpoint 2.2:** All contracts generated and saved.

---

**2.3: Create contract index**

```yaml
# docs/contracts/CONTRACT_INDEX.yml
contracts:
  - id: auth_001
    file: auth_001_api_endpoints.yml
    status: active
    requirement: "All API endpoints must require authentication"

  - id: payment_002
    file: payment_002_webhook_verification.yml
    status: active
    requirement: "Payment webhooks must verify signatures"

  # ... all contracts
```

**✅ Checkpoint 2.3:** Contract index complete.

---

**2.4: Generate user journey contracts**

For each critical journey from Phase 1.3:

```bash
# File: docs/contracts/journey_[name].yml

# Use USER-JOURNEY-CONTRACTS.md template
# Convert: Journey steps → Required elements + Expected behavior
```

**Example:**
```yaml
# docs/contracts/journey_user_registration.yml
journey_definition:
  name: "User Registration"
  steps:
    - step_number: 1
      step_name: "Land on registration page"
      required_elements:
        - selector: "input[name='email']"
        - selector: "input[name='password']"
        - selector: "button[type='submit']"

    - step_number: 2
      step_name: "Submit registration form"
      expected_behavior:
        - type: "api_call"
          result: "POST /api/auth/register"
        - type: "email_sent"
          result: "Confirmation email to user"

    - step_number: 3
      step_name: "Confirm email"
      expected_behavior:
        - type: "navigation"
          result: "/dashboard"
```

**✅ Checkpoint 2.4:** All journey contracts created.

---

## PHASE 3: Test Generation

### Objective
Generate contract verification tests for every contract.

### Actions

**3.1: Create test files**

For EACH contract, create a test file:

```bash
# File: tests/contracts/[contract_id].test.ts

# Use templates/test-example.test.ts as template
# Generate tests that:
#   1. Scan source files for forbidden patterns
#   2. Verify required patterns exist
#   3. Check compliance checklist
```

**Example:**
```typescript
// tests/contracts/auth001.test.ts

describe('Contract: auth_001_api_endpoints', () => {
  it('LLM CHECK: all API routes have authMiddleware', () => {
    const fs = require('fs')
    const glob = require('glob')

    const routeFiles = glob.sync('src/routes/**/*.{ts,js}', {
      ignore: ['**/health.ts', '**/public/**']
    })

    const violations = []

    for (const file of routeFiles) {
      const content = fs.readFileSync(file, 'utf-8')

      // Check for routes without authMiddleware
      const routePattern = /router\.(get|post|put|delete)\(['"]\/api\//g
      let match

      while ((match = routePattern.exec(content)) !== null) {
        const lineStart = match.index
        const lineEnd = content.indexOf('\n', lineStart)
        const line = content.substring(lineStart, lineEnd)

        if (!line.includes('authMiddleware')) {
          violations.push({
            file,
            line: content.substring(0, lineStart).split('\n').length,
            code: line.trim()
          })
        }
      }
    }

    if (violations.length > 0) {
      throw new Error(
        `CONTRACT VIOLATION: auth_001\n` +
        `Found ${violations.length} route(s) without authMiddleware:\n` +
        violations.map(v => `  ${v.file}:${v.line}\n    ${v.code}`).join('\n')
      )
    }
  })
})
```

**✅ Checkpoint 3.1:** All contract tests created.

---

**3.2: Create journey tests**

For each user journey contract:

```typescript
// tests/contracts/journey_registration.test.ts

describe('Journey: User Registration', () => {
  it('follows complete registration flow', async () => {
    // Load journey contract
    const journey = require('../../docs/contracts/journey_user_registration.yml')

    // Step 1: Registration page
    await page.goto('/register')
    await expect(page.locator('input[name="email"]')).toBeVisible()
    await expect(page.locator('input[name="password"]')).toBeVisible()

    // Step 2: Submit form
    await page.fill('input[name="email"]', 'test@example.com')
    await page.fill('input[name="password"]', 'SecurePass123!')
    await page.click('button[type="submit"]')

    // Step 3: Verify email sent (mock or check outbox)
    expect(emailService.lastSent).toMatchObject({
      to: 'test@example.com',
      subject: expect.stringContaining('confirm'),
    })

    // Step 4: Confirm email and land on dashboard
    const confirmLink = extractLinkFromEmail(emailService.lastSent)
    await page.goto(confirmLink)
    expect(page.url()).toContain('/dashboard')
  })
})
```

**✅ Checkpoint 3.2:** All journey tests created.

---

**3.3: Set up test infrastructure**

If not already present:

```bash
# Install test dependencies
npm install --save-dev jest @types/jest
# or
npm install --save-dev vitest

# Create test config
cat > jest.config.js <<'EOF'
module.exports = {
  testMatch: ['**/__tests__/**/*.test.ts', '**/tests/**/*.test.ts'],
  transform: {
    '^.+\\.tsx?$': 'ts-jest'
  },
}
EOF

# Add to package.json
"scripts": {
  "test": "jest",
  "test:contracts": "jest tests/contracts"
}
```

**✅ Checkpoint 3.3:** Test infrastructure ready.

---

## PHASE 4: Implementation Planning

### Objective
Create comprehensive todo list for implementing features that satisfy all contracts.

### Actions

**4.1: Generate implementation todos**

Create todos that cover:
1. Infrastructure setup
2. Core feature implementation (satisfying contracts)
3. Contract verification
4. Edge cases and error handling
5. Documentation

**Use TodoWrite to create ALL todos in ONE call:**

```javascript
TodoWrite({
  todos: [
    // Infrastructure (priority: critical)
    { content: "Set up project structure", status: "pending", priority: "critical" },
    { content: "Install dependencies", status: "pending", priority: "critical" },
    { content: "Configure database connection", status: "pending", priority: "critical" },
    { content: "Set up authentication middleware", status: "pending", priority: "critical" },

    // Feature implementation (priority: high)
    { content: "Implement user registration (satisfies auth_001)", status: "pending", priority: "high" },
    { content: "Implement API authentication (satisfies auth_001)", status: "pending", priority: "high" },
    { content: "Implement payment webhook verification (satisfies payment_002)", status: "pending", priority: "high" },

    // Contract verification (priority: high)
    { content: "Run contract tests: npm test -- tests/contracts/", status: "pending", priority: "high" },
    { content: "Fix any contract violations found", status: "pending", priority: "high" },

    // Edge cases (priority: medium)
    { content: "Handle auth failures gracefully", status: "pending", priority: "medium" },
    { content: "Add rate limiting to API endpoints", status: "pending", priority: "medium" },

    // Documentation (priority: low)
    { content: "Document API endpoints", status: "pending", priority: "low" },
    { content: "Create deployment guide", status: "pending", priority: "low" },
  ]
})
```

**✅ Checkpoint 4.1:** All implementation todos created.

---

**4.2: Dependency mapping**

For each todo, identify dependencies:

```markdown
## Implementation Order

### Phase A: Infrastructure (no dependencies)
1. Project structure
2. Dependencies
3. Database setup

### Phase B: Core Auth (depends on A)
4. Auth middleware
5. User registration
6. Login/logout

### Phase C: Features (depends on B)
7. Protected API endpoints
8. Payment webhooks
...
```

**✅ Checkpoint 4.2:** Dependencies mapped, order determined.

---

## PHASE 5: Implementation

### Objective
Implement all features, ensuring contracts are satisfied.

### Actions

**5.1: Infrastructure setup**

```bash
# Create project structure (from Phase 1.5)
mkdir -p src/{services,routes,models,utils}
mkdir -p tests/contracts
mkdir -p docs/contracts

# Install dependencies
npm init -y
npm install express bcrypt jsonwebtoken redis stripe
npm install --save-dev jest @types/jest typescript @types/node

# Create base files
touch src/index.ts
touch src/routes/auth.ts
touch src/middleware/authMiddleware.ts
```

**✅ Checkpoint 5.1:** Infrastructure ready.

---

**5.2: Implement features (contract-first)**

For EACH feature:

**Pattern:**
1. Read relevant contract(s)
2. Implement code satisfying contract requirements
3. Run contract tests
4. Fix violations
5. Mark todo complete

**Example: Implement authentication**

```bash
# 1. Read contract
cat docs/contracts/auth_001_api_endpoints.yml

# 2. Implement
cat > src/middleware/authMiddleware.ts <<'EOF'
import { Request, Response, NextFunction } from 'express'
import jwt from 'jsonwebtoken'

export async function authMiddleware(req: Request, res: Response, next: NextFunction) {
  const token = req.headers.authorization?.split(' ')[1]

  if (!token) {
    return res.status(401).json({ error: 'Unauthorized' })
  }

  try {
    const decoded = jwt.verify(token, process.env.JWT_SECRET!)
    req.user = decoded
    next()
  } catch (error) {
    return res.status(401).json({ error: 'Invalid token' })
  }
}
EOF

# 3. Use authMiddleware in routes (satisfies contract)
cat > src/routes/users.ts <<'EOF'
import express from 'express'
import { authMiddleware } from '../middleware/authMiddleware'

const router = express.Router()

// ✅ Contract satisfied: authMiddleware present
router.get('/api/users', authMiddleware, async (req, res) => {
  // Implementation
})

router.post('/api/users', authMiddleware, async (req, res) => {
  // Implementation
})

export default router
EOF

# 4. Run contract test
npm test -- tests/contracts/auth001.test.ts

# Expected: ✅ PASS

# 5. Update todo
TodoWrite([
  { content: "Implement API authentication (satisfies auth_001)", status: "completed" }
])
```

**DO THIS FOR EVERY TODO.**

**✅ Checkpoint 5.2:** All features implemented and contract tests passing.

---

**5.3: Implement user journeys**

For each journey contract:

1. Read journey contract
2. Implement required elements
3. Verify expected behavior
4. Run journey test
5. Fix failures

**Example: User registration journey**

```typescript
// src/routes/auth.ts
router.post('/api/auth/register', async (req, res) => {
  // Satisfies journey step 2: API call
  const { email, password } = req.body

  const hashedPassword = await bcrypt.hash(password, 10)
  const user = await User.create({ email, password: hashedPassword })

  // Satisfies journey step 2: Email sent
  await sendEmail({
    to: email,
    subject: 'Confirm your email',
    body: `Click here to confirm: ${confirmLink}`
  })

  res.json({ message: 'Registration successful. Check email.' })
})
```

**✅ Checkpoint 5.3:** All journeys implemented and tested.

---

## PHASE 6: Verification & Validation

### Objective
Ensure ALL contracts pass, no violations exist.

### Actions

**6.1: Run all contract tests**

```bash
# Run all contract tests
npm test -- tests/contracts/

# Expected output: All tests passing

# If failures:
#   1. Read failure message
#   2. Identify violated contract
#   3. Fix code to satisfy contract
#   4. Rerun tests
#   5. Repeat until all pass
```

**HALT if ANY contract test fails.**

**✅ Checkpoint 6.1:** All contract tests passing.

---

**6.2: Run contract checker script**

```bash
node scripts/check-contracts.js

# Expected: ✅ All protected files pass

# If violations:
#   Same fix process as 6.1
```

**✅ Checkpoint 6.2:** Checker script reports no violations.

---

**6.3: Manual contract review**

For EACH contract:

```markdown
## Contract Review Checklist

Contract: [ID]

✅ Contract YAML exists and is valid
✅ Test file exists
✅ Test passes
✅ Compliance checklist addressed
✅ Code matches example_compliant
✅ No forbidden patterns in code
✅ Required patterns present
```

**✅ Checkpoint 6.3:** All contracts manually reviewed.

---

**6.4: Journey verification**

For each journey:

```bash
# Run journey test
npm test -- tests/contracts/journey_[name].test.ts

# If using Playwright:
npx playwright test tests/contracts/journey_[name].test.ts

# Expected: Full journey completes successfully
```

**✅ Checkpoint 6.4:** All journeys verified.

---

## PHASE 7: Infrastructure & Deployment Verification

### Objective
Ensure non-functional requirements are met (not covered by feature contracts).

### Actions

**7.1: Environment setup**

Check that:
```bash
# .env file exists with required variables
✅ DATABASE_URL set
✅ JWT_SECRET set
✅ API keys set (if needed)

# .env.example exists (for documentation)
✅ Lists all required env vars
```

**✅ Checkpoint 7.1:** Environment configured.

---

**7.2: Database setup**

```bash
# Database migrations (if applicable)
npm run migrate

# Seed data (if needed for testing)
npm run seed

# Verify connection
node -e "require('./src/db').connect().then(() => console.log('✅ DB connected'))"
```

**✅ Checkpoint 7.2:** Database ready.

---

**7.3: API health check**

```bash
# Start server
npm run dev &

# Check health endpoint
curl http://localhost:3000/health

# Expected: { "status": "ok" }
```

**✅ Checkpoint 7.3:** Server runs, health check passes.

---

**7.4: CI/CD integration**

```bash
# Create GitHub Actions workflow (if applicable)
cat > .github/workflows/ci.yml <<'EOF'
name: CI

on: [push, pull_request]

jobs:
  test:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v3
      - uses: actions/setup-node@v3
      - run: npm ci
      - run: npm test
      - name: Verify contracts
        run: npm test -- tests/contracts/
EOF

# Commit workflow
git add .github/workflows/ci.yml
git commit -m "Add CI workflow with contract verification"
```

**✅ Checkpoint 7.4:** CI/CD configured.

---

## PHASE 8: Documentation

### Objective
Generate complete documentation.

### Actions

**8.1: Generate API documentation**

```bash
# Create API.md
cat > docs/API.md <<'EOF'
# API Documentation

## Authentication

All endpoints (except /health and /public/*) require authentication.

### Headers
```
Authorization: Bearer <jwt_token>
```

## Endpoints

### POST /api/auth/register
Register new user.

Request:
{
  "email": "user@example.com",
  "password": "SecurePass123!"
}

Response:
{
  "message": "Registration successful"
}

[... document all endpoints ...]
EOF
```

**✅ Checkpoint 8.1:** API documented.

---

**8.2: Contract summary**

```bash
# Generate CONTRACT_SUMMARY.md
cat > docs/CONTRACT_SUMMARY.md <<'EOF'
# Contract Summary

This project is protected by [N] architectural contracts.

## Active Contracts

### auth_001: API Authentication
**Rule:** All API endpoints must use authMiddleware
**Test:** tests/contracts/auth001.test.ts
**Status:** ✅ Passing

### payment_002: Webhook Verification
**Rule:** Payment webhooks must verify signatures
**Test:** tests/contracts/payment002.test.ts
**Status:** ✅ Passing

[... list all contracts ...]
EOF
```

**✅ Checkpoint 8.2:** Contracts documented.

---

**8.3: Setup instructions**

```bash
cat > README.md <<'EOF'
# [Project Name]

## Quick Start

```bash
# 1. Install dependencies
npm install

# 2. Set up environment
cp .env.example .env
# Edit .env with your values

# 3. Set up database
npm run migrate

# 4. Run tests (including contracts)
npm test

# 5. Start server
npm run dev
```

## Architectural Contracts

This project uses architectural contracts to ensure LLMs and developers
respect critical requirements.

See: docs/CONTRACT_SUMMARY.md

To verify contracts:
```bash
npm test -- tests/contracts/
node scripts/check-contracts.js
```

## Documentation

- API Docs: docs/API.md
- Contracts: docs/contracts/
- Spec: docs/spec.md
EOF
```

**✅ Checkpoint 8.3:** Setup documented.

---

## PHASE 9: Final Report

### Objective
Generate completion report for user.

### Output

```markdown
# ✅ IMPLEMENTATION COMPLETE

## Summary

**Input:** [Spec name or description]
**Output:** Fully implemented application with contract verification

## Generated Artifacts

### Contracts ([N] total)
- docs/contracts/auth_001_api_endpoints.yml
- docs/contracts/payment_002_webhook_verification.yml
- [... all contracts ...]

### Tests ([N] tests)
- tests/contracts/auth001.test.ts
- tests/contracts/payment002.test.ts
- [... all tests ...]

### Implementation
- src/middleware/authMiddleware.ts
- src/routes/auth.ts
- src/routes/users.ts
- src/routes/payments.ts
- [... all implementation files ...]

## Verification Results

✅ All [N] contracts PASS
✅ All [N] user journeys VERIFIED
✅ [N] features implemented
✅ Infrastructure complete
✅ CI/CD configured
✅ Documentation generated

## Commands to Verify

```bash
# Run all tests
npm test

# Verify contracts specifically
npm test -- tests/contracts/

# Check contract compliance
node scripts/check-contracts.js

# Start application
npm run dev
```

## Next Steps

1. Review generated contracts in docs/contracts/
2. Run tests: npm test
3. Start server: npm run dev
4. Test API endpoints manually (see docs/API.md)
5. Deploy (see docs/DEPLOYMENT.md)

## Contract Protection

Future LLMs editing this codebase will:
1. See contracts in CLAUDE.md
2. Run tests before committing
3. Be blocked by CI if contracts violated

Your spec is now ENFORCED, not just documented.
```

---

## EXECUTION CHECKLIST FOR LLMs

Before reporting completion, verify:

### Phase 1: Intake
- [ ] Spec loaded completely
- [ ] All MUST requirements extracted
- [ ] All critical journeys identified
- [ ] Tech stack confirmed

### Phase 2: Contracts
- [ ] All MUST requirements have contracts
- [ ] All contracts saved to docs/contracts/
- [ ] All journey contracts created
- [ ] Contract index exists

### Phase 3: Tests
- [ ] All contracts have test files
- [ ] All journeys have test files
- [ ] Test infrastructure set up

### Phase 4: Planning
- [ ] All implementation todos created
- [ ] Dependencies mapped

### Phase 5: Implementation
- [ ] Infrastructure complete
- [ ] All features implemented
- [ ] All todos marked complete

### Phase 6: Verification
- [ ] All contract tests PASS
- [ ] Checker script reports no violations
- [ ] All journeys verified

### Phase 7: Infrastructure
- [ ] Environment configured
- [ ] Database ready
- [ ] Server runs
- [ ] CI/CD integrated

### Phase 8: Documentation
- [ ] API documented
- [ ] Contracts summarized
- [ ] Setup instructions complete

### Phase 9: Final Report
- [ ] Report generated
- [ ] All artifacts listed
- [ ] Verification results included

---

## EXAMPLE USAGE

### User Message:

```
Execute MASTER-ORCHESTRATOR.md with this spec:

# Email Notification Service

## Requirements

### Authentication
- All API endpoints MUST require authentication
- Auth tokens MUST be stored in httpOnly cookies
- Sessions MUST expire after 7 days

### Email Service
- Email sending MUST be rate-limited to 100 emails/min per user
- Email addresses MUST be validated before sending
- Email templates MUST use parameterized inputs (no string interpolation)

### User Journey
User registration flow:
1. User lands on /register
2. User fills email/password form
3. User submits form
4. System sends confirmation email
5. User clicks link in email
6. User lands on /dashboard
```

### LLM Response:

```
I'll execute the MASTER-ORCHESTRATOR to convert your spec into
contracts and implement the Email Notification Service.

## PHASE 1: Intake & Analysis

✅ Spec loaded
✅ Tech stack: Node.js + Express + PostgreSQL (inferred)

### Extracted Requirements (MUST):
1. All API endpoints require authentication - Source: Authentication section
2. Auth tokens in httpOnly cookies - Source: Authentication section
3. Sessions expire after 7 days - Source: Authentication section
4. Rate limit 100 emails/min per user - Source: Email Service section
5. Validate email addresses - Source: Email Service section
6. Parameterized email templates - Source: Email Service section

### Critical Journey:
- User Registration: /register → submit → email → confirm → /dashboard

## PHASE 2: Contract Generation

Creating 6 contracts:

[Creates all contract files...]

✅ docs/contracts/auth_001_endpoints.yml
✅ docs/contracts/auth_002_tokens.yml
✅ docs/contracts/auth_003_sessions.yml
✅ docs/contracts/email_001_rate_limit.yml
✅ docs/contracts/email_002_validation.yml
✅ docs/contracts/email_003_templates.yml
✅ docs/contracts/journey_registration.yml

## PHASE 3: Test Generation

[Creates all test files...]

✅ tests/contracts/auth001.test.ts
✅ tests/contracts/auth002.test.ts
... (7 total tests)

## PHASE 4: Implementation Planning

[Creates todos with TodoWrite...]

✅ 15 todos created (Infrastructure: 4, Features: 7, Verification: 2, Docs: 2)

## PHASE 5: Implementation

[Implements all features...]

✅ Infrastructure set up
✅ Auth middleware implemented
✅ Email service implemented
✅ Registration flow implemented
✅ All 15 todos completed

## PHASE 6: Verification

Running all contract tests...

✅ All 7 contract tests PASS
✅ Checker script: No violations
✅ Registration journey verified

## PHASE 7: Infrastructure

✅ .env configured
✅ Database connected
✅ Server running on :3000
✅ GitHub Actions CI configured

## PHASE 8: Documentation

✅ API.md created
✅ CONTRACT_SUMMARY.md created
✅ README.md created

## PHASE 9: Final Report

[Full report as shown in Phase 9 template above...]

## ✅ IMPLEMENTATION COMPLETE

Your Email Notification Service is fully implemented with 6 architectural
contracts enforcing your spec requirements.

Verify with:
```bash
npm test
npm run dev
```

All contracts are now protecting your codebase.
```

---

## TROUBLESHOOTING

### Issue: "Can't determine tech stack from spec"

**Solution:**
```
ASK USER:
"Your spec doesn't specify a tech stack. Which should I use?
1. Node.js + Express + PostgreSQL
2. Python + FastAPI + PostgreSQL
3. Other (please specify)"
```

---

### Issue: "Requirement is vague, can't create contract"

**Bad requirement:** "System should be performant"

**Solution:**
```
ASK USER:
"Requirement '[vague requirement]' is too vague to enforce.
Can you clarify?
- What metric? (response time, throughput, etc.)
- What threshold? (< 200ms, > 1000 req/s, etc.)
- What scope? (all endpoints, specific routes, etc.)"
```

---

### Issue: "Contract test fails during implementation"

**Solution:**
1. Read failure message
2. Identify which contract rule violated
3. Read contract compliance checklist
4. Fix code to satisfy contract
5. Rerun test
6. Continue

DO NOT skip or ignore contract violations.

---

## NOTES FOR LLMs

1. **This is a complete workflow.** Do not skip phases.
2. **Verify at every checkpoint.** Do not proceed if checkpoint fails.
3. **Create ALL artifacts.** Contracts, tests, code, docs.
4. **Tests must pass before completion.** No exceptions.
5. **Ask user when unclear.** Don't guess at requirements.

**Remember:** The goal is not just "make it work" but "make it work AND enforce spec via contracts."

---

**END OF MASTER ORCHESTRATOR**
