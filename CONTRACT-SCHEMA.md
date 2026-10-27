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

- **Default contracts** (shipped with Specflow):
  - `security_defaults.yml` — SEC-xxx rules
  - `accessibility_defaults.yml` — A11Y-xxx rules
  - `test_integrity_defaults.yml` — TEST-xxx rules

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

Journey contracts define **Definition of Done (DOD)**. A feature is complete when its critical journeys pass.

```yaml
journey_meta:
  id: J-AUTH-REGISTER
  from_spec: "docs/specs/authentication.md"
  covers_reqs:
    - AUTH-001
    - AUTH-002
  type: "e2e"

  # DOD fields - journeys are your Definition of Done
  dod_criticality: critical    # critical | important | future
  status: passing              # passing | failing | not_tested
  last_verified: "2025-12-05"

# Preconditions: State that must exist BEFORE journey starts
# Extract from user language: "edit THEIR profile" → user logged in
preconditions:
  - description: "None - journey starts from blank state"
    setup_hint: null

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

### Journey WITH Preconditions

When user language implies required state, extract it as preconditions:

```yaml
journey_meta:
  id: J-ORDER-CANCEL
  from_spec: "docs/specs/orders.md"
  covers_reqs:
    - ORDER-003
  type: "e2e"
  dod_criticality: critical
  status: passing
  last_verified: "2025-12-05"

# User said: "cancel a PENDING order" → pending order must exist
preconditions:
  - description: "User has at least one pending order"
    setup_hint: "Call createPendingOrder(page) helper before journey steps"

steps:
  - step: 1
    name: "Open orders page"
    # ...
```

**Rule:** When generating E2E tests, create helper functions for each precondition.

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
| `behavior.allowed_domains` | string[] | ⚠️ | Lists of domains that URLs in code must reference (allowlist) |
| `behavior.forbidden_domains` | string[] | ⚠️ | Lists of domains that URLs in code must not reference (blocklist) |
| `behavior.example_violation` | string | ⚠️ | Code example showing violation |
| `behavior.example_compliant` | string | ⚠️ | Code example showing compliance |
| `auto_fix` | object | ⚠️ | Hints for the heal-loop agent to auto-fix violations (see below) |

⚠️ = Optional but highly recommended

#### Domain Allowlists and Blocklists

Use `allowed_domains` and `forbidden_domains` to enforce which domains may appear in code. This prevents accidental references to deprecated domains, staging environments, or placeholder URLs.

```yaml
behavior:
  allowed_domains:
    - "dash.tabstax.app"
    - "api.tabstax.app"
  forbidden_domains:
    - "app.tabstax.app"
    - "localhost:3000"
    - "example.com"
```

**Semantics:**
- `allowed_domains`: If specified, any URL in scoped files must reference one of these domains. URLs referencing other domains are violations.
- `forbidden_domains`: Any URL in scoped files referencing these domains is a violation.
- Both can be used together: `allowed_domains` acts as a whitelist, `forbidden_domains` acts as a blacklist for known-bad domains.

### auto_fix (Optional)

Provides hints to the `heal-loop` agent for automated contract violation fixes. Only used when the contract provides enough information to generate a safe, minimal fix.

```yaml
auto_fix:
  strategy: "add_import"          # Fix strategy (see table below)
  import_line: "import { authMiddleware } from '@/middleware/auth'"
  wrap_pattern: "router.use(authMiddleware)"
  find: "localStorage"            # For replace_with strategy
  replace: "chrome.storage.local" # For replace_with strategy
```

| Field | Type | Required | Description |
|-------|------|----------|-------------|
| `auto_fix.strategy` | string | ✅ | Fix strategy: `add_import`, `remove_pattern`, `wrap_with`, `replace_with` |
| `auto_fix.import_line` | string | ⚠️ | Import statement to add (for `add_import` strategy) |
| `auto_fix.wrap_pattern` | string | ⚠️ | Pattern to wrap existing code with (for `wrap_with` strategy) |
| `auto_fix.find` | string | ⚠️ | Text to find (for `replace_with` strategy) |
| `auto_fix.replace` | string | ⚠️ | Replacement text (for `replace_with` strategy) |

**Strategies:**

| Strategy | When to use | Example |
|----------|-------------|---------|
| `add_import` | A required import or declaration is missing | Add `import { authMiddleware } from '@/middleware/auth'` |
| `remove_pattern` | A forbidden pattern should be deleted | Remove `eval(...)` call |
| `wrap_with` | Existing code needs to be wrapped with a pattern | Add `authMiddleware` parameter to route handler |
| `replace_with` | A forbidden pattern has a known compliant alternative | Replace `localStorage` with `chrome.storage.local` |

**Example in context:**

```yaml
rules:
  non_negotiable:
    - id: AUTH-001
      title: "All protected API endpoints require authentication"
      scope:
        - "src/routes/**/*.ts"
      behavior:
        required_patterns:
          - pattern: /authMiddleware/
            message: "Must import and use authMiddleware"
        example_compliant: |
          router.get('/api/users', authMiddleware, async (req, res) => { ... })
      auto_fix:
        strategy: "add_import"
        import_line: "import { authMiddleware } from '@/middleware/auth'"
```

**When NOT to add auto_fix:** If the fix requires understanding business logic, involves complex refactoring, or could break functionality in non-obvious ways. The heal-loop agent will escalate violations without `auto_fix` hints rather than guessing.

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

### test_quality (Optional)

Defines patterns that indicate low-quality or suspicious tests. Used by the `e2e-test-auditor` and contract test runners to flag tests that may silently pass without verifying real behavior.

```yaml
test_quality:
  forbidden_test_patterns:
    - pattern: /expect\(\w+\)\.toHaveLength\(\d+\)\s*$/
      message: "Suspicious test - only checks array length"
    - pattern: /\/\/.*placeholder|will be enhanced/i
      message: "Test marked as placeholder"
    - pattern: /expect\(\w+\)\.toBe\((true|false)\)\s*$/
      message: "Suspicious test - only checks boolean without context"
    - pattern: /expect\(\w+\)\.toBeDefined\(\)\s*$/
      message: "Weak assertion - only checks existence, not correctness"
```

| Field | Type | Required | Description |
|-------|------|----------|-------------|
| `test_quality.forbidden_test_patterns` | object[] | ✅ | Patterns in test files that indicate suspicious or low-quality tests |
| `test_quality.forbidden_test_patterns[].pattern` | regex | ✅ | Regex to match against test file content |
| `test_quality.forbidden_test_patterns[].message` | string | ✅ | Explanation of why this pattern is suspicious |

### infrastructure (Optional)

Defines pre-release infrastructure checks that must pass before certain test phases run. Useful for verifying that deployment targets, health endpoints, and external dependencies are reachable before running E2E tests.

```yaml
infrastructure:
  pre_release_checks:
    - id: INFRA-001
      url: "https://example.com/health"
      expected_status: [200, 302]
      run_before: "e2e"
    - id: INFRA-002
      url: "https://api.example.com/status"
      expected_status: [200]
      run_before: "e2e"
      timeout_ms: 5000
```

| Field | Type | Required | Description |
|-------|------|----------|-------------|
| `infrastructure.pre_release_checks` | object[] | ✅ | List of infrastructure health checks |
| `infrastructure.pre_release_checks[].id` | string | ✅ | Unique check ID (e.g. `INFRA-001`) |
| `infrastructure.pre_release_checks[].url` | string | ✅ | URL to check |
| `infrastructure.pre_release_checks[].expected_status` | number[] | ✅ | HTTP status codes that indicate success |
| `infrastructure.pre_release_checks[].run_before` | string | ✅ | Test phase this check must pass before: `e2e`, `integration`, `smoke` |
| `infrastructure.pre_release_checks[].timeout_ms` | number | ⚠️ | Request timeout in milliseconds (default: 5000) |

### pre_implementation (Optional)

Configures checks that run before implementation begins. If using claude-flow, the `memory_query` section queries the memory system for past failures, contract gaps, and post-mortem learnings related to the current work.

```yaml
pre_implementation:
  memory_query:
    enabled: true
    warn_on_match:
      - tag: "contract-gap"
        action: "Review past failure before proceeding"
      - tag: "post-mortem"
        action: "Check if this area had previous production issues"
      - tag: "regression"
        action: "Verify regression test exists for this area"
```

| Field | Type | Required | Description |
|-------|------|----------|-------------|
| `pre_implementation.memory_query.enabled` | boolean | ✅ | Whether to query memory before implementation |
| `pre_implementation.memory_query.warn_on_match` | object[] | ✅ | Tags to search for and actions to take on match |
| `pre_implementation.memory_query.warn_on_match[].tag` | string | ✅ | Memory tag to search for (e.g. `contract-gap`, `post-mortem`) |
| `pre_implementation.memory_query.warn_on_match[].action` | string | ✅ | Action to take when a matching memory is found |

**Note:** The `pre_implementation.memory_query` section is optional and only active when using claude-flow with memory enabled. Projects without claude-flow can safely omit this section.

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

### Pattern Matching Semantics

**Critical distinction:**

| Pattern Type | Meaning |
|--------------|---------|
| `forbidden_patterns` | Must NOT match in ANY file in scope |
| `required_patterns` | Must match in AT LEAST ONE file in scope |

Example: If scope is `["src/api/**/*.js"]` and you have 5 files:
- `forbidden_patterns`: Fails if pattern found in ANY of the 5 files
- `required_patterns`: Passes if pattern found in AT LEAST ONE of the 5 files

### Pattern Tips

1. **Use regex syntax**: `/pattern/` format (language-agnostic regex)
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

### Scope Negation Syntax

Prefix a pattern with `!` to **exclude** matching files from the scope:

```yaml
scope:
  - "src/api/**/*.ts"
  - "!src/api/public/**"           # Exclude public API routes
  - "!src/api/__tests__/**"        # Exclude test files
  - "!**/*.test.ts"                # Exclude all test files
```

**Evaluation order matters:** Patterns are evaluated top-to-bottom. Include patterns first, then exclusions.

| Pattern | Effect |
|---------|--------|
| `"src/**/*.ts"` | Match all TypeScript files in src |
| `"!src/generated/**"` | Then exclude generated files |
| `"!**/*.d.ts"` | Then exclude type definition files |

**Common exclusion patterns:**

| Exclude | Pattern |
|---------|---------|
| Test files | `"!**/*.test.*"` or `"!**/__tests__/**"` |
| Generated code | `"!**/generated/**"` or `"!**/*.gen.*"` |
| Vendor/deps | `"!**/vendor/**"` or `"!**/node_modules/**"` |
| Config files | `"!**/config/**"` |

---

## 7. Journey Contract Schema

### journey_meta

| Field | Type | Required | Description |
|-------|------|----------|-------------|
| `id` | string | ✅ | Journey ID from spec (e.g. `J-AUTH-REGISTER`) |
| `from_spec` | string | ✅ | Path to source spec file |
| `covers_reqs` | string[] | ✅ | REQ IDs this journey validates |
| `type` | string | ✅ | Test type: `e2e`, `integration`, `smoke` |
| `dod_criticality` | string | ✅ | DOD level: `critical`, `important`, `future` |
| `status` | string | ✅ | Test status: `passing`, `failing`, `not_tested` |
| `last_verified` | string | ⚠️ | Date of last test run (ISO format) |
| `owner` | string | ⚠️ | Team or person responsible (e.g. `@alice`, `design-team`) |

### preconditions[]

| Field | Type | Required | Description |
|-------|------|----------|-------------|
| `description` | string | ✅ | Human-readable precondition (e.g. "User is logged in") |
| `setup_hint` | string | ⚠️ | Code hint for test setup (e.g. "Call loginUser(page)") |

**Extracting preconditions from user language:**

| User Says | Precondition |
|-----------|--------------|
| "cancel a **pending** order" | `pending order exists` |
| "edit **their own** profile" | `user is logged in` |
| "view **other** user's posts" | `multiple users with posts exist` |
| "checkout with **items in cart**" | `cart contains items` |

### DOD Criticality Levels

| Level | Meaning | Release Impact |
|-------|---------|----------------|
| `critical` | Core user flow | ❌ Blocks release if failing/not_tested |
| `important` | Key feature | ⚠️ Should fix before release |
| `future` | Planned feature | ✅ Can release without |

### timing (Optional but Recommended)

Document animation and async timing for accurate test generation:

```yaml
timing:
  animation_slide: 300      # ms - slide-out animations
  animation_fade: 200       # ms - fade transitions
  debounce_input: 150       # ms - input debounce
  api_timeout: 5000         # ms - API call timeout
  completion_animation: 600 # ms - success/completion effect
```

**Why timing matters:** Tests need accurate `waitForTimeout()` values. Without documented timing:
- Tests fail because they click before animations complete
- Flaky tests due to race conditions
- Hard-to-debug "works locally, fails in CI" issues

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

## CSV Source Format (Team Workflows)

Journey contracts can be authored in CSV format by product designers, then compiled to YAML + Playwright stubs using `specflow-compile`.

### CSV Column Schema

```csv
journey_id,journey_name,step,user_does,system_shows,critical,owner,notes
```

| Column | Maps To | Required | Validation |
|--------|---------|----------|------------|
| `journey_id` | `journey_meta.id` | Yes | Must match `/^J-[A-Z][A-Z0-9-]+$/` |
| `journey_name` | Step group display name | Yes | Non-empty |
| `step` | `steps[].step` | Yes | Sequential integers starting at 1 per journey |
| `user_does` | `steps[].name` + action description | Yes | Non-empty |
| `system_shows` | `steps[].expected` description | Yes | Non-empty |
| `critical` | `journey_meta.dod_criticality` | Yes | `yes` = critical, `no` = important |
| `owner` | `journey_meta.owner` | Yes | Non-empty (e.g. `@alice`) |
| `notes` | `acceptance_criteria[]` | No | Free text, added as acceptance criteria |

### Compile Command

```bash
npm run compile:journeys -- path/to/journeys.csv
```

**Output:**
- `docs/contracts/journey_*.yml` — one journey contract per `journey_id`
- `tests/e2e/journey_*.spec.ts` — Playwright test stubs per `journey_id`

See `templates/journeys-template.csv` for a ready-to-use template.

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

### Example 3: Journey Contract (with DOD)

```yaml
journey_meta:
  id: J-CHECKOUT
  from_spec: "docs/specs/checkout.md"
  covers_reqs:
    - CART-001
    - PAY-002
  type: "e2e"

  # DOD: This journey defines when checkout feature is "done"
  dod_criticality: critical    # Cannot release without this passing
  status: passing              # Currently green
  last_verified: "2025-12-05"

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
  required_patterns:
    - "/page\\.goto|request\\.(get|post|put|delete)/"
    - "/expect.*to(Contain|Equal|Be)/"
  forbidden_patterns:
    - "/test\\.skip/"
    - "/jest\\.fn|vi\\.fn|mock/"
```

### Test Honesty Fields

| Field | Required | Description |
|-------|----------|-------------|
| `e2e_test_file` | Yes | Path to the Playwright test file |
| `required_patterns` | No | Regex patterns the test file MUST contain (e.g., `page.goto`, `expect`) |
| `forbidden_patterns` | No | Regex patterns the test file MUST NOT contain (e.g., `test.skip`, `mock`) |

**Why:** A test file that exists but skips all tests, mocks everything, or only does regex scans over source code does not satisfy the journey contract. These fields let the hook verify test honesty before and after execution.

`run-journey-tests.sh` checks these patterns before running tests. If a required pattern is missing or a forbidden pattern is found, the hook exits 2 (fail) with a specific error message.

---

## 9. Contract Index (CONTRACT_INDEX.yml)

Every project should have a `docs/contracts/CONTRACT_INDEX.yml` that tracks all contracts and their relationships.

### Purpose

- **Central registry** of all contracts
- **Coverage matrix** showing which REQs are covered
- **DOD status** at a glance
- **Gap identification** for uncovered requirements

### Schema

```yaml
# docs/contracts/CONTRACT_INDEX.yml
metadata:
  project: [project_name]
  version: [index_version]
  total_contracts: [count]
  total_requirements: "[X] MUST, [Y] SHOULD"
  total_journeys: [count]

# Definition of Done Summary
definition_of_done:
  critical_journeys:
    - J-[FEATURE]-[NAME]    # Must pass to release
  important_journeys:
    - J-[FEATURE]-[NAME]    # Should pass before release
  future_journeys:
    - J-[FEATURE]-[NAME]    # Can release without

  release_gate: |
    All critical journeys must have status: passing
    before release is allowed.

contracts:
  # Feature Contracts (Architecture + Features)
  - id: feature_architecture
    file: feature_architecture.yml
    status: active
    covers_reqs:
      - ARCH-001
      - ARCH-002
    summary: "Package layering, API isolation, size limits"

  - id: feature_[name]
    file: feature_[name].yml
    status: active
    covers_reqs:
      - [FEAT]-001
    summary: "[Brief description]"

  # Journey Contracts
  - id: J-[FEATURE]-[NAME]
    file: journey_[name].yml
    status: active
    type: e2e
    dod_criticality: critical
    dod_status: passing
    covers_reqs:
      - [FEAT]-001
    summary: "[User flow description]"
    e2e_test: "tests/e2e/journey_[name].spec.ts"

# Requirements Coverage Matrix
requirements_coverage:
  ARCH-001: feature_architecture
  ARCH-002: feature_architecture
  AUTH-001: [feature_auth, J-AUTH-LOGIN]
  AUTH-002: feature_auth

# Uncovered Requirements (gaps to fill)
uncovered_requirements:
  - AUTH-005  # No contract yet

uncovered_journeys:
  - J-AUTH-PASSWORD-RESET  # No E2E test yet

test_files:
  - path: "src/__tests__/contracts/*.test.js"
    covers: [ARCH-001, ARCH-002, AUTH-001]
  - path: "tests/e2e/journey_*.spec.ts"
    covers: [J-AUTH-LOGIN, J-AUTH-REGISTER]
```

### Example

```yaml
# docs/contracts/CONTRACT_INDEX.yml
metadata:
  project: chat2repo
  version: 2
  total_contracts: 7
  total_requirements: "16 MUST, 3 SHOULD"
  total_journeys: 8

definition_of_done:
  critical_journeys:
    - J-CHATGPT-QUICKSEND
    - J-ERROR-NOCONFIG
  important_journeys:
    - J-CHATGPT-DETAILED
    - J-WEB-QUICKSEND
  future_journeys:
    - J-AUTH-2FA

  release_gate: |
    All critical journeys must have status: passing
    before release is allowed.

contracts:
  - id: feature_architecture
    file: feature_architecture.yml
    status: active
    covers_reqs: [ARCH-001, ARCH-002, ARCH-003]
    summary: "Package layering, GitHub API isolation, file size limits"

  - id: feature_security
    file: feature_security.yml
    status: active
    covers_reqs: [SEC-001, SEC-002, SEC-003]
    summary: "PAT storage, secret protection, permissions"

  - id: J-CHATGPT-QUICKSEND
    file: journey_chatgpt_quicksend.yml
    status: active
    type: e2e
    dod_criticality: critical
    dod_status: passing
    covers_reqs: [UX-002, MD-001]
    summary: "ChatGPT quick send flow"
    e2e_test: "tests/e2e/journey_chatgpt_quicksend.spec.ts"

requirements_coverage:
  ARCH-001: feature_architecture
  ARCH-002: feature_architecture
  SEC-001: [feature_security, J-ERROR-NOCONFIG]
  UX-002: [feature_ux, J-CHATGPT-QUICKSEND]

uncovered_journeys:
  - J-WEB-DETAILED
  - J-ERROR-RATELIMIT
```

### Usage

**Check coverage gaps:**
```bash
# Find uncovered requirements
grep "uncovered" docs/contracts/CONTRACT_INDEX.yml
```

**Verify DOD status:**
```bash
# Check all critical journeys pass
grep -A5 "critical_journeys" docs/contracts/CONTRACT_INDEX.yml
```

---

## 10. Contract Lifecycle

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

## 11. Waivers

When a MUST rule cannot be enforced yet, the gap must be recorded as an explicit waiver — not silently downgraded to a warning via threshold logic.

### Schema

Add a `waivers` section to any contract YAML:

```yaml
waivers:
  - invariant_id: SEC-003
    reason: "Legacy template uses dangerouslySetInnerHTML with DOMPurify — requires refactor"
    tracking_issue: "#234"
    owner: "@username"
    expires: "2026-06-01"
    approved_by: "human (override_contract: security_defaults)"
```

### Fields

| Field | Required | Description |
|-------|----------|-------------|
| `invariant_id` | Yes | The rule ID being waived |
| `reason` | Yes | Why the waiver exists |
| `tracking_issue` | Yes | Issue number tracking the fix |
| `owner` | Yes | Who is responsible for resolving it |
| `expires` | Yes | Date the waiver must be revisited |
| `approved_by` | Yes | Who approved the waiver (must be human) |

### Rules

- A MUST test that allows N violations **must** have a waiver entry for each
- Tests without waiver entries must hard-fail on any MUST violation
- Expired waivers should be treated as failures by the graph validator
- The graph validator (#449) checks waiver entries exist for threshold-based tests

---

## 12. Monorepo Strategy

For monorepo projects with multiple packages (e.g., `backend/`, `frontend/`):

### Option A: Single Root (Recommended)

One `docs/contracts/` at the repo root. All contracts live there. Per-package tests reference the shared contracts.

```
repo/
  docs/contracts/         ← single source of truth
    feature_auth.yml
    journey_login.yml
    CONTRACT_INDEX.yml
  backend/
    src/__tests__/contracts/   ← tests reference ../../../docs/contracts/
  frontend/
    src/__tests__/contracts/
```

**Pros:** No drift. One CONTRACT_INDEX.yml. One place to update.
**Cons:** Per-package contract isolation lost.

### Option B: Per-Package with Sync Check

Each package has its own `docs/contracts/` with package-specific contracts. Shared defaults are copied from a template and validated by hash.

```
repo/
  docs/contracts/                  ← shared defaults template
    security_defaults.yml
    CONTRACT_INDEX.yml             ← references all packages
  backend/docs/contracts/          ← backend-specific + copied defaults
    feature_api.yml
    security_defaults.yml          ← must match root hash
  frontend/docs/contracts/         ← frontend-specific + copied defaults
    journey_login.yml
    security_defaults.yml          ← must match root hash
```

Add a sync check to CI:

```bash
# Verify shared defaults haven't drifted
for pkg in backend frontend; do
  for default in security_defaults.yml accessibility_defaults.yml; do
    if [ -f "$pkg/docs/contracts/$default" ]; then
      diff -q "docs/contracts/$default" "$pkg/docs/contracts/$default" || {
        echo "DRIFT: $pkg/docs/contracts/$default differs from root"
        exit 1
      }
    fi
  done
done
```

### CONTRACT_INDEX.yml for Monorepos

```yaml
metadata:
  project: my-monorepo
  packages:
    - name: backend
      contracts_dir: backend/docs/contracts/
    - name: frontend
      contracts_dir: frontend/docs/contracts/

contracts:
  - id: feature_api
    file: backend/docs/contracts/feature_api.yml
    package: backend
  - id: journey_login
    file: frontend/docs/contracts/journey_login.yml
    package: frontend
```

---

## 13. ADR Frontmatter Schema

To make Architecture Decision Records first-class nodes in the contract graph, ADRs should carry YAML frontmatter:

```yaml
---
adr_id: ADR-001
title: "Use chrome.storage.local instead of localStorage in service worker"
status: accepted  # proposed | accepted | deprecated | superseded
date: 2026-03-01
invariants:
  - I-SEC-001
  - I-PAR-002
feature_contracts:
  - feature_auth.yml
journey_contracts:
  - journey_login.yml
superseded_by: null  # ADR-xxx if superseded
---

## Context
...
```

### Fields

| Field | Required | Description |
|-------|----------|-------------|
| `adr_id` | Yes | Unique ADR identifier (e.g., `ADR-001`) |
| `title` | Yes | One-line summary of the decision |
| `status` | Yes | `proposed`, `accepted`, `deprecated`, `superseded` |
| `date` | Yes | Date the decision was made |
| `invariants` | No | Invariant IDs this ADR establishes or enforces |
| `feature_contracts` | No | Contract files that implement this decision |
| `journey_contracts` | No | Journey files that verify this decision |
| `superseded_by` | No | ADR ID if this decision has been replaced |

### Graph Validator Checks

When the graph validator runs, it should verify:
- All `invariants` listed exist in CONTRACT_INDEX.yml
- All `feature_contracts` and `journey_contracts` point to real files
- `deprecated` ADRs have a `superseded_by` reference
- Invariants claimed by ADRs actually appear in the referenced contracts

---

## 14. Quick Reference

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
│ Journey Contract (= Definition of Done):                │
│   journey_meta:                                         │
│     id: J-<FEATURE>-<NAME>                              │
│     covers_reqs: [REQ-001]                              │
│     dod_criticality: critical | important | future      │
│     status: passing | failing | not_tested              │
│   steps:                                                │
│     - step: 1                                           │
│       required_elements: [...]                          │
│       expected: [...]                                   │
│                                                         │
│ DOD Rule: Critical journeys must pass before release    │
└─────────────────────────────────────────────────────────┘
```

---

## 15. Contract → Test Transformation

This section shows how to transform contract rules into executable tests. The pseudocode is language-agnostic.

### Algorithm (Pseudocode)

```
FOR each contract_file IN contracts_directory:
    contract = parse_yaml(contract_file)

    FOR each rule IN contract.rules.non_negotiable:
        files = glob(rule.scope)
        files = exclude_negated_patterns(files, rule.scope)

        # Check forbidden patterns
        FOR each pattern IN rule.behavior.forbidden_patterns:
            FOR each file IN files:
                content = read_file(file)
                matches = regex_find_all(pattern.pattern, content)
                IF matches NOT EMPTY:
                    FAIL("CONTRACT VIOLATION: {rule.id} - {pattern.message}")
                    REPORT(file, line_number, match)

        # Check required patterns
        FOR each pattern IN rule.behavior.required_patterns:
            found_in_any_file = FALSE
            FOR each file IN files:
                content = read_file(file)
                IF regex_match(pattern.pattern, content):
                    found_in_any_file = TRUE
                    BREAK
            IF NOT found_in_any_file:
                FAIL("CONTRACT VIOLATION: {rule.id} - {pattern.message}")
```

### Language Implementation Table

| Operation | JavaScript | Python | Go | Rust |
|-----------|------------|--------|-----|------|
| Parse YAML | `yaml.load(fs.readFileSync(f))` | `yaml.safe_load(open(f))` | `yaml.Unmarshal(data, &c)` | `serde_yaml::from_str(&s)` |
| Glob files | `glob.sync(pattern)` | `glob.glob(pattern)` | `filepath.Glob(pattern)` | `glob::glob(pattern)` |
| Read file | `fs.readFileSync(f, 'utf8')` | `open(f).read()` | `os.ReadFile(f)` | `std::fs::read_to_string(f)` |
| Regex match | `new RegExp(p).test(s)` | `re.search(p, s)` | `regexp.MatchString(p, s)` | `Regex::new(p).is_match(s)` |
| Find all matches | `s.matchAll(new RegExp(p, 'g'))` | `re.finditer(p, s)` | `re.FindAllString(s, -1)` | `re.find_iter(s)` |
| Test assertion | `expect(x).toBe(y)` | `assert x == y` | `t.Errorf(...)` | `assert_eq!(x, y)` |

### Minimal Test Template (Pseudocode → Any Language)

```
FUNCTION test_contract(contract_path):
    contract = parse_yaml(contract_path)
    violations = []

    FOR each rule IN contract.rules.non_negotiable:
        files = get_files_in_scope(rule.scope)

        FOR each forbidden IN rule.behavior.forbidden_patterns:
            FOR each file IN files:
                IF pattern_found_in_file(forbidden.pattern, file):
                    violations.append({
                        rule_id: rule.id,
                        file: file,
                        pattern: forbidden.pattern,
                        message: forbidden.message
                    })

        FOR each required IN rule.behavior.required_patterns:
            IF NOT pattern_found_in_any_file(required.pattern, files):
                violations.append({
                    rule_id: rule.id,
                    pattern: required.pattern,
                    message: required.message
                })

    IF violations NOT EMPTY:
        FOR each v IN violations:
            PRINT("CONTRACT VIOLATION: {v.rule_id} - {v.message}")
        FAIL_TEST()
    ELSE:
        PASS_TEST()
```

### Test Output Format

Contract test output MUST follow this format for tooling compatibility:

```
CONTRACT VIOLATION: <REQ-ID> - <message>
  File: <path>
  Line: <number>
  Match: <matched_text>
```

Example:
```
CONTRACT VIOLATION: AUTH-001 - API route missing authMiddleware
  File: src/routes/users.ts
  Line: 42
  Match: router.get('/api/users', async (req, res) => {
```

---

## 13. Default Contract Templates

Specflow ships default contract templates for security, accessibility, test integrity, and production readiness. Copy these into your project's `docs/contracts/` directory.

### Location

```
templates/contracts/
  security_defaults.yml              # SEC-001 through SEC-005
  accessibility_defaults.yml         # A11Y-001 through A11Y-004
  test_integrity_defaults.yml        # TEST-001 through TEST-005
  production_readiness_defaults.yml  # PROD-001 through PROD-003
```

### Rule ID Prefixes

| Prefix | Contract Type | Purpose |
|--------|---------------|---------|
| `ARCH-xxx` | Architecture | Structural invariants (package boundaries, forbidden APIs) |
| `FEAT-xxx` | Feature | Business rules (validation, auth, data handling) |
| `SEC-xxx` | Security | OWASP Top 10 patterns (secrets, injection, XSS) |
| `A11Y-xxx` | Accessibility | WCAG AA compliance (alt text, labels, focus) |
| `TEST-xxx` | Test integrity | No-mock enforcement, anti-pattern detection |
| `PROD-xxx` | Production readiness | No demo data, domain allowlists, no hardcoded IDs |
| `J-xxx` | Journey | User flow DOD (E2E browser tests) |

### Security Rules (SEC-xxx)

| Rule | What it catches |
|------|----------------|
| SEC-001 | Hardcoded secrets (API keys, tokens, private keys) |
| SEC-002 | Raw SQL string concatenation (injection risk) |
| SEC-003 | Unsanitized innerHTML/dangerouslySetInnerHTML (XSS) |
| SEC-004 | eval() and Function constructor (code injection) |
| SEC-005 | Path traversal in file operations |

### Accessibility Rules (A11Y-xxx)

| Rule | What it catches |
|------|----------------|
| A11Y-001 | Images without alt text |
| A11Y-002 | Icon-only buttons without aria-label |
| A11Y-003 | Form inputs without associated labels |
| A11Y-004 | Positive tabindex values (disrupts tab order) |

### Test Integrity Rules (TEST-xxx)

| Rule | What it catches | Configurable |
|------|----------------|-------------|
| TEST-001 | Mocking in E2E tests | Yes — default ON |
| TEST-002 | Mocking in journey tests | Yes — default ON |
| TEST-003 | Silent test anti-patterns | No — always enforced |
| TEST-004 | Suspicious test patterns (length-only checks, weak assertions) | No — always enforced |
| TEST-005 | Placeholder test markers (TODO, placeholder comments) | No — always enforced |

### Production Readiness Rules (PROD-xxx)

| Rule | What it catches |
|------|----------------|
| PROD-001 | Demo/mock data in production code (DEMO_USER, DEMO_PLAN, MOCK_*, fake data) |
| PROD-002 | Placeholder domains (example.com, localhost, changeme.*) |
| PROD-003 | Hardcoded IDs in production code (UUIDs, user_id, tenant_id, org_id) |

### Configurable Defaults

TEST-001 and TEST-002 can be overridden per-project in `.specflow/config.json`:

```json
{
  "contract_defaults": {
    "test_integrity": {
      "no_mock_in_e2e": true,
      "no_mock_in_journey": true,
      "no_mock_in_unit": false,
      "allowed_mock_patterns": ["stripe", "twilio"]
    }
  }
}
```

### Using Default Templates

```bash
# Copy defaults to your project
cp Specflow/templates/contracts/security_defaults.yml docs/contracts/
cp Specflow/templates/contracts/accessibility_defaults.yml docs/contracts/
cp Specflow/templates/contracts/test_integrity_defaults.yml docs/contracts/
cp Specflow/templates/contracts/production_readiness_defaults.yml docs/contracts/

# Update scope patterns for your project structure
# Then run contract tests
npm test -- contracts
```

### Attribution

Default security, accessibility, test integrity, and production readiness gate concepts adapted from
[forge](https://github.com/ikennaokpala/forge) by Ikenna N. Okpala, which
enforces 7 quality gates before any commit. Quality gate framework originated in
V3 QE Skill by Mondweep Chakravorty. No-mock philosophy from Ikenna's Continuous
Behavioral Verification work. Agentic QE by Dragan Spiridonov provides specialized
accessibility and security auditor agents.

---

## 14. Extensions for Parallel Execution

For projects using **Dependency-Based Parallel Agent Orchestration (DPAO)**, see:

**[CONTRACT-SCHEMA-EXTENSIONS.md](CONTRACT-SCHEMA-EXTENSIONS.md)** - Parallel execution enhancements

This document adds 3 critical extensions that reduce agent failure rates from 11% to <5%:

1. **Anti-Patterns Section** - Prevents wrong library usage (e.g., shadcn UI in native HTML projects)
2. **Completion Verification Checklist** - Agents verify files committed before reporting done
3. **Parallel Coordination Rules** - Prevents premature exports/imports during parallel work

These extensions are proven to save 3-4 hours per 9-issue wave by catching common failures early.

---

**Next:** See `LLM-MASTER-PROMPT.md` to learn how LLMs use these contracts.

### Parent outcome extension (OC-001..006, #132)

The existing `verification-contract.json` may contain `outcome_contract` v1.
The executable strict schemas are `outcomeSchema` and `bindingSchema` in
`scripts/outcome-contract.cjs`; unknown outcome fields are rejected. The same
accepted verifier decision ledger binds normative content. Old bounded slice
contracts remain usable; their parent readiness is explicitly `migration_required`.
Do not claim those old contracts cover a parent goal.

```yaml
# Inside the existing accepted verification contract (JSON at runtime).
outcome_contract:
  version: 1
  goal: Transform an agreed input file exactly
  configurations: [{id: local-node, environment: isolated-node}]
  assumptions: []
  unknowns: []
  non_goals: [Product financial calculations]
  obligations:
    - id: O-CLI
      required: true
      oracle: {path: tests/expected.json, sha256: "<64 lowercase hexadecimal characters>"}
      check_ids: [C-CLI]
      level: process
      configuration_ids: [local-node]
runtime_checks:
  - id: C-CLI
    type: custom-script
    required: true
    command: node tests/verify-transform.cjs
    verification_level: process
    configuration_ids: [local-node]
    checker_paths: [tests/verify-transform.cjs]
    input_paths: [tests/input.txt]
    rule_paths: []
```

IDs and path lists are unique and nonempty where required. Each referenced check
must exist, retain requiredness and match the obligation's level and supported
configurations. Levels are `unit`, `process`, `integration`, `journey`; local unit
checks cannot replace an integrated check. File references are repository-relative
regular files; bindings reject traversal, missing files and symlinks. An oracle
hash identifies reviewed bytes, not semantic independence. Execute a deliberately
wrong-result counterexample against independently reviewed fixed expectations.

Use existing YAML coverage references, adding only their check join:

```yaml
contract_meta: # journey_meta may use the same fields
  id: transform
  owner: cli-team
  covers_reqs: [O-CLI]
  check_ids: [C-CLI]
```

`node scripts/verify-graph.cjs docs/contracts --verification-contract FILE`
(or `specflow graph ...`) validates this coverage alongside the existing graph.
A run contract's optional `verification_contract_path: FILE` makes the existing
spec-build Gate B registry invoke that same consumer. Planned owned checks need
not have implementation files before coding. Graph coverage is planning proof.

A current evidence binding contains version 1, `contract_sha256`, `source_sha256`,
`configuration_id`, `environment` and a `files` map of relevant path/SHA-256 pairs.
The source identity reuses the current snapshot fingerprint (HEAD, dirty tree,
index, unignored source). Explicit oracle/input/rule/checker hashes also cover
relevant ignored files. A binding consumer compares every field against a newly
computed binding; unsupported environment/configuration, absent and stale evidence
stay non-passing. Equal output does not excuse a changed input. Supply the selected
configuration/environment when running the verifier. Routine source/input reruns
under unchanged accepted expectations do not need another owner decision.

Acceptance records `contract_sha256` and `outcome_sha256` in the existing ledger.
The latest verifier decision must still be acceptance; editing the accepted file
while retaining its timestamp cannot restore readiness. Revisions of an accepted
outcome use the existing detached owner authorization: pass `amendment` with
`record`, `commentId`, `signatureFile` to `decideVerification`. The verified
scope-bound owner reason must also contain
`outcome-amendment:<old outcome hash>:<new outcome hash or none>`. A name, boolean
or maker-written GitHub comment is insufficient. Rejected attempts retain history.

The shared extension establishes declarations, coverage and freshness. Owning
case-level runtime collection (#44), independent comparison semantics (#70),
data seams (#133), final Gate D acceptance (#73) and installed proof (#124) remain
separate consumers. The owning execution consumer requires native case inventory and current receipts;
a missing consumer or inventory blocks with the required check IDs. `specflow run trace` exposes this distinction. Do not equate
planned, bound, executed, accepted, merged, published and installed statuses.

The existing trace recomputes the last stored binding and exposes `binding_status`
(`current`, `stale`, `missing`, `unsupported`) alongside the still-unverified parent
status. This does not label the binding as execution evidence. Changing only the
execution command or relevant input/checker files can receive fresh independent
verifier acceptance without a new owner checkpoint when obligations, references
and support scope remain unchanged; the full accepted-contract identity still
invalidates old evidence.

Shared per-obligation states are strictly `missing`, `failed`, `stale`,
`unsupported`, `waived`, `passed`. Coverage separately reports
`coverage_status: planned|missing`; planned coverage has no executed pass.
`projectObligations` only aggregates owning-consumer states and cannot grant
parent acceptance. The runner and trace record a human skip as `waived`, retain
stale/unsupported bindings, and leave parent acceptance unverified. Owning check
provenance remains #44's responsibility and final acceptance remains #73's.

The published package supplies the schema dependency. A copied legacy project
loads it only when selecting an outcome contract; if it is unavailable, parent
readiness blocks with the exact dependency repair. Existing legacy helpers do
not gain a new unconditional dependency. Complete installed-host setup remains
part of #124's qualification.

### Owning native case execution (TE-001..006, #44)

The accepted verification contract now supplies the native case inventory for
each runtime check. `scripts/test-execution.cjs:validate` is the executable
schema and semantic validator. Its strict `execution` object has exactly these
fields:

```yaml
runtime_checks:
  - id: C-CLI
    type: custom-script
    required: true
    verification_level: process
    boundaries: [process, filesystem]
    configuration_ids: [local-node]
    checker_paths: [tests/cli.test.js]
    input_paths: [tests/input.txt]
    rule_paths: []
    execution:
      adapter: jest
      test_files: [tests/cli.test.js]
      required_case_ids: ["tests/cli.test.js::CLI transforms the fixture"]
      optional_case_ids: []
      args: []
```

Adapters are `jest` and `playwright`; the project supplies that native framework.
Test files are unique, existing repository-relative files included in
`checker_paths`. Required and optional case inventories are unique and disjoint;
required checks need at least one required case. Accepted levels are `static`,
`unit`, `process`, `integration`, `journey`; parent obligations retain #132's
level/configuration requirements. `boundaries` is a nonempty unique list of
reviewed exercised boundaries. The native report cannot upgrade these declarations.
Actual boundary coverage and independent assertions require review and relevant
real-environment checks; case accounting alone does not establish them.

Jest IDs are `relative-file::native fullName`. Playwright IDs are
`project-name-or-default::relative-file::describe > test title`. Duplicate full
identities block; parameterized tests need distinct names (include parameters or
an index). Pending/todo/disabled/skipped required cases, unknown statuses, zero
collection, missing IDs, unaccounted cases or inconsistent native counts block.
An assertion failure fails. Accepted optional skips remain `skipped` while the
required scope can pass. Native retries retain every attempt status and the `flaky` classification; a
final passing case can satisfy the accepted native retry configuration. An
expected-failure annotation cannot fabricate passing required behaviour.

The owning adapter resolves the actual native framework, uses fresh private
report/cache/artifact locations, controls reporting arguments and executes it.
The legacy `command` field cannot replace that native invocation. Listing,
watching, snapshot-update and report-output overrides are unavailable as native
execution arguments. Native entry/version/digest, actual command, times, exit,
host identity, before/after bindings, raw report/log hashes and case results are
retained in existing `runtime-evidence`, findings and ledger artifacts. Native
assertion expected/actual details remain in the private raw report where present.
Generated runtime evidence must be ignored by Git; the installers add
`.specflow/runs/`. No browser binary is needed for a process-level CLI journey.

A process-local owning receipt is bound to its invocation. Submitting JSON or
replaying an old receipt does not create a new execution. Changed durable
artifacts, relevant source/inputs/checkers/environment, changed acceptance or a
later rejection blocks consumption. Findings are reconciled after the whole
attempt so a later check cannot silently invalidate an earlier input. Persisted
receipts remain historical evidence; they do not authenticate themselves after
process restart. Existing CI uses the shared native report validator within its
owning workflow and retains raw report artifacts. The validator alone grants no
runtime or parent acceptance, and this change adds no CI dispatch permission.

Use the existing runner for a fresh authorised verification:

```bash
specflow run verify --run-dir .specflow/runs/my-slice \
  --configuration-id local-node --environment isolated-node
```

It uses the accepted verification contract, returns nonzero for unproven required
behaviour and records a fresh attempt. Its rerun command never overwrites a prior
native report. A legacy check without native adapter/case metadata gets an
explicit migration blocker; accept revised execution metadata through the
existing lifecycle. Unchanged obligations/oracles/support scope add no new owner
checkpoint. Low-level supplied-state unit fixtures are labelled `supplied_state`
and cannot qualify the actual owning verifier stage.

For the existing journey hook, declare the same mapping in its YAML:

```yaml
journey_meta:
  id: J-CLI
  verification_level: process
  boundaries: [process, filesystem]
test_hooks:
  e2e_test_file: tests/cli.test.js
  execution:
    adapter: jest
    required_case_ids: ["tests/cli.test.js::CLI transforms the fixture"]
    optional_case_ids: []
    args: []
```

The hook adds the contract and test files to checker bindings. Optional
`test_hooks.checker_paths`, `input_paths`, `rule_paths` use the same validated path
arrays. Failed issue discovery, missing/ambiguous contracts or tests, missing
native inventory and required deferrals block. Legacy global deferral emits
`deferred/not_run` and permits hook continuation without passing verification.
Explicit required/forbidden source patterns remain labelled static checks;
navigation/mock syntax scans no longer certify runtime behaviour. The installed
helper and source hook consume the same native accounting. Full released and
supported-host installation qualification remains #124.

Native checks default to a 120-second process bound; an explicit positive
`timeout_seconds` selects a different bound. Timeouts report that exact guard
and retain the partial artifacts. This runtime bound is separate from monetary
or review policy.

Improve currently has a separate **frozen atomic checker** boundary: an
independently authored private oracle is executed before and after the change,
and its command, artifact, workspace and results are bound by the existing
Improve receipts. Its low-level `supplied_state` findings are projections,
reconciled against that frozen inventory and selected receipt before deciding.
They are not native suite case receipts and do not establish that every case
inside a wrapped test suite ran. Improve rejects `check.execution` and
`dev_check.execution` rather than ignoring a requested native inventory.
Native suite integration into the private holdout path is tracked by #178 and
is required before claiming that protection for Improve product qualification.
Existing scientific/custom atomic oracles remain supported at their declared
evidence strength; their numeric Improve levels are not native boundary levels.

## Independent value comparisons (#70)

Native execution alone does not establish that a business result is correct.
For each required value-bearing outcome, declare `value_bearing: true`, an
independently reviewed expected-reference method, and a comparison matrix inside
its existing `outcome_contract.obligations[].oracle`. This location binds the
pointer, operator, tolerance and native case mapping to the same protected oracle
amendment as its bytes. Changing execution plumbing still uses normal independent
verifier acceptance; lowering the expected rule requires the existing authority.

This is an excerpt of the existing outcome/check shapes; all named companion
checks must also be supplied with their native inventory and ordinary bindings:

```json
{
  "obligation": {
    "id": "O-AMOUNT", "required": true, "value_bearing": true,
    "required_claims": ["correctness", "provenance", "consistency"],
    "check_ids": ["C-correctness", "C-provenance", "C-consistency"],
    "level": "process", "configuration_ids": ["local"],
    "oracle": {
      "path": "fixtures/expected.json", "sha256": "<accepted file SHA-256>",
      "method": {"kind": "independent_fixture", "reference": "Reviewed independent derivation and its source"},
      "comparisons": [{
        "id": "CV-AMOUNT", "check_id": "C-correctness",
        "case_id": "tests/amount.test.js::computes the accepted input",
        "expected_pointer": "/amount", "operator": "exact"
      }]
    }
  },
  "correctness_check_execution": {
    "adapter": "jest", "test_files": ["tests/amount.test.js"],
    "required_case_ids": ["tests/amount.test.js::computes the accepted input"],
    "optional_case_ids": [], "args": [],
    "claim_kind": "correctness", "comparison_ids": ["CV-AMOUNT"]
  }
}
```

Required claims include correctness and provenance. Include consistency when
there are applicable consumers/persisted counterparts; otherwise record an
accepted `consistency_not_applicable_reason`. Each required claim maps to its own
required executed check with `execution.claim_kind`. Correctness checks select
an exact `execution.comparison_ids` subset of the protected matrix. IDs must join
accepted required native cases. Unknown, duplicated, dropped or unused mappings
block. Older strict runtimes reject the capability rather than ignoring it.
Declared value-bearing work without this mapping cannot qualify through legacy
provenance declarations or an otherwise passing native test.

The executor supplies a fresh private `SPECFLOW_OBSERVATIONS_PATH`. A reviewed
native test runs the real contracted boundary and writes an observation array:

```json
[{"comparison_id":"CV-AMOUNT","actual":900}]
```

The executor reads the already hash-bound expected artifact and compares actual
values itself. Observations cannot supply a pass verdict or alternate expected
value. Missing/unknown/duplicate observations, unsafe files, a skipped required
native case or an ambiguous retry cannot pass. The raw observation hash and
expected/actual comparison results are part of the existing execution receipt;
editing a saved observation invalidates ownership. An independently supplied
observation file or parser result has no execution authority.

The first expected-reference adapter is JSON with strict JSON Pointer escaping.
Missing is distinct from present `null`; object order is irrelevant, array order
and JSON types are significant, and values are never coerced. `exact` forbids a
tolerance. `numeric` requires finite numeric operands and an explicit finite,
nonnegative `absolute_tolerance`, with an inclusive bound. No default epsilon,
relative tolerance, decimal library or undeclared normalisation is implied.

Comparison cases currently require one unambiguous native invocation. Multiple
Jest invocations or Playwright result attempts block the comparison with the
specific ambiguity, while retaining native history. A fresh outer verification
attempt remains supported. Native checks without comparisons retain #44's
accepted retry accounting. These are evidence-correlation limits, separate from
subscription effort or monetary policy.

`proof_claims` reports correctness, provenance and consistency separately in the
runner/trace. A wrong answer can have passing provenance and consistency; that
still fails correctness. Provenance checks exercise the permitted input through
the actual transformation/output; consistency checks include applicable record
identity/version as well as the value. Stale bindings and explicit waivers stay
visible. This projection does not grant the final parent acceptance owned by #73.

`provenance-gate.cjs` remains structural declaration/diff lint. Its exact legacy
success statuses are `pass` and `passed`; prefixes, suffixes and uppercase aliases
are invalid. Valid declarations do not authenticate runtime correctness. Reviewed
synthetic inputs and independent expected literals are legitimate isolated
oracles. Static literal/mock scans identify review risks; they cannot certify or
reject actual boundary coverage by themselves. Prohibited substitutions remain
insufficient for a required real integration path.

An accepted method/reference and immutable file hash do not mechanically prove
that the author derived an oracle independently. The independent verifier must
review that derivation and challenge circular references and constant-answer
counterexamples. An authorised amendment alone does not refresh old evidence:
rerun the affected current native comparisons. Improve's private native-holdout
bridge remains tracked by #178; this schema does not silently enable it.

## Declared data seams (#133)

Legacy ticket arrays with string `writes`/`reads` keep their route/test-id meaning.
Data interfaces opt into a versioned envelope shared by the seam and ADR readers:

```json
{
  "version": 2,
  "tickets": [
    {"id":"producer","writes":[{"interface_id":"calculation","schema_ref":{"adapter":"json-interface-v1","path":"schemas/producer.json","pointer":""}}],"reads":[]},
    {"id":"consumer","writes":[],"reads":[{"interface_id":"calculation","schema_ref":{"adapter":"json-interface-v1","path":"schemas/consumer.json","pointer":""}}]}
  ]
}
```

Ticket IDs are owning slices, not agent identities. ADR/reuse fields keep their
existing purpose, and `verify-adr` reads this same envelope when ADRs apply. A
legacy checker cannot silently interpret the versioned object as a clean array.
New typed endpoint shapes and adapters are validated explicitly.

The first adapter reads a strict, bounded project-owned JSON interface artifact,
or project-generated relevant facts from its actual type/schema source:

```json
{
  "interface_id":"calculation","revision":"1","supported_revisions":["1"],
  "fields":{
    "amount":{"type":"number","required":true,"nullable":false,"unit":"minutes","reference":null,"effective":"record-version"},
    "calculation_result_id":{"type":"string","required":true,"nullable":false,"unit":null,"reference":"calculation-result","effective":"record-version"}
  }
}
```

Supported scalar types are string, boolean, integer and number. An integer
producer can satisfy a number consumer. Presence and nullability are distinct;
every consumer-required field must be guaranteed by its producer. Relevant
units, identity/reference and effective semantics must agree with the protected
expectation; `null` explicitly means not applicable, not an inferred meaning.
The emitted revision must match the accepted expectation and appear in the
consumer's explicit supported revisions. No semver inference or unit conversion
is performed. Unknown facts, `$ref`, unions and arbitrary SQL/TypeScript/JSON
Schema constructs are unsupported rather than silently treated as compatible.
This does not duplicate a whole application schema into Specflow.

The accepted parent extends its existing protected `outcome_contract` with:

```json
{
  "data_seams":[{
    "id":"S-calculation","required":true,"manifest_path":"tickets.json",
    "producer_ids":["producer"],"consumer_ids":["consumer"],
    "obligation_ids":["O-values"],"check_ids":["C-correctness"],
    "expected_ref":{"path":"expected-interface.json","sha256":"<accepted SHA-256>","pointer":""}
  }]
}
```

The normative expected facts are independently reviewed relevant project facts.
This stable required inventory prevents removal of an endpoint or a change of
units/nullability/version from silently redefining the goal. Existing outcome
hash/amendment authority protects it. Actual implementation reference plumbing
still follows normal independent verification. Manifest and expected/actual
artifact bytes join existing bindings, including ignored files. References are
repository-relative regular files with no symlink/hardlink traversal and the
existing 16 MiB native artifact bound.

Every required seam joins existing required obligation and integration/journey
check IDs. Its correctness check has independent #70 comparison IDs and strict
`execution.seam_ids: ["S-calculation"]`. Missing owners, duplicate endpoints,
dangling obligations/checks or unconsumed seam IDs block. Nothing automatically
adds or upgrades an accepted check. A required typed reader cannot disappear as
zero seams merely because its producer is absent. Unknown typed interfaces must
be reconciled with the protected inventory.

Gate B invokes `verify-seams` with `--phase planned` and the existing
`--verification-contract` path when supplied. Typed data requires that parent
mapping; legacy string-only arrays do not. The planning file may be the current
reviewed proposal; parsing it grants no verifier acceptance. Future actual
schema artifacts may be absent during planning if ownership/checks are named,
but known contradictory facts still block. `--phase built` (the typed CLI
default) requires actual referenced fields and compatibility. Changing a label
cannot create a built artifact. `--no-resolve` affects legacy string searches,
never typed schema resolution.

The existing owning native executor enforces built compatibility before running
the mapped connection. Compatible metadata does not establish runtime use: the
real producer-to-consumer check must exercise the actual connection and #70's
independent expected result, including relevant unit/record/version fields. The
qualified fixture uses a real local HTTP producer, a separate consumer process
and its persisted output; matching metadata with a wrong runtime unit fails.
It establishes this adapter/harness, not production or general database proof.

CLI compatibility output always reports `runtime_status: unverified`. Current
runner/trace `data_seams` projections show owners, obligations, checks and
separate compatibility/runtime states. Only current owning checks can supply a
passing runtime state; stale bindings, unsupported capability and waivers remain
visible. Saved metadata is not self-authenticating acceptance, and #73 composes
final parent acceptance. An explicitly optional unsupported seam remains visible
through its separately optional check; required proof is never made optional as
a missing-environment workaround.

Detection covers declared interfaces and the independently accepted required
inventory. Review changed schema/type/consumer contracts for dependencies that
were never declared; a path scan or an empty seam list cannot prove their absence.
The checker names the conflicting producer, consumer, interface/revisions,
field semantics and affected checks, and never repairs an application schema or
oracle itself. Additional adapters need their own real integration qualification.

## Gate D final outcome (#73)

The optional strict `outcome_contract.acceptance` extension contains nonempty
`hops: [{id, obligation_ids}]` and optional boolean `signoff_required` (default
false). Hop IDs are unique, reference existing obligations and cover every
required obligation. Without the extension, the accepted journey ID is the sole
hop mapped to all required obligations. These semantics are inside the existing
protected outcome hash; normal authorised amendment and rerun rules apply.

`check-gate-d` is report lint and reports `outcome_acceptance: not_evaluated`.
`accept-gate-d` and `specflow run gate-d` consume the same current owning verifier
journal. They derive required configuration/check coverage mechanically, execute
applicable checks and reconcile every required tuple. Native children receive
selected configuration/environment labels; actual route selection remains the
accepted check's responsibility. Shared comparison and seam declarations are
filtered only after validating the complete accepted mapping.

Required red/failed/blocked/missing/skipped/stale/unsupported/waived reports never
pass. Report IDs/statuses are strict; files are bounded regular, repository-local
and cannot follow symlinks. A final sweep revalidates earlier genuine stage
handles and native artifacts after all configurations execute, plus current
source/input/oracle/schema/report bindings and latest contract acceptance.
Copied JSON, edited verdicts, file existence and generic stage evidence cannot
supply this authority. The runner records a separate Gate D outcome event; trace
is explicitly a historical audit view, never a new acceptance invocation.

Required signoff reuses ownerException's verified GitHub owner and detached
Ed25519 signature, naming `gate-d:<approval_scope>` in the signed reason.
The stable digest binds normative contract/configuration/source/artifact inputs,
not new timestamped execution receipts. Fresh checks must still run unchanged.
Default optional policy introduces no signature checkpoint. Mutable local policy,
signed_by and legacy hash attribution cannot impersonate or disable required
owner authority. A waiver remains explicit, attributed honestly and non-passing.
See [the command and evidence semantics](docs/gate-d.md).
