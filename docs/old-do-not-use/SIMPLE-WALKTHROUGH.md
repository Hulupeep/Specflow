# Specflow Simple Walkthrough

**Spec → Architecture → Journeys → Tell Claude → Done**

---

## Step 1: Write Your Spec (What Must Be True)

Create a spec file with requirement IDs:

```markdown
# MyApp Spec

## Architecture (What's Always True)

### ARCH-001 (MUST)
All API routes must verify authentication before processing.
Unauthenticated requests return 401.

### ARCH-002 (MUST)
User data must never be stored in localStorage.
Use server-side sessions only.

## Features (What The Product Does)

### FEAT-001 (MUST)
Users can create an account with email and password.
Password must be hashed with bcrypt.

### FEAT-002 (MUST)
Users can log in and receive a session token.
Sessions expire after 24 hours.

## Journeys (What Users Accomplish)

### J-AUTH-001: User Registration
1. User enters email and password
2. System validates email format
3. System hashes password
4. System creates user record
5. User receives confirmation

**Expected:** User exists in database with hashed password.

### J-AUTH-002: User Login
1. User enters credentials
2. System verifies password hash
3. System creates session
4. User receives session token

**Expected:** Valid session exists, user redirected to dashboard.
```

---

## Step 2: Tell Claude to Build It

Copy this prompt:

```
Read the Specflow methodology from this repo:
- SPEC-FORMAT.md (how to write specs)
- CONTRACT-SCHEMA.md (YAML format)
- LLM-MASTER-PROMPT.md (your workflow)

Now build my app from this spec:

[PASTE YOUR SPEC HERE]

Follow Specflow:
1. Generate architecture contracts first (ARCH-xxx)
2. Generate feature contracts (FEAT-xxx)
3. Generate journey contracts (J-xxx)
4. Create tests that scan for violations
5. Implement the code
6. Verify all contracts pass before considering done
```

---

## Step 3: What Claude Will Produce

### Architecture Contract
```yaml
# docs/contracts/feature_auth.yml
contract_meta:
  id: feature_auth
  covers_reqs: [ARCH-001, ARCH-002]

rules:
  non_negotiable:
    - id: ARCH-001
      title: "API routes require auth"
      forbidden_patterns:
        - pattern: /export.*function.*(GET|POST).*\{(?!.*auth)/
          message: "API route missing authentication check"

    - id: ARCH-002
      title: "No user data in localStorage"
      forbidden_patterns:
        - pattern: /localStorage.*(user|email|token)/i
          message: "User data must not be in localStorage"
```

### Journey Contract
```yaml
# docs/contracts/journey_registration.yml
contract_meta:
  id: journey_registration
  covers_reqs: [J-AUTH-001]

journey_definition:
  name: "User Registration"
  steps:
    - action: "Enter email and password"
      expected: "Form accepts input"
    - action: "Submit form"
      expected: "User created with hashed password"

  acceptance_criteria:
    - "User record exists in database"
    - "Password is bcrypt hashed (not plaintext)"
    - "Confirmation shown to user"
```

### Contract Test
```typescript
// src/__tests__/contracts/auth.test.ts
describe('Contract: ARCH-002', () => {
  it('No user data in localStorage', () => {
    const files = glob.sync('src/**/*.{ts,tsx}')
    for (const file of files) {
      const content = fs.readFileSync(file, 'utf-8')
      if (/localStorage.*(user|email|token)/i.test(content)) {
        throw new Error(`CONTRACT VIOLATION: ARCH-002 in ${file}`)
      }
    }
  })
})
```

---

## Step 4: The Verification Loop

Claude runs:
```bash
npm test -- contracts
```

If violations found → fix and rerun.
If all pass → feature is done.

---

## The Formula

```
Architecture + Features + Journeys = The Product
```

| Layer | Question | Example |
|-------|----------|---------|
| **ARCH** | "What's always true?" | "No user data in localStorage" |
| **FEAT** | "What does it do?" | "Users can register" |
| **JOURNEY** | "What can users accomplish?" | "Complete registration flow" |

---

## Quick Reference

### Requirement ID Format
```
ARCH-001 (MUST)   ← Architecture, required
FEAT-002 (SHOULD) ← Feature, guideline
J-AUTH-003        ← Journey
```

### Contract Rule Types
```yaml
rules:
  non_negotiable:  # MUST - build fails if violated
    - forbidden_patterns: [...]  # Must NOT appear
    - required_patterns: [...]   # MUST appear

  soft:  # SHOULD - guidelines, not enforced
    - suggestion: "Consider using..."
```

### Test Output Format
```
CONTRACT VIOLATION: ARCH-002
File: src/auth.ts:45
Issue: localStorage contains user data
```

---

## Common First Contracts

### 1. Authentication Required
```yaml
- id: ARCH-001
  forbidden_patterns:
    - pattern: /router\.(get|post)\(.*,\s*async.*\{(?!.*auth)/
      message: "Route missing auth middleware"
```

### 2. No Secrets in Code
```yaml
- id: ARCH-002
  forbidden_patterns:
    - pattern: /(api_key|secret|password)\s*=\s*['"][^'"]+['"]/i
      message: "Hardcoded secret detected"
```

### 3. SQL Injection Prevention
```yaml
- id: ARCH-003
  forbidden_patterns:
    - pattern: /query\s*\(\s*['"`].*\$\{/
      message: "SQL string interpolation - use parameterized queries"
```

---

## That's It

1. **Write spec** with ARCH/FEAT/JOURNEY IDs
2. **Tell Claude** to follow Specflow
3. **Claude generates** contracts + tests + code
4. **Violations block** the build
5. **Ship when green**

No drift. No "optimization" surprises. Checkable LLMs.
