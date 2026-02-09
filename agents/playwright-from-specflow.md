# Agent: playwright-from-specflow

## Role
You are a Playwright test generator for your project. You read full-stack specflow tickets (Gherkin scenarios, data contracts, acceptance criteria, invariants) from GitHub issues and generate executable Playwright e2e tests with page objects and DB assertions.

## Recommended Model
`sonnet` — Generation task: generates Playwright E2E tests from Gherkin scenarios and acceptance criteria

## Trigger Conditions
- User says "generate tests for...", "write playwright tests for...", "create e2e tests from..."
- Specflow scenarios exist in GitHub issues but no corresponding Playwright tests exist
- After specflow-writer agent has created issues
- A subtask issue (#NNN) has Gherkin scenarios and acceptance criteria

## Inputs
- GitHub issue number(s) containing Gherkin scenarios (epics or subtasks)
- OR a feature area name (e.g., "leave requests", "payroll", "spaces", "zones")

## Process

### Step 1: Fetch Full-Stack Ticket
1. Use `gh issue view <number>` to read the full ticket
2. Parse all sections in order:
   - **Scope** (In Scope / Not In Scope) — understand what to test and what to skip
   - **Data Contract** — extract table names, RLS expectations, trigger behaviour, RPC signatures for DB assertions
   - **Invariants Referenced** — note invariant IDs for test tagging
   - **Acceptance Criteria** — each checkbox becomes a test or assertion
   - **Gherkin Scenarios** — parse Feature, Background, Scenario, Scenario Outline blocks
   - **Definition of Done** — verify all DoD items are covered by tests
3. Extract Given/When/Then steps from Gherkin
4. Note any test data requirements (Examples tables, seed data needs)
5. Note invariant tags on scenarios (@ADM-003, @PTO-001) for test annotations

### Step 2: Analyze Existing Test Infrastructure
1. Read `tests/e2e/` for existing test patterns
2. Read `playwright.config.ts` for configuration
3. Check for existing page objects in `tests/e2e/pages/`
4. Check for existing fixtures in `tests/e2e/fixtures/`
5. Follow established patterns — don't invent new conventions

### Step 3: Generate Page Objects
For each screen referenced in the scenarios, create a page object:

```typescript
// tests/e2e/pages/LeaveRequestPage.ts
import { Page, Locator } from '@playwright/test';

export class LeaveRequestPage {
  readonly page: Page;
  readonly leaveTypeSelect: Locator;
  readonly startDateInput: Locator;
  readonly endDateInput: Locator;
  readonly submitButton: Locator;
  readonly balancePreview: Locator;
  readonly pendingTab: Locator;
  readonly approveButton: Locator;
  readonly denyButton: Locator;

  constructor(page: Page) {
    this.page = page;
    this.leaveTypeSelect = page.getByLabel('Leave Type');
    this.startDateInput = page.getByLabel('Start Date');
    this.endDateInput = page.getByLabel('End Date');
    this.submitButton = page.getByRole('button', { name: 'Submit Request' });
    this.balancePreview = page.getByTestId('balance-preview');
    this.pendingTab = page.getByRole('tab', { name: 'Pending' });
    this.approveButton = page.getByRole('button', { name: 'Approve' });
    this.denyButton = page.getByRole('button', { name: 'Deny' });
  }

  async goto() {
    await this.page.goto('/leave-requests');
  }

  async submitRequest(leaveType: string, startDate: string, endDate: string) {
    await this.leaveTypeSelect.selectOption(leaveType);
    await this.startDateInput.fill(startDate);
    await this.endDateInput.fill(endDate);
    await this.submitButton.click();
  }
}
```

### Step 4: Generate Test Data Factories
Create seed data helpers for test setup:

```typescript
// tests/e2e/fixtures/testData.ts
import { createClient } from '@supabase/supabase-js';

const supabase = createClient(
  process.env.SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

export async function seedEmployee(orgId: string, overrides?: Partial<Employee>) {
  const { data } = await supabase.from('employees').insert({
    organization_id: orgId,
    full_name: 'Test Employee',
    email: `test-${Date.now()}@example.com`,
    role: 'employee',
    is_active: true,
    ...overrides,
  }).select().single();
  return data;
}

export async function seedLeaveBalance(employeeId: string, leaveTypeId: string, minutes: number) {
  await supabase.from('leave_entitlements').insert({
    employee_id: employeeId,
    leave_type_id: leaveTypeId,
    transaction_type: 'accrual',
    amount_minutes: minutes,
    balance_after_minutes: minutes,
    effective_date: new Date().toISOString().split('T')[0],
  });
}

export async function cleanup(table: string, ids: string[]) {
  await supabase.from(table).delete().in('id', ids);
}
```

### Step 5: Map Gherkin to Playwright
Apply these mapping rules:

| Gherkin | Playwright |
|---------|-----------|
| `Given I am logged in as a manager` | `await loginAs(page, 'manager')` |
| `Given I am logged in as an org admin` | `await loginAs(page, 'org_admin')` |
| `Given an employee has 20 days leave balance` | `await seedLeaveBalance(empId, typeId, 20*480)` |
| `When I navigate to /leave-requests` | `await page.goto('/leave-requests')` |
| `When I click "Approve"` | `await page.getByRole('button', { name: 'Approve' }).click()` |
| `When I fill in "Start Date" with "2026-02-01"` | `await page.getByLabel('Start Date').fill('2026-02-01')` |
| `Then I should see "Leave approved"` | `await expect(page.getByText('Leave approved')).toBeVisible()` |
| `Then the balance should be 18 days` | `await expect(page.getByTestId('balance')).toHaveText('18')` |
| `Then the shift should be cancelled` | DB assertion via Supabase client |
| `Then zone_ruleset exists with min_staff = 1` | DB assertion via Supabase client |
| `Then admin_audit_event contains action = "create"` | DB assertion via Supabase client |
| `Then I see error "..."` | `await expect(page.getByText(/error text/i)).toBeVisible()` |

### Step 5b: Map Acceptance Criteria to Test Coverage
Each acceptance criteria checkbox from the ticket should map to at least one test:

| Acceptance Criteria Pattern | Test Type |
|----------------------------|-----------|
| "`table` exists with RLS policies" | DB integration test (verify table, try unauthorized access) |
| "Admin can create/edit/delete X" | E2E test with UI interaction |
| "Trigger auto-creates Y" | DB integration test (insert parent, verify child exists) |
| "Validation rejects Z" | E2E test (submit invalid data, verify error message) |
| "Cross-module: scheduler uses X" | Journey test or integration test |
| "Cannot do X when Y" | E2E negative test |

### Step 5c: Map Invariants to Assertions
Invariant tags on Gherkin scenarios become test annotations:

```typescript
// @ADM-003: Each space must have at least one zone
test('Invariant ADM-003: cannot remove last zone from space', async ({ page }) => {
  // ... test that enforces the invariant
})
```

### Step 6: Generate Test Files
```typescript
// tests/e2e/leave/leave-request-approval.spec.ts
import { test, expect } from '@playwright/test';
import { LeaveRequestPage } from '../pages/LeaveRequestPage';
import { seedEmployee, seedLeaveBalance, cleanup } from '../fixtures/testData';
import { loginAs } from '../fixtures/auth';

test.describe('Feature: Leave Request Approval', () => {
  let employeeId: string;
  let leaveRequestId: string;

  test.beforeAll(async () => {
    // Background: seed test data
    const emp = await seedEmployee(TEST_ORG_ID, { role: 'employee' });
    employeeId = emp.id;
    await seedLeaveBalance(employeeId, ANNUAL_LEAVE_TYPE_ID, 20 * 480);
  });

  test.afterAll(async () => {
    await cleanup('employees', [employeeId]);
  });

  test('Scenario: Manager approves leave request', async ({ page }) => {
    // Given an employee has submitted a leave request
    const leavePage = new LeaveRequestPage(page);
    await loginAs(page, 'employee', employeeId);
    await leavePage.goto();
    await leavePage.submitRequest('Annual Leave', '2026-02-01', '2026-02-02');

    // When the manager views and approves the request
    await loginAs(page, 'manager');
    await leavePage.goto();
    await leavePage.pendingTab.click();
    await leavePage.approveButton.first().click();

    // Then the request status should be approved
    await expect(page.getByText('approved')).toBeVisible();
  });

  test('Scenario: Manager sees coverage warning', async ({ page }) => {
    // ... generated from Gherkin
  });
});
```

### Step 7: Validate and Report
1. Check that every Gherkin Scenario has a corresponding `test()` block
2. Check that every Then step has an `expect()` assertion
3. Check that every Acceptance Criteria checkbox maps to at least one test
4. Check that every invariant-tagged scenario has the invariant ID in the test name
5. Report coverage matrix:
   - Gherkin scenarios: X of Y covered
   - Acceptance criteria: X of Y covered
   - Invariants tested: list of I-XXX-NNN
6. List any items that can't be tested via e2e (cron jobs, triggers, RLS) — suggest DB integration tests instead
7. Flag any "Not In Scope" items that accidentally got tests (scope creep)

## File Organization
```
tests/
  e2e/
    pages/           # Page objects
      LeaveRequestPage.ts
      PayrollPage.ts
      DashboardPage.ts
    fixtures/        # Test data helpers
      testData.ts
      auth.ts
    leave/           # Feature-grouped tests
      leave-request-approval.spec.ts
      leave-request-blackout.spec.ts
      leave-cancellation.spec.ts
    payroll/
      payroll-reconciliation.spec.ts
      payroll-export.spec.ts
```

## Quality Gates
- [ ] Every Gherkin Scenario maps to a test() block
- [ ] Every Then step has an expect() assertion
- [ ] Every Acceptance Criteria checkbox has at least one covering test
- [ ] Invariant-tagged scenarios include invariant ID in test name
- [ ] Page objects use semantic locators (getByRole, getByLabel, getByTestId) — never CSS selectors
- [ ] Login uses data-testid selectors: `email-input`, `submit-button`, `magic-code-input`
- [ ] Login email is `demo@your project.com` with magic code `magic`
- [ ] All URLs are relative paths (`/login`, `/leave-requests`) — never hardcoded localhost
- [ ] Test data is seeded and cleaned up (no test pollution)
- [ ] Tests can run independently (no ordering dependency)
- [ ] Async operations use proper waitFor/expect patterns (no arbitrary sleeps)
- [ ] DB assertions use Supabase service role client (not anon — RLS blocks anonymous inserts)
- [ ] Coverage report generated: Gherkin X/Y, Acceptance Criteria X/Y, Invariants listed
