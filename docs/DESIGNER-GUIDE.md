# Specflow Designer Guide

> Your flows become the tests. Your journeys become the contracts.

## Your Role in LLM Development

Traditional workflow:
```
Designer → Specs → Developer → (hope it matches) → QA finds gaps
```

Specflow workflow:
```
Designer → Journey Contracts → LLM builds → Auto-verified against YOUR spec
```

**You are the guardian of user experience.** LLM agents move fast. Your job is to encode what "correct" looks like so deviations are caught automatically—not in user testing.

## What You Own

| Artifact | Purpose | Format |
|----------|---------|--------|
| User Journeys | Define what users DO | Markdown + IDs |
| Journey Contracts | Make journeys testable | YAML |
| Acceptance Criteria | Define "done" per step | Linked to journey IDs |
| Flow Deviations | Approve or reject changes | Decision log |

## Step-by-Step Workflow

### Step 1: Map the Journey

Start with what the user experiences. Write it as a narrative with clear steps.

```markdown
## J-AUTH-REGISTER: New User Registration

**Actor:** Anonymous visitor
**Goal:** Create an account and reach the dashboard

### Steps:
1. User lands on /register page
2. User enters email, password, confirms password
3. User clicks "Create Account"
4. System sends verification email
5. User clicks email link
6. User lands on dashboard with welcome message

### Success Criteria:
- User is authenticated after step 6
- Welcome message includes their email
- No sensitive data in URL parameters
```

**Key rules:**
- Every journey gets an ID: `J-FEATURE-NAME`
- Every step is numbered
- Success criteria are specific and testable

---

### Step 2: Identify Critical Checkpoints

Not every step needs a contract. Focus on:

| Checkpoint Type | Example | Why It Matters |
|----------------|---------|----------------|
| **Entry points** | "User lands on /register" | Wrong page = broken flow |
| **User actions** | "User clicks Create Account" | Button must exist, be clickable |
| **System responses** | "System sends verification email" | Must actually happen |
| **State changes** | "User is authenticated" | Core functionality |
| **Data integrity** | "No sensitive data in URL" | Security requirement |

Mark critical steps in your journey:

```markdown
### Steps:
1. User lands on /register page ← CHECKPOINT: page exists
2. User enters email, password, confirms password
3. User clicks "Create Account" ← CHECKPOINT: button exists + works
4. System sends verification email ← CHECKPOINT: email sent
5. User clicks email link
6. User lands on dashboard with welcome message ← CHECKPOINT: auth state
```

---

### Step 3: Write the Journey Contract

Convert your checkpoints into a testable YAML contract.

```yaml
# contracts/journey_auth_register.yml
contract: journey_auth_register
journey_id: J-AUTH-REGISTER
name: "New User Registration"
description: "Anonymous user creates account and reaches dashboard"

actor: anonymous_visitor
entry_point: /register
success_state: authenticated_on_dashboard

steps:
  - id: J-AUTH-REGISTER-01
    name: "Registration page loads"
    action: navigate
    target: /register
    assertions:
      - element: "form[data-testid='register-form']"
        state: visible
      - element: "input[name='email']"
        state: exists
      - element: "input[name='password']"
        state: exists

  - id: J-AUTH-REGISTER-02
    name: "User submits registration"
    action: submit
    target: "form[data-testid='register-form']"
    input:
      email: "{{test_email}}"
      password: "{{test_password}}"
    assertions:
      - element: "button[type='submit']"
        state: enabled
      - no_console_errors: true

  - id: J-AUTH-REGISTER-03
    name: "Verification email sent"
    action: wait
    assertions:
      - api_called: "/api/auth/send-verification"
        method: POST
      - response_status: 200

  - id: J-AUTH-REGISTER-04
    name: "User reaches dashboard"
    action: navigate
    target: /dashboard
    precondition: email_verified
    assertions:
      - url: "/dashboard"
      - element: "[data-testid='welcome-message']"
        contains: "{{test_email}}"
      - auth_state: authenticated
      - url_params_exclude: ["token", "password", "secret"]

failure_modes:
  - condition: "step 3 times out"
    classification: critical
    escalate: true

  - condition: "welcome message missing email"
    classification: ux_bug
    escalate: false
```

---

### Step 4: Define Test IDs

Work with developers to establish `data-testid` attributes for key elements.

**Your responsibility:** Specify WHAT needs test IDs
**Developer responsibility:** Add them to the code

Create a Test ID Map:

```markdown
## Test ID Map: Registration Flow

| Element | Test ID | Used In |
|---------|---------|---------|
| Registration form | `register-form` | J-AUTH-REGISTER-01 |
| Email input | `register-email` | J-AUTH-REGISTER-02 |
| Password input | `register-password` | J-AUTH-REGISTER-02 |
| Submit button | `register-submit` | J-AUTH-REGISTER-02 |
| Welcome message | `welcome-message` | J-AUTH-REGISTER-04 |
| User email display | `user-email` | J-AUTH-REGISTER-04 |
```

**Rule:** If it's in a journey contract, it needs a test ID.

---

### Step 5: Set Up Monitoring

You don't run the tests—CI does. But you need to know when journeys break.

**Configure notifications:**

```yaml
# In your journey contract
notifications:
  on_failure:
    - channel: "#design-alerts"
      mention: "@designer-handle"
    - email: designer@company.com

  on_deviation:
    - channel: "#design-review"
      message: "Journey {{journey_id}} has a proposed change"
```

**Daily check:**
1. Review CI dashboard for journey test status
2. Check `#design-alerts` for failures
3. Review any deviation requests

---

### Step 6: Handle Deviations

LLM agents may build something different from your spec. This isn't always wrong.

**When a journey test fails:**

```
┌─────────────────────────────────────────────────────────┐
│ JOURNEY FAILURE: J-AUTH-REGISTER-04                    │
│                                                         │
│ Expected: Welcome message contains user email           │
│ Actual: Welcome message says "Welcome back!"            │
│                                                         │
│ File: src/components/Dashboard.tsx:47                   │
│ Agent: coder-agent-03                                   │
└─────────────────────────────────────────────────────────┘
```

**Your decision tree:**

```
Is the actual behavior acceptable?
    │
    ├── NO → File issue, reference journey ID
    │        "J-AUTH-REGISTER-04 violated: welcome message must include email"
    │
    └── YES → Update the journey contract
              Document WHY in the deviation log
```

**Deviation Log:**

```markdown
## Deviation Log

### 2024-01-15: J-AUTH-REGISTER-04

**Original:** Welcome message must contain user email
**Actual:** Generic "Welcome back!" message
**Decision:** APPROVED
**Rationale:** User research showed personalized welcome felt "creepy" to 60% of users. Generic message tested better.
**Updated contract:** Removed email assertion, added generic welcome check
**Approved by:** @designer-name
```

---

### Step 7: Review LLM Output

Set aside time daily to review what LLM agents are producing.

**Review checklist:**

```markdown
## Daily Design Review

### Visual Consistency
- [ ] Colors match design system?
- [ ] Spacing follows 8px grid?
- [ ] Typography hierarchy correct?

### Flow Integrity
- [ ] All journey steps still work?
- [ ] No steps skipped or reordered?
- [ ] Error states handled?

### Accessibility
- [ ] Focus states visible?
- [ ] Screen reader labels present?
- [ ] Color contrast sufficient?

### Content
- [ ] Copy matches approved text?
- [ ] Error messages helpful?
- [ ] Empty states designed?
```

**Quick commands:**

```bash
# See what changed in UI components today
git diff --name-only HEAD~1 -- 'src/components/**'

# Run journey tests locally
npm run test:journeys

# Check specific journey
npm run test:journey -- J-AUTH-REGISTER
```

---

### Step 8: Iterate on Journeys

Journeys aren't static. Update them as the product evolves.

**When to update:**
- New feature affects existing journey
- User research reveals better flow
- Technical constraint requires change
- A/B test shows better alternative

**Update process:**

1. Create branch: `journey/update-auth-register`
2. Update journey markdown
3. Update journey contract YAML
4. Run tests locally
5. PR with "Journey Update" label
6. Get design + dev approval
7. Merge

---

## Quick Reference

### Journey Contract Checklist

```markdown
Before submitting a journey contract:

- [ ] Journey has unique ID (J-FEATURE-NAME)
- [ ] All steps numbered sequentially
- [ ] Critical steps have assertions
- [ ] Test IDs specified for all UI elements
- [ ] Success criteria are measurable
- [ ] Failure modes documented
- [ ] Notifications configured
```

### Common Assertions

| What to Check | Assertion Type | Example |
|---------------|----------------|---------|
| Element exists | `element` + `state: exists` | Button is on page |
| Element visible | `element` + `state: visible` | Modal is showing |
| Text content | `element` + `contains` | Error message text |
| URL correct | `url` | User on right page |
| API called | `api_called` | Backend received request |
| Auth state | `auth_state` | User logged in/out |
| No errors | `no_console_errors` | No JS crashes |

### Severity Levels

| Level | Meaning | Action |
|-------|---------|--------|
| `critical` | Journey completely broken | Stop deployment |
| `major` | Key step fails | Fix before release |
| `minor` | UX degraded but works | Fix in next sprint |
| `cosmetic` | Visual inconsistency | Backlog |

---

## Example: Complete Journey Package

```
journeys/
├── auth/
│   ├── J-AUTH-REGISTER.md      # Human-readable journey
│   ├── J-AUTH-LOGIN.md
│   └── J-AUTH-RESET.md
├── contracts/
│   ├── journey_auth_register.yml  # Testable contract
│   ├── journey_auth_login.yml
│   └── journey_auth_reset.yml
├── test-ids/
│   └── auth-test-ids.md        # Test ID map
└── deviations/
    └── 2024-01-auth.md         # Deviation log
```

---

## Working with LLM Agents

### What to tell agents:

> "Before implementing any UI, check the journey contract at `contracts/journey_*.yml`. Every element with an assertion needs the specified `data-testid`. Run `npm run test:journeys` before pushing."

### What agents should tell you:

> "I need to deviate from J-AUTH-REGISTER-03. The email service API changed and now returns 202 instead of 200. Should I update the contract or find a workaround?"

### Red flags to watch for:

- Agent skips journey tests ("they were slow")
- Agent changes test IDs without asking
- Agent removes assertions ("they were flaky")
- Agent implements flow not in any journey

---

## Tools for Designers

### Recommended setup:

```bash
# Watch journey test results
npm run test:journeys -- --watch

# Generate journey report
npm run journey:report

# Visual diff of UI changes
npm run storybook
```

### VS Code extensions:
- YAML (for contract editing)
- GitLens (for seeing who changed what)
- Todo Tree (for tracking journey TODOs)

---

## Summary

Your job is to make "correct UX" testable:

1. **Write journeys** in plain language
2. **Convert to contracts** with specific assertions
3. **Specify test IDs** for key elements
4. **Monitor CI** for journey failures
5. **Decide on deviations** and document why
6. **Iterate** as product evolves

The LLM agents build fast. You make sure they build right.

---

## Related Documents

- [USER-JOURNEY-CONTRACTS.md](../USER-JOURNEY-CONTRACTS.md) - Contract format reference
- [SPEC-FORMAT.md](../SPEC-FORMAT.md) - Requirement ID conventions
- [CONTRACT-SCHEMA.md](../CONTRACT-SCHEMA.md) - Full YAML schema
