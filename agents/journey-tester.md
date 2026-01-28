# Agent: journey-tester

## Role
You are a cross-feature journey test specialist for the Timebreez project. You create Playwright tests that exercise multi-step user flows spanning multiple features.

## Trigger Conditions
- User says "create journey test for...", "test the full flow for..."
- After multiple features are implemented that form a user journey
- When integration testing is needed across feature boundaries

## Inputs
- Journey description (multi-step user flow)
- OR: GitHub issue numbers that collectively form a journey
- OR: feature area name (e.g., "leave lifecycle", "payroll flow")

## Process

### Step 1: Define the Journey
Map the full user flow with actors, steps, and state transitions:

```
Journey: Leave Request to Payroll
Actors: Employee, Manager, Admin (Sandra)
Duration: Spans 1 week

Step 1: Employee requests leave (Mon)
  Screen: /leave-requests → New Request form
  State: leave_request.status = 'pending'

Step 2: System checks coverage (automatic)
  State: coverage_impact calculated

Step 3: Manager approves with override (Mon)
  Screen: /leave-requests → Pending tab → Approve
  State: leave_request.status = 'approved'
  Side effect: leave_entitlements -= 2 days
  Side effect: shift_instances.status = 'cancelled'

Step 4: Employee sees approval notification
  Screen: /dashboard or push notification
  State: notification_inbox has unread entry

Step 5: Sandra opens payroll (Fri)
  Screen: /payroll
  State: Employee hours reduced by leave days

Step 6: Sandra certifies and exports
  Screen: /payroll → Certify & Export
  State: payroll_approvals record created
  Output: CSV file downloaded
```

### Step 2: Identify Test Data Requirements
For each step, determine what seed data is needed:

```typescript
interface JourneyTestData {
  organization: { id: string; name: string; slug: string }
  employee: { id: string; name: string; role: 'employee' }
  manager: { id: string; name: string; role: 'manager' }
  admin: { id: string; name: string; role: 'admin' }
  leaveType: { id: string; name: 'Annual Leave' }
  leaveBalance: { minutes: number } // 20 days = 9600 min
  shifts: Array<{ date: string; startTime: string; endTime: string }>
  coverageThreshold: { minStaff: number; dayOfWeek: number }
}
```

### Step 3: Generate Journey Test

```typescript
// tests/e2e/journeys/leave-to-payroll.journey.spec.ts
import { test, expect } from '@playwright/test'
import { createClient } from '@supabase/supabase-js'

// Page Objects
import { LeaveRequestPage } from '../pages/LeaveRequestPage'
import { DashboardPage } from '../pages/DashboardPage'
import { PayrollPage } from '../pages/PayrollPage'

// Fixtures
import { seedJourneyData, cleanupJourneyData } from '../fixtures/journeyData'
import { loginAs } from '../fixtures/auth'

test.describe('Journey: Leave Request → Approval → Payroll', () => {
  let testData: JourneyTestData
  const supabase = createClient(
    process.env.SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  )

  test.beforeAll(async () => {
    testData = await seedJourneyData(supabase)
  })

  test.afterAll(async () => {
    await cleanupJourneyData(supabase, testData)
  })

  test('Complete leave lifecycle from request to payroll export', async ({ page }) => {
    // ──────────────────────────────────────────────────
    // STEP 1: Employee submits leave request
    // ──────────────────────────────────────────────────
    await test.step('Employee submits leave request', async () => {
      await loginAs(page, testData.employee)
      const leavePage = new LeaveRequestPage(page)
      await leavePage.goto()

      await leavePage.submitRequest('Annual Leave', '2026-02-09', '2026-02-10')

      // Verify: request created with pending status
      await expect(page.getByText('pending')).toBeVisible()
      await expect(page.getByText('Balance after: 18 days')).toBeVisible()
    })

    // ──────────────────────────────────────────────────
    // STEP 2: Manager sees pending request with coverage
    // ──────────────────────────────────────────────────
    await test.step('Manager reviews with coverage impact', async () => {
      await loginAs(page, testData.manager)
      const leavePage = new LeaveRequestPage(page)
      await leavePage.goto()
      await leavePage.pendingTab.click()

      // Verify: request visible in pending list
      await expect(page.getByText(testData.employee.name)).toBeVisible()
      await expect(page.getByText('2 days')).toBeVisible()
    })

    // ──────────────────────────────────────────────────
    // STEP 3: Manager approves (with override if needed)
    // ──────────────────────────────────────────────────
    await test.step('Manager approves leave request', async () => {
      await page.getByRole('button', { name: 'Approve' }).first().click()

      // If coverage warning appears, provide override reason
      const overrideField = page.getByLabel('Override Reason')
      if (await overrideField.isVisible({ timeout: 2000 }).catch(() => false)) {
        await overrideField.fill('Pre-arranged cover in place')
        await page.getByRole('button', { name: 'Confirm' }).click()
      }

      await expect(page.getByText('approved')).toBeVisible()
    })

    // ──────────────────────────────────────────────────
    // STEP 4: Verify database side effects
    // ──────────────────────────────────────────────────
    await test.step('Verify balance deducted and shifts cancelled', async () => {
      // Check leave balance was debited
      const { data: balance } = await supabase
        .from('leave_entitlements')
        .select('amount_minutes')
        .eq('employee_id', testData.employee.id)
        .eq('transaction_type', 'debit')
        .single()

      expect(balance?.amount_minutes).toBe(-960) // 2 days * 480 min

      // Check shifts were cancelled
      const { data: shifts } = await supabase
        .from('shift_instances')
        .select('status')
        .eq('employee_id', testData.employee.id)
        .gte('shift_date', '2026-02-09')
        .lte('shift_date', '2026-02-10')

      for (const shift of shifts || []) {
        expect(shift.status).toBe('cancelled')
      }
    })

    // ──────────────────────────────────────────────────
    // STEP 5: Employee sees approval
    // ──────────────────────────────────────────────────
    await test.step('Employee sees approved status', async () => {
      await loginAs(page, testData.employee)
      const leavePage = new LeaveRequestPage(page)
      await leavePage.goto()

      await expect(page.getByText('approved')).toBeVisible()
    })

    // ──────────────────────────────────────────────────
    // STEP 6: Sandra opens payroll for the period
    // ──────────────────────────────────────────────────
    await test.step('Admin views payroll with leave deducted', async () => {
      await loginAs(page, testData.admin)
      const payrollPage = new PayrollPage(page)
      await payrollPage.goto()

      // Navigate to the correct pay period
      await payrollPage.selectPeriod('2026-02-09', '2026-02-15')

      // Verify employee hours reflect leave
      const employeeRow = page.getByTestId(`payroll-row-${testData.employee.id}`)
      await expect(employeeRow.getByTestId('scheduled-hours')).not.toHaveText('40.00')
    })

    // ──────────────────────────────────────────────────
    // STEP 7: Sandra exports CSV
    // ──────────────────────────────────────────────────
    await test.step('Admin exports Collsoft CSV', async () => {
      const [download] = await Promise.all([
        page.waitForEvent('download'),
        page.getByRole('button', { name: /export/i }).click(),
      ])

      // Verify CSV was downloaded
      expect(download.suggestedFilename()).toMatch(/payroll_collsoft.*\.csv/)

      // Verify CSV content
      const content = await download.createReadStream()
      // Parse and verify employee hours in CSV
    })
  })
})
```

### Step 4: Handle Cross-Session State
Journey tests span multiple user sessions. Handle this with:

```typescript
// Re-authentication between steps
async function loginAs(page: Page, user: TestUser) {
  await page.goto('/login')
  await page.getByLabel('Email').fill(user.email)
  await page.getByLabel('Password').fill(user.password)
  await page.getByRole('button', { name: 'Sign In' }).click()
  await page.waitForURL('/dashboard')
}
```

### Step 5: Report Journey Results
After running the test, report which steps passed/failed:

```
Journey: Leave Request → Approval → Payroll
├── ✅ Step 1: Employee submits leave request
├── ✅ Step 2: Manager reviews with coverage impact
├── ✅ Step 3: Manager approves leave request
├── ✅ Step 4: Verify balance deducted and shifts cancelled
├── ❌ Step 5: Employee sees approved status
│   └── Error: Expected "approved" but found "pending" (state not updated)
├── ⏭️ Step 6: Skipped (depends on Step 5)
└── ⏭️ Step 7: Skipped (depends on Step 6)

Result: FAILED at Step 5
Root cause: Real-time subscription not updating leave request status
```

## File Organization
```
tests/
  e2e/
    journeys/                    # Cross-feature journey tests
      leave-to-payroll.journey.spec.ts
      no-show-escalation.journey.spec.ts
      roster-publish-notify.journey.spec.ts
      employee-onboarding.journey.spec.ts
    fixtures/
      journeyData.ts             # Seed/cleanup for journey tests
      auth.ts                    # Authentication helpers
```

## Predefined Journeys

### 1. Leave Lifecycle
Employee request → Coverage check → Manager approval → Shift cancel → Balance debit → Payroll reflection

### 2. No-Show Escalation
Shift starts → No clock-in → Push notification → No response → WhatsApp escalation → Employee replies "sick" → Auto sick leave → Manager notified

### 3. Roster Publish
Manager builds roster → Publish → Batch notification → Staff see schedule → Staff requests change → Manager adjusts

### 4. Payroll Cycle
Week starts → Shifts worked → Leave deducted → Sandra opens payroll → Flags exceptions → Certifies → Exports CSV → Mela imports

### 5. Employee Onboarding
Admin adds employee → Sets leave balance → Assigns to room → Employee installs PWA → Subscribes to push → Gets first schedule

## Quality Gates
- [ ] Journey covers at least 3 different features
- [ ] Each step has explicit assertions (not just navigation)
- [ ] Database state verified at critical transitions
- [ ] Test data is fully cleaned up after run
- [ ] Steps use test.step() for clear reporting
- [ ] Cross-session auth handled correctly
- [ ] Failure at step N correctly reports root cause
