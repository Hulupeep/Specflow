# Spec → Contract Workflow

> **📌 STATUS: Reference Guide (Secondary)**
>
> This document provides detailed conversion examples and patterns.
>
> **For most users, start with these docs instead:**
> - **[SPEC-FORMAT.md](SPEC-FORMAT.md)** - Normalized spec format with REQ IDs (simpler, more deterministic)
> - **[CONTRACT-SCHEMA.md](CONTRACT-SCHEMA.md)** - Lean YAML schema
> - **[LLM-MASTER-PROMPT.md](LLM-MASTER-PROMPT.md)** - Incremental workflow
>
> **Use this doc when:** You need deep-dive examples of converting arbitrary prose specs into contracts.
>
> **Prefer SPEC-FORMAT.md when:** You're writing new specs (use the normalized format from the start).
>
> ---

## Converting Product Specs into Enforceable Contracts

This guide shows how to transform product requirements, user stories, and specifications into machine-readable architectural contracts that LLMs cannot violate.

---

## The Problem: Specs Get Ignored

**Traditional workflow:**
```
PM writes spec → Engineer reads spec → Engineer implements
                    ↓
              (Maybe LLM helps)
                    ↓
        LLM doesn't know spec exists
                    ↓
           Spec violations in code
```

**Result:** Spec drift, unintentional breaking changes, production bugs.

---

## The Solution: Spec → Contract → Tests

```
PM writes spec
      ↓
Convert to YAML contract
      ↓
Auto-generate tests from contract
      ↓
Tests enforce spec automatically
      ↓
Build fails if spec violated
```

**Result:** Spec becomes enforceable law, not just documentation.

---

## Step-by-Step Conversion Process

### Step 1: Identify Enforceable Requirements

**Review your spec and highlight:**
- ✅ **Must have** requirements (critical, non-negotiable)
- ✅ **Must not** requirements (forbidden patterns)
- ✅ **Always** requirements (invariants)
- ⚠️ **Should** requirements (soft rules, negotiable)

**Example Spec:**
```markdown
# User Authentication Spec

## Requirements
1. **All API endpoints MUST require authentication** (except /health, /public)
2. **Authentication tokens MUST be stored in httpOnly cookies**
3. **Passwords MUST be hashed with bcrypt**
4. Session timeout SHOULD be 30 minutes (configurable)
5. Users MAY enable 2FA (optional feature)
```

**Enforceable requirements:**
- #1 → Contract (MUST require auth)
- #2 → Contract (MUST use httpOnly cookies)
- #3 → Contract (MUST hash passwords)
- #4 → Soft rule (SHOULD = configurable)
- #5 → Not enforced (MAY = optional)

---

### Step 2: Create Contract Structure

**Template:**
```yaml
# docs/contracts/[feature_name].yml

contract_meta:
  id: [feature]_contract
  version: 1
  created_from: "Product spec: [link or file]"
  owner: "[PM name]"

non_negotiable_rules:
  # Add MUST requirements here
  - id: [feature]_001
    title: "[Requirement summary]"
    behavior_spec:
      forbidden_patterns:
        - pattern: /[regex to detect violation]/
          message: "[Why this is forbidden]"

soft_rules:
  # Add SHOULD requirements here
  - id: [feature]_010
    title: "[Preferred pattern]"
```

---

### Step 3: Convert Each Requirement to Contract Rule

#### Example 1: "All API endpoints MUST require authentication"

**Spec statement:**
> All API endpoints (except /health and /public/*) must require authentication middleware.

**Contract conversion:**
```yaml
non_negotiable_rules:
  - id: api_auth_001
    title: "API endpoints must use authentication middleware"
    description: >
      Every route in src/api/routes/ must have authMiddleware
      as the first parameter (except whitelisted public routes).

    behavior_spec:
      forbidden_patterns:
        - pattern: /router\.(get|post|put|delete)\(['"]\/api\/(?!health|public).*['"]\s*,\s*(?!authMiddleware)/
          message: "API route missing authMiddleware"

        - pattern: /skipAuth\s*:\s*true/i
          message: "Auth bypass flags are forbidden"

      required_patterns:
        - pattern: /authMiddleware/
          message: "Must import and use authMiddleware"

    allowed_exceptions:
      files:
        - src/api/routes/health.ts
        - src/api/routes/public/**
```

**Test generated from contract:**
```typescript
it('LLM CHECK: all API routes have authMiddleware', () => {
  const routeFiles = glob.sync('src/api/routes/**/*.ts', {
    ignore: ['**/health.ts', '**/public/**']
  })

  for (const file of routeFiles) {
    const content = fs.readFileSync(file, 'utf-8')

    // Check for routes without auth
    const routePattern = /router\.(get|post|put|delete)\(['"]\/api\//g
    const routes = content.match(routePattern)

    if (routes) {
      for (const route of routes) {
        const fullLine = getLineContaining(content, route)
        if (!fullLine.includes('authMiddleware')) {
          throw new Error(
            `CONTRACT VIOLATION: api_auth_001\n` +
            `File: ${file}\n` +
            `Route missing authMiddleware: ${route}\n` +
            `See: docs/contracts/authentication_contract.yml`
          )
        }
      }
    }
  }
})
```

---

#### Example 2: "Tokens MUST be stored in httpOnly cookies"

**Spec statement:**
> Authentication tokens must be stored in httpOnly cookies, never in localStorage or sessionStorage.

**Contract conversion:**
```yaml
non_negotiable_rules:
  - id: auth_token_002
    title: "Auth tokens must use httpOnly cookies"

    behavior_spec:
      forbidden_patterns:
        - pattern: /localStorage\.setItem\(['"].*token/i
          message: "Tokens in localStorage are insecure (XSS risk)"

        - pattern: /sessionStorage\.setItem\(['"].*token/i
          message: "Tokens in sessionStorage are insecure"

      required_patterns:
        - pattern: /cookie.*httpOnly\s*:\s*true/
          message: "Must set httpOnly flag on token cookies"

      example_violation: |
        // ❌ WRONG - XSS vulnerable
        localStorage.setItem('authToken', token)

      example_compliant: |
        // ✅ CORRECT - httpOnly cookie
        res.cookie('authToken', token, {
          httpOnly: true,
          secure: true,
          sameSite: 'strict'
        })
```

---

#### Example 3: "Passwords MUST be hashed"

**Spec statement:**
> User passwords must be hashed with bcrypt (min 10 rounds) before storage.

**Contract conversion:**
```yaml
non_negotiable_rules:
  - id: password_security_003
    title: "Passwords must be hashed with bcrypt"

    behavior_spec:
      forbidden_patterns:
        - pattern: /password\s*:\s*req\.body\.password/
          message: "Storing plaintext password"

        - pattern: /INSERT.*users.*VALUES.*\$\{.*password\}/
          message: "SQL injection + plaintext password"

      required_patterns:
        - pattern: /bcrypt\.hash\(/
          message: "Must use bcrypt.hash()"

        - pattern: /saltRounds\s*>=?\s*10/
          message: "Must use minimum 10 salt rounds"

      test_scenarios:
        - scenario: "User registration"
          verifies: "Password is hashed before database insert"

        - scenario: "Password reset"
          verifies: "New password is hashed"
```

---

### Step 4: Add Compliance Checklist

**Purpose:** Give LLMs explicit questions to answer before modifying code.

```yaml
compliance_checklist:
  before_modifying_file:
    - question: "Does this change add a new API route?"
      if_yes: "Add authMiddleware as first parameter"

    - question: "Does this change handle authentication tokens?"
      if_yes: "Use httpOnly cookies, NEVER localStorage"

    - question: "Does this change store user passwords?"
      if_yes: "Hash with bcrypt.hash(password, 10+)"

    - question: "Does user explicitly request override?"
      if_yes: "Check for phrase: override_contract: authentication_contract"
      if_no: "STOP - Cannot violate contract"
```

---

## Template: Spec Section → Contract Rule

Use this template for quick conversion:

```yaml
# Spec statement: "[COPY EXACT REQUIREMENT FROM SPEC]"

non_negotiable_rules:
  - id: [feature]_[number]
    title: "[One-line summary of requirement]"

    # Copy rationale from spec
    description: >
      [Why this requirement exists]
      [What problem it solves]
      [What happens if violated]

    # Define code patterns
    behavior_spec:
      # What code patterns are FORBIDDEN
      forbidden_patterns:
        - pattern: /[regex]/
          message: "[Why forbidden]"

      # What code patterns are REQUIRED
      required_patterns:
        - pattern: /[regex]/
          message: "[Why required]"

      # Show examples
      example_violation: |
        // ❌ Code that violates this rule

      example_compliant: |
        // ✅ Code that follows this rule

    # What files this applies to
    scope:
      - src/[directory]/

    # Any exceptions
    allowed_exceptions:
      files:
        - path/to/exception.ts
      reason: "[Why this file is exempt]"
```

---

## Worked Example: Full Spec → Contract

### Original Spec

```markdown
# Email Notification Service Spec

## Requirements

### R1: Rate Limiting
All email sending functions MUST be rate-limited to 100 emails/minute
per user to prevent spam and stay within SendGrid limits.

### R2: Email Validation
All email addresses MUST be validated before sending. Invalid emails
should throw EmailValidationError, not fail silently.

### R3: Template Security
Email templates MUST use parameterized inputs. Direct string
interpolation into templates is forbidden (XSS risk).

### R4: Monitoring
Email send operations SHOULD be logged with recipient count and
template ID for debugging.
```

### Converted Contract

```yaml
# docs/contracts/email_service.yml

contract_meta:
  id: email_service_contract
  version: 1
  system: email_notification_service
  owner: "Product Team"
  created_from: "Email Notification Service Spec v2.1"
  last_reviewed_at: "2025-12-02"

context_summary:
  short_description: >
    Enforces email security, rate limiting, and monitoring
    requirements for the email notification service.

  rationale:
    - "Prevent spam and stay within SendGrid limits (R1)"
    - "Avoid sending to invalid emails that bounce (R2)"
    - "Prevent XSS attacks via email templates (R3)"
    - "Enable debugging of email issues (R4)"

  references:
    - "docs/specs/email-service-spec-v2.1.md"

non_negotiable_rules:
  - id: email_rate_limit_001
    title: "Email sending must be rate-limited to 100/min per user"
    description: >
      All functions that send emails must check rate limits
      before sending. Exceeding 100 emails/minute per user
      should throw RateLimitExceededError.

    status: active
    mutability: immutable
    scope:
      - src/services/email/

    behavior_spec:
      required_patterns:
        - pattern: /checkRateLimit\(/
          message: "Must call checkRateLimit() before sending"

        - pattern: /RateLimitExceededError/
          message: "Must throw RateLimitExceededError when exceeded"

      forbidden_patterns:
        - pattern: /sendEmail\(.*\)(?!.*checkRateLimit)/
          message: "sendEmail() called without rate limit check"

      example_violation: |
        // ❌ WRONG - No rate limit check
        async function sendWelcomeEmail(userId, email) {
          await sendEmail(email, 'welcome-template')
        }

      example_compliant: |
        // ✅ CORRECT - Rate limit checked
        async function sendWelcomeEmail(userId, email) {
          await checkRateLimit(userId, 'email')
          await sendEmail(email, 'welcome-template')
        }

  - id: email_validation_002
    title: "Email addresses must be validated before sending"

    behavior_spec:
      required_patterns:
        - pattern: /validateEmail\(/
          message: "Must validate email before sending"

        - pattern: /EmailValidationError/
          message: "Must throw EmailValidationError for invalid emails"

      forbidden_patterns:
        - pattern: /sendEmail\(.*\)(?!.*validateEmail)/
          message: "Sending without validation"

        - pattern: /catch.*EmailValidationError.*\/\/ ignore/i
          message: "Cannot silently ignore validation errors"

  - id: email_template_security_003
    title: "Email templates must use parameterized inputs"

    behavior_spec:
      forbidden_patterns:
        - pattern: /template\s*\+\s*[a-zA-Z]/
          message: "String concatenation in templates (XSS risk)"

        - pattern: /\$\{[^}]*user\./
          message: "Direct string interpolation with user data"

      required_patterns:
        - pattern: /renderTemplate\([^,]+,\s*\{/
          message: "Must use renderTemplate() with parameters object"

soft_rules:
  - id: email_logging_010
    title: "Email operations should be logged"

    status: active
    mutability: soft

    suggested_behavior:
      - "Log recipient count for each send operation"
      - "Log template ID used"
      - "Log rate limit status"

    llm_may_adjust_if:
      - "Sensitive data would be exposed in logs"
      - "Performance impact is significant"

test_requirements:
  required_test_files:
    - path: "src/__tests__/contracts/emailService.test.ts"
      purpose: "Verify email_service_contract compliance"

  test_scenarios:
    - scenario: "Send email without rate limit check"
      verifies: "email_rate_limit_001"
      expected_outcome: "Test fails with CONTRACT VIOLATION message"

    - scenario: "Send email without validation"
      verifies: "email_validation_002"
      expected_outcome: "Test fails, requires validateEmail() call"

    - scenario: "Template with string concatenation"
      verifies: "email_template_security_003"
      expected_outcome: "Test fails, requires renderTemplate()"

compliance_checklist:
  before_modifying_file:
    - question: "Does this change send emails?"
      if_yes: "Add checkRateLimit() and validateEmail() calls"

    - question: "Does this change modify email templates?"
      if_yes: "Use renderTemplate() with parameters object"

    - question: "Does this change handle email errors?"
      if_yes: "Do NOT silently ignore EmailValidationError"

enforcement:
  for_llms:
    - "Read this contract BEFORE modifying src/services/email/"
    - "Run tests: npm test -- emailService"
    - "Check: node scripts/check-contracts.js src/services/email/"

  for_humans:
    - "Contract enforces Email Service Spec v2.1"
    - "To override: say 'override_contract: email_service_contract'"
```

---

## Spec Types → Contract Patterns

### Type 1: Security Requirements

**Spec pattern:**
> "Must [do secure thing], never [do insecure thing]"

**Contract pattern:**
```yaml
behavior_spec:
  forbidden_patterns:
    - pattern: /[insecure thing]/
      message: "Security violation: [risk]"
  required_patterns:
    - pattern: /[secure thing]/
      message: "Must use [secure approach]"
```

---

### Type 2: Performance Requirements

**Spec pattern:**
> "Must complete within [time], process [N items] per [timeframe]"

**Contract pattern:**
```yaml
behavior_spec:
  required_patterns:
    - pattern: /setTimeout|setInterval/
      message: "Must implement timeout"
  test_scenarios:
    - scenario: "Performance under load"
      assertions:
        - "Response time < 200ms for 95th percentile"
```

---

### Type 3: Data Integrity Requirements

**Spec pattern:**
> "Must validate [data] before [operation]"

**Contract pattern:**
```yaml
behavior_spec:
  required_patterns:
    - pattern: /validate[A-Z]\w+\(/
      message: "Must validate before processing"
  forbidden_patterns:
    - pattern: /INSERT.*VALUES.*\$\{/
      message: "SQL injection risk"
```

---

### Type 4: Workflow Requirements

**Spec pattern:**
> "Step A must happen before Step B"

**Contract pattern:**
```yaml
behavior_spec:
  required_sequence:
    - pattern: /stepA\(/
      must_appear_before: /stepB\(/
      message: "stepA() must be called before stepB()"
```

---

## Automation: Spec → Contract Generator

**For LLMs:** Use this prompt to auto-generate contracts from specs:

```
Given this product spec:

[PASTE SPEC HERE]

Generate an architectural contract YAML file using the template from
docs/contracts/contract_template.yml

For each "MUST" requirement, create a non_negotiable_rule with:
1. Unique ID (feature_001, feature_002, etc.)
2. Forbidden patterns (regex to detect violations)
3. Required patterns (regex to detect compliance)
4. Example violation and compliant code
5. Test scenarios

For each "SHOULD" requirement, create a soft_rule.

Ignore "MAY" requirements (optional features).

Output: Complete YAML contract ready to use.
```

---

## Verification: Does Your Contract Match Your Spec?

**Checklist:**

✅ Every "MUST" requirement → `non_negotiable_rule`
✅ Every "NEVER" requirement → `forbidden_patterns`
✅ Every forbidden pattern → Has clear `message` explaining why
✅ Every rule → Has `example_violation` and `example_compliant` code
✅ Contract `created_from` → Links to original spec
✅ Compliance checklist → Covers all critical requirements

**Test the contract:**
1. Create intentional violation in code
2. Run contract tests
3. Tests should FAIL with clear message
4. Fix violation
5. Tests should PASS

---

## Maintaining Spec ↔ Contract Alignment

**When spec changes:**

1. **Update contract first:**
   ```yaml
   contract_meta:
     version: 2  # Increment version
     last_reviewed_at: "2025-12-15"

   changelog:
     - version: 2
       date: "2025-12-15"
       changes:
         - "Updated rate limit from 100 to 200 emails/min (Spec v2.2)"
   ```

2. **Update tests to match new patterns**

3. **Run tests to verify alignment:**
   ```bash
   npm test -- contracts
   ```

4. **Document the change:**
   - Update spec reference
   - Add migration note if breaking change

---

## Common Pitfalls

### ❌ Pitfall 1: Spec too vague

**Bad spec:**
> "System should be secure"

**Problem:** Not enforceable, no clear violation pattern.

**Fix:**
> "API endpoints must use HTTPS, validate all inputs, and rate-limit requests to 100/min"

---

### ❌ Pitfall 2: Over-specifying implementation

**Bad spec:**
> "Must use bcrypt library version 5.1.0 with exactly 12 salt rounds"

**Problem:** Too rigid, prevents valid alternatives.

**Fix:**
> "Passwords must be hashed with bcrypt (min 10 salt rounds) or Argon2"

---

### ❌ Pitfall 3: Testing implementation, not behavior

**Bad contract:**
```yaml
required_patterns:
  - pattern: /class.*extends.*BaseController/
```

**Problem:** Tests HOW it's built, not WHAT it does.

**Fix:**
```yaml
test_scenarios:
  - scenario: "Unauthenticated request to protected endpoint"
    expected_outcome: "Returns 401 Unauthorized"
```

---

## Summary: Quick Reference

1. **Identify requirements:** MUST/NEVER/ALWAYS vs SHOULD/MAY
2. **Create contract:** One contract per feature/component
3. **Map requirements → rules:** 1 MUST = 1 non_negotiable_rule
4. **Define patterns:** Forbidden + Required regex patterns
5. **Write tests:** Auto-detect violations via source scanning
6. **Add checklist:** Questions LLMs answer before changes
7. **Verify:** Intentionally violate → tests fail

**Result:** Your spec is now enforceable code that blocks violations automatically.

---

**Next:** See [USER-JOURNEY-CONTRACTS.md](USER-JOURNEY-CONTRACTS.md) for converting user journeys into contracts.
