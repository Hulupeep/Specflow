# Part 5: Journey Contracts

> **Role: LLM (continued)**
>
> Architecture and features are defined. Now I create journey contracts.
> Journeys are the **Definition of Done** - they prove the product works for users.

---

## Why Journeys Are DOD

Unit tests ask: "Does this function work?"
Feature contracts ask: "Does this code follow the rules?"
**Journey contracts ask: "Can users accomplish their goals?"**

A feature isn't done when code compiles.
A feature is done when users can do what they came to do.

---

## The Journey Contract

```yaml
# docs/contracts/journey_add_commission.yml

contract_meta:
  id: journey_add_commission
  version: 1
  created_from_spec: "docs/specs/queuecraft.md"
  covers_reqs:
    - J-QUEUE-001
  owner: "product-team"

dod:
  criticality: critical      # critical | important | future
  status: not_tested         # passing | failing | not_tested
  blocks_release: true
  last_verified: null

journey_definition:
  name: "Add New Commission"
  description: "Commissioner adds a new client inquiry to their queue"
  actor: "commissioner"
  preconditions:
    - "User is logged in"
    - "User is on dashboard"

  steps:
    - step_number: 1
      action: "Click 'Add Commission' button"
      expected_result: "Commission form modal opens"
      required_elements:
        - selector: "[data-testid='add-commission-btn']"
          state: "visible"
          action: "click"

    - step_number: 2
      action: "Enter client name"
      expected_result: "Name field populated"
      required_elements:
        - selector: "[data-testid='client-name-input']"
          state: "visible"
          action: "fill"
          value: "Test Client"

    - step_number: 3
      action: "Enter contact method"
      expected_result: "Contact field populated"
      required_elements:
        - selector: "[data-testid='contact-method-input']"
          state: "visible"
          action: "fill"
          value: "discord:testclient#1234"

    - step_number: 4
      action: "Enter project description"
      expected_result: "Description field populated"
      required_elements:
        - selector: "[data-testid='project-description-input']"
          state: "visible"
          action: "fill"
          value: "Custom armor set, full foam build"

    - step_number: 5
      action: "Enter quoted price"
      expected_result: "Price field populated"
      required_elements:
        - selector: "[data-testid='quoted-price-input']"
          state: "visible"
          action: "fill"
          value: "450"

    - step_number: 6
      action: "Click Save"
      expected_result: "Modal closes, commission appears in queue"
      required_elements:
        - selector: "[data-testid='save-commission-btn']"
          action: "click"
        - selector: "[data-testid='commission-list']"
          state: "contains"
          value: "Test Client"

  acceptance_criteria:
    - "Commission appears in queue within 1 second of save"
    - "Commission status is 'inquiry'"
    - "Queue count increments by 1"

  test_file: "tests/e2e/journey_add_commission.spec.ts"
```

---

## The Playwright Test

```typescript
// tests/e2e/journey_add_commission.spec.ts

import { test, expect } from '@playwright/test'

/**
 * Journey: J-QUEUE-001 - Add New Commission
 * Criticality: CRITICAL (blocks release)
 * Contract: docs/contracts/journey_add_commission.yml
 */
test.describe('Journey: Add New Commission', () => {

  test.beforeEach(async ({ page }) => {
    // Login as test user
    await page.goto('/login')
    await page.fill('[data-testid="email-input"]', 'test@example.com')
    await page.fill('[data-testid="password-input"]', 'testpassword')
    await page.click('[data-testid="login-btn"]')
    await page.waitForURL('/dashboard')
  })

  test('J-QUEUE-001: Commissioner can add new client inquiry', async ({ page }) => {
    // Get initial queue count
    const initialCount = await page.locator('[data-testid="queue-count"]').textContent()

    // Step 1: Click Add Commission
    await page.click('[data-testid="add-commission-btn"]')
    await expect(page.locator('[data-testid="commission-form"]')).toBeVisible()

    // Step 2: Enter client name
    await page.fill('[data-testid="client-name-input"]', 'Test Client')

    // Step 3: Enter contact method
    await page.fill('[data-testid="contact-method-input"]', 'discord:testclient#1234')

    // Step 4: Enter project description
    await page.fill('[data-testid="project-description-input"]', 'Custom armor set, full foam build')

    // Step 5: Enter quoted price
    await page.fill('[data-testid="quoted-price-input"]', '450')

    // Step 6: Save
    await page.click('[data-testid="save-commission-btn"]')

    // Acceptance: Commission appears in queue within 1 second
    await expect(page.locator('[data-testid="commission-list"]'))
      .toContainText('Test Client', { timeout: 1000 })

    // Acceptance: Status is 'inquiry'
    await expect(page.locator('[data-testid="commission-status"]').first())
      .toHaveText('inquiry')

    // Acceptance: Queue count incremented
    const newCount = await page.locator('[data-testid="queue-count"]').textContent()
    expect(parseInt(newCount!)).toBe(parseInt(initialCount!) + 1)
  })

  test('J-QUEUE-001: Form validates required fields', async ({ page }) => {
    await page.click('[data-testid="add-commission-btn"]')

    // Try to save without filling required fields
    await page.click('[data-testid="save-commission-btn"]')

    // Should show validation errors
    await expect(page.locator('[data-testid="error-client-name"]')).toBeVisible()
    await expect(page.locator('[data-testid="error-quoted-price"]')).toBeVisible()
  })
})
```

---

## More Journey Contracts

### J-QUEUE-002: Record Deposit (Critical)

```yaml
# docs/contracts/journey_record_deposit.yml

contract_meta:
  id: journey_record_deposit
  version: 1
  covers_reqs: [J-QUEUE-002]

dod:
  criticality: critical
  status: not_tested
  blocks_release: true

journey_definition:
  name: "Record Deposit"
  actor: "commissioner"

  steps:
    - step_number: 1
      action: "Click commission in queue"
      required_elements:
        - selector: "[data-testid='commission-row']"
          action: "click"

    - step_number: 2
      action: "Click 'Record Deposit'"
      required_elements:
        - selector: "[data-testid='record-deposit-btn']"
          action: "click"

    - step_number: 3
      action: "Enter deposit amount"
      required_elements:
        - selector: "[data-testid='deposit-amount-input']"
          action: "fill"
          value: "100"

    - step_number: 4
      action: "Select payment method"
      required_elements:
        - selector: "[data-testid='payment-method-select']"
          action: "select"
          value: "venmo"

    - step_number: 5
      action: "Confirm deposit"
      required_elements:
        - selector: "[data-testid='confirm-deposit-btn']"
          action: "click"

  acceptance_criteria:
    - "Commission status changes to 'deposit_paid'"
    - "Deposit amount shows on commission detail"
    - "Dashboard 'deposits this month' updates"

  test_file: "tests/e2e/journey_record_deposit.spec.ts"
```

### J-QUEUE-004: Move Through Workflow (Critical)

```yaml
# docs/contracts/journey_workflow.yml

contract_meta:
  id: journey_workflow
  version: 1
  covers_reqs: [J-QUEUE-004]

dod:
  criticality: critical
  status: not_tested
  blocks_release: true

journey_definition:
  name: "Commission Workflow"
  actor: "commissioner"
  preconditions:
    - "Commission exists with status 'deposit_paid'"

  steps:
    - step_number: 1
      action: "Click 'Start Work'"
      expected_result: "Status becomes 'in_progress'"

    - step_number: 2
      action: "Click 'Ready for Review'"
      expected_result: "Status becomes 'review'"

    - step_number: 3
      action: "Click 'Complete'"
      expected_result: "Status becomes 'completed'"

    - step_number: 4
      action: "Click 'Delivered'"
      expected_result: "Status becomes 'delivered', commission archived"

  acceptance_criteria:
    - "Each status transition persists immediately"
    - "Status history is recorded"
    - "Archived commissions appear in 'Completed' tab"
```

---

## Definition of Done Summary

```
┌─────────────────────────────────────────────────────────────┐
│                    DEFINITION OF DONE                       │
├─────────────────────────────────────────────────────────────┤
│ CRITICAL (must pass to ship):                               │
│   ✅ J-QUEUE-001: Add new commission                        │
│   ✅ J-QUEUE-002: Record deposit                            │
│   ✅ J-QUEUE-004: Move through workflow                     │
│   ✅ ARCH-001: RLS prevents cross-user access               │
│   ✅ ARCH-002: No payment data in client state              │
│   ✅ ARCH-003: All API routes authenticated                 │
│                                                             │
│ IMPORTANT (should pass):                                    │
│   ⬜ J-QUEUE-003: Client status check                       │
│   ⬜ FEAT-005: Dashboard metrics                            │
│                                                             │
│ FUTURE (not blocking):                                      │
│   ⬜ FEAT-008: Rush fee calculation                         │
└─────────────────────────────────────────────────────────────┘
```

**Release gate:** All CRITICAL items must be ✅ before shipping.

---

**Next:** [Part 6: Implementation →](06-implementation.md)
