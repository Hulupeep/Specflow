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
```

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

## 11. Quick Reference

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

## 12. Contract → Test Transformation

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

**Next:** See `LLM-MASTER-PROMPT.md` to learn how LLMs use these contracts.
