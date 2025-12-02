# Contract Schema

All contracts live in `docs/contracts/` and follow this schema.

---

## Why This Schema?

**Lean and opinionated.** We've stripped out the bloat and kept only what's necessary:

- Clear IDs that map back to specs
- Minimal YAML fields
- Explicit forbidden/required patterns
- Test hooks for enforcement

**Not included:** Verbose descriptions, redundant metadata, over-engineering.

---

## 1. File Naming

- **Feature contracts**: `feature_<name>.yml`
  Example: `feature_authentication.yml`

- **Journey contracts**: `journey_<name>.yml`
  Example: `journey_auth_register.yml`

One feature contract can cover multiple `REQ` IDs from the spec.

---

## 2. Feature Contract Shape

```yaml
contract_meta:
  id: auth_feature
  version: 1
  created_from_spec: "docs/specs/authentication.md"
  covers_reqs:
    - AUTH-001
    - AUTH-002
    - AUTH-003
  owner: "product-or-team-name"

llm_policy:
  enforce: true
  llm_may_modify_non_negotiables: false
  override_phrase: "override_contract: auth_feature"

rules:
  non_negotiable:
    - id: AUTH-001
      title: "All protected API endpoints require authentication"
      scope:
        - "src/routes/**/*.ts"
      behavior:
        forbidden_patterns:
          - pattern: /router\.(get|post|put|delete)\(['"]\/api\/(?!health|public).*['"]\s*,\s*(?!authMiddleware)/
            message: "API route missing authMiddleware"
        required_patterns:
          - pattern: /authMiddleware/
            message: "Must import and use authMiddleware"
        example_violation: |
          router.get('/api/users', async (req, res) => { ... })
        example_compliant: |
          router.get('/api/users', authMiddleware, async (req, res) => { ... })

    - id: AUTH-002
      title: "Auth tokens stored in httpOnly cookies"
      scope:
        - "src/controllers/auth/**/*.ts"
      behavior:
        forbidden_patterns:
          - pattern: /localStorage\.setItem\(['"].*token/i
            message: "Tokens must not be stored in localStorage"
        required_patterns:
          - pattern: /httpOnly\s*:\s*true/
            message: "Token cookies must be httpOnly"

  soft:
    - id: AUTH-010
      title: "Session timeout configurable"
      suggestion: "Expose SESSION_TIMEOUT env var"
      llm_may_bend_if:
        - "Config system cannot support per-env yet"
        - "User explicitly requests override"

compliance_checklist:
  before_editing_files:
    - question: "Are you adding or changing an API route under /api/?"
      if_yes: "Ensure authMiddleware is present on non-public routes."
    - question: "Are you changing auth token storage?"
      if_yes: "Use httpOnly cookies; never use localStorage/sessionStorage."

test_hooks:
  tests:
    - file: "src/__tests__/contracts/auth_contract.test.ts"
      description: "Pattern checks for AUTH-001..003"
  tooling:
    checker_script: "scripts/check-contracts.js"
```

---

## 3. Journey Contract Shape

```yaml
journey_meta:
  id: J-AUTH-REGISTER
  from_spec: "docs/specs/authentication.md"
  covers_reqs:
    - AUTH-001
    - AUTH-002
  type: "e2e"

steps:
  - step: 1
    name: "Visit registration page"
    required_elements:
      - selector: "form[action='/register']"
      - selector: "input[name='email']"
      - selector: "input[name='password']"

  - step: 2
    name: "Submit form"
    expected:
      - type: "api_call"
        method: "POST"
        path: "/api/auth/register"

  - step: 3
    name: "Receive confirmation email"
    expected:
      - type: "email_sent"
        to: "user@example.com"
        contains: "confirm your email"

  - step: 4
    name: "Confirm and land on dashboard"
    expected:
      - type: "navigation"
        path_contains: "/dashboard"

test_hooks:
  e2e_test_file: "tests/e2e/journey_auth_register.spec.ts"
```

---

## 4. Schema Reference

### contract_meta

| Field | Type | Required | Description |
|-------|------|----------|-------------|
| `id` | string | ✅ | Unique contract ID (e.g. `auth_feature`) |
| `version` | number | ✅ | Version number (increment on changes) |
| `created_from_spec` | string | ✅ | Path to source spec file |
| `covers_reqs` | string[] | ✅ | List of REQ IDs this contract enforces |
| `owner` | string | ✅ | Team or person responsible |

### llm_policy

| Field | Type | Required | Description |
|-------|------|----------|-------------|
| `enforce` | boolean | ✅ | Whether LLMs must respect this contract |
| `llm_may_modify_non_negotiables` | boolean | ✅ | Can LLMs change `non_negotiable` rules? (usually `false`) |
| `override_phrase` | string | ✅ | Exact phrase user must say to override |

### rules.non_negotiable[]

| Field | Type | Required | Description |
|-------|------|----------|-------------|
| `id` | string | ✅ | REQ ID from spec (e.g. `AUTH-001`) |
| `title` | string | ✅ | Short description of rule |
| `scope` | string[] | ✅ | Glob patterns for files this rule applies to |
| `behavior.forbidden_patterns` | object[] | ⚠️ | Patterns that must NOT appear in code |
| `behavior.required_patterns` | object[] | ⚠️ | Patterns that MUST appear in code |
| `behavior.example_violation` | string | ⚠️ | Code example showing violation |
| `behavior.example_compliant` | string | ⚠️ | Code example showing compliance |

⚠️ = Optional but highly recommended

### rules.soft[]

| Field | Type | Required | Description |
|-------|------|----------|-------------|
| `id` | string | ✅ | REQ ID from spec (e.g. `AUTH-010`) |
| `title` | string | ✅ | Short description of guideline |
| `suggestion` | string | ✅ | Preferred approach |
| `llm_may_bend_if` | string[] | ⚠️ | Conditions where LLM can deviate |

### compliance_checklist.before_editing_files[]

| Field | Type | Required | Description |
|-------|------|----------|-------------|
| `question` | string | ✅ | Question LLM should ask itself |
| `if_yes` | string | ✅ | Action to take if answer is yes |

### test_hooks

| Field | Type | Required | Description |
|-------|------|----------|-------------|
| `tests` | object[] | ✅ | List of test files that enforce this contract |
| `tooling.checker_script` | string | ⚠️ | Path to quick checker script |

---

## 5. Pattern Syntax

### Forbidden Patterns

Detect code that violates the contract:

```yaml
forbidden_patterns:
  - pattern: /localStorage\.getItem/
    message: "localStorage not allowed in service workers"

  - pattern: /eval\s*\(/
    message: "eval() forbidden for security reasons"

  - pattern: /\$\{.*user\./
    message: "Direct string interpolation with user data (XSS risk)"
```

### Required Patterns

Detect code that must be present:

```yaml
required_patterns:
  - pattern: /authMiddleware/
    message: "Must use authMiddleware on protected routes"

  - pattern: /httpOnly\s*:\s*true/
    message: "Cookies must have httpOnly flag"

  - pattern: /bcrypt\.hash\(/
    message: "Passwords must be hashed with bcrypt"
```

### Pattern Tips

1. **Use regex syntax**: JavaScript regex format (`/pattern/`)
2. **Be specific**: `/localStorage\.get/` not `/localStorage/` (matches comments)
3. **Add context**: Match surrounding code to reduce false positives
4. **Test patterns**: Run against real code before committing

---

## 6. Scope Patterns

Use glob patterns to specify which files a rule applies to:

```yaml
scope:
  - "src/routes/**/*.ts"          # All route files
  - "src/controllers/auth/**/*"   # All auth controller files
  - "src/background.ts"            # Specific file
```

**Exclude patterns:**

```yaml
scope:
  - "src/api/**/*.ts"
  - "!src/api/public/**"           # Exclude public API routes
```

---

## 7. Journey Contract Schema

### journey_meta

| Field | Type | Required | Description |
|-------|------|----------|-------------|
| `id` | string | ✅ | Journey ID from spec (e.g. `J-AUTH-REGISTER`) |
| `from_spec` | string | ✅ | Path to source spec file |
| `covers_reqs` | string[] | ✅ | REQ IDs this journey validates |
| `type` | string | ✅ | Test type: `e2e`, `integration`, `smoke` |

### steps[]

| Field | Type | Required | Description |
|-------|------|----------|-------------|
| `step` | number | ✅ | Step number (1, 2, 3...) |
| `name` | string | ✅ | Description of step |
| `required_elements` | object[] | ⚠️ | DOM elements that must be present |
| `expected` | object[] | ⚠️ | Expected behaviors (API calls, navigation, etc.) |

### expected[] types

```yaml
# Navigation
- type: "navigation"
  path_contains: "/dashboard"

# API call
- type: "api_call"
  method: "POST"
  path: "/api/auth/register"

# Email sent
- type: "email_sent"
  to: "user@example.com"
  contains: "confirm"

# Element visible
- type: "element_visible"
  selector: "[data-testid='success-message']"
```

---

## 8. Complete Examples

### Example 1: API Authentication Contract

```yaml
contract_meta:
  id: api_auth
  version: 1
  created_from_spec: "docs/specs/authentication.md"
  covers_reqs:
    - AUTH-001
  owner: "backend-team"

llm_policy:
  enforce: true
  llm_may_modify_non_negotiables: false
  override_phrase: "override_contract: api_auth"

rules:
  non_negotiable:
    - id: AUTH-001
      title: "API routes require authMiddleware"
      scope:
        - "src/routes/**/*.ts"
        - "!src/routes/health.ts"
        - "!src/routes/public/**"
      behavior:
        forbidden_patterns:
          - pattern: /router\.(get|post|put|delete)\(['"]\/api\//
            message: "API route must have authMiddleware"
        required_patterns:
          - pattern: /authMiddleware/
            message: "Import and use authMiddleware"

compliance_checklist:
  before_editing_files:
    - question: "Adding or modifying an API route?"
      if_yes: "Add authMiddleware as first parameter"

test_hooks:
  tests:
    - file: "src/__tests__/contracts/api_auth.test.ts"
      description: "Scans routes for authMiddleware"
```

### Example 2: Storage Contract

```yaml
contract_meta:
  id: storage_patterns
  version: 1
  created_from_spec: "docs/specs/storage.md"
  covers_reqs:
    - STORAGE-001
    - STORAGE-002
  owner: "platform-team"

llm_policy:
  enforce: true
  llm_may_modify_non_negotiables: false
  override_phrase: "override_contract: storage_patterns"

rules:
  non_negotiable:
    - id: STORAGE-001
      title: "Service workers must use chrome.storage.local"
      scope:
        - "src/background.ts"
        - "src/service-worker/**/*.ts"
      behavior:
        forbidden_patterns:
          - pattern: /localStorage/
            message: "localStorage not available in service workers"
          - pattern: /sessionStorage/
            message: "sessionStorage not available in service workers"
        required_patterns:
          - pattern: /chrome\.storage\.local/
            message: "Must use chrome.storage.local"

    - id: STORAGE-002
      title: "Popup can use chrome.storage.local or localStorage"
      scope:
        - "src/popup/**/*.ts"
      behavior:
        required_patterns:
          - pattern: /chrome\.storage\.local|localStorage/
            message: "Must use chrome.storage.local or localStorage"

compliance_checklist:
  before_editing_files:
    - question: "Editing service worker code?"
      if_yes: "Use chrome.storage.local only; never localStorage"
    - question: "Editing popup code?"
      if_yes: "Prefer chrome.storage.local; localStorage OK if needed"

test_hooks:
  tests:
    - file: "src/__tests__/contracts/storage.test.ts"
      description: "Verifies storage API usage"
```

### Example 3: Journey Contract

```yaml
journey_meta:
  id: J-CHECKOUT
  from_spec: "docs/specs/checkout.md"
  covers_reqs:
    - CART-001
    - PAY-002
  type: "e2e"

steps:
  - step: 1
    name: "User has item in cart"
    required_elements:
      - selector: "[data-testid='cart-item']"
      - selector: "[data-testid='checkout-button']"

  - step: 2
    name: "User clicks checkout"
    expected:
      - type: "navigation"
        path_contains: "/checkout"

  - step: 3
    name: "User enters payment details"
    required_elements:
      - selector: "input[name='cardNumber']"
      - selector: "input[name='cvv']"
      - selector: "button[type='submit']"

  - step: 4
    name: "Payment processed"
    expected:
      - type: "api_call"
        method: "POST"
        path: "/api/payments/charge"

  - step: 5
    name: "Order confirmation shown"
    expected:
      - type: "navigation"
        path_contains: "/order/confirmation"
      - type: "element_visible"
        selector: "[data-testid='order-number']"

test_hooks:
  e2e_test_file: "tests/e2e/checkout_journey.spec.ts"
```

---

## 9. Contract Lifecycle

### Creating:
1. Write spec with REQ IDs
2. Create contract YAML mapping REQs → rules
3. Create tests that enforce rules
4. Register in `scripts/check-contracts.js`

### Updating:
1. User says: `override_contract: <id>`
2. Update `version` number
3. Modify rules as needed
4. Update tests to match
5. Document change in spec changelog

### Deprecating:
1. Mark contract as `status: deprecated` in metadata
2. Remove from `check-contracts.js` registry
3. Update spec to remove deprecated REQs
4. Archive contract to `docs/contracts/deprecated/`

---

## 10. Quick Reference

```
┌─────────────────────────────────────────────────────────┐
│ Contract Schema Quick Reference                         │
├─────────────────────────────────────────────────────────┤
│ Feature Contract:                                       │
│   contract_meta:                                        │
│     id: <feature>_<name>                                │
│     covers_reqs: [REQ-001, REQ-002]                     │
│   rules:                                                │
│     non_negotiable:                                     │
│       - id: REQ-001                                     │
│         forbidden_patterns: [...]                       │
│         required_patterns: [...]                        │
│                                                         │
│ Journey Contract:                                       │
│   journey_meta:                                         │
│     id: J-<FEATURE>-<NAME>                              │
│     covers_reqs: [REQ-001]                              │
│   steps:                                                │
│     - step: 1                                           │
│       required_elements: [...]                          │
│       expected: [...]                                   │
└─────────────────────────────────────────────────────────┘
```

---

**Next:** See `LLM-MASTER-PROMPT.md` to learn how LLMs use these contracts.
