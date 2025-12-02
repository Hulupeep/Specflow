# User Journey Contracts: Test What Matters, Not What's Easy

## The Problem with Traditional Testing

**Traditional approach:**
```typescript
// Unit test - tests implementation
it('adds item to cart', () => {
  const cart = new ShoppingCart()
  cart.addItem({ id: 1, name: 'Widget' })
  expect(cart.items.length).toBe(1)
})
```

**What this misses:**
- Is there an "Add to Cart" button visible?
- Does clicking it actually add the item?
- Does the cart icon update?
- Can user proceed to checkout?

**Result:** All tests pass, but user journey is broken.

---

## The User Journey Contract Approach

**User Journey Contract:**
```yaml
# Test the ENTIRE journey, not just units
journey:
  name: "Purchase Flow"
  steps:
    - step: "Product page loads"
      must_have: "Add to Cart button visible"

    - step: "Click Add to Cart"
      must_happen: "Item added to cart"
      must_show: "Cart icon updates with count"

    - step: "Navigate to cart"
      must_see: "Item in cart with correct details"

    - step: "Click Checkout"
      must_redirect: "Payment page"

    - step: "Complete payment"
      must_show: "Order confirmation"
```

**What this catches:**
- Button removed? ❌ Journey breaks
- Click handler removed? ❌ Journey breaks
- Cart UI refactored? ❌ Journey breaks if behavior changes
- Checkout flow changed? ❌ Journey breaks

**Result:** Tests fail if ANY part of the user journey breaks.

---

## User Journey Contract Template

### Template: user-journey-template.yml

```yaml
# User Journey Contract Template
# Copy this and customize for your journeys

contract_meta:
  id: journey_[journey_name]
  version: 1
  type: user_journey
  system: [your_project_name]
  owner: "[product_manager_name]"
  created_from: "User story / acceptance criteria"
  last_reviewed_at: "YYYY-MM-DD"

journey_definition:
  name: "[User Journey Name]"
  description: >
    What this journey accomplishes from user perspective.
    Example: "User browses products and completes purchase"

  user_type: "[role]"  # Example: "authenticated_user", "guest", "admin"

  preconditions:
    - "User is on [starting_page]"
    - "User has [required_state]"

  steps:
    - step_number: 1
      step_name: "[First action user takes]"
      user_action: "[What user does]"

      # What MUST be visible/present
      required_elements:
        - selector: "[css_selector or data-testid]"
          description: "[What this element is]"
          must_be: "visible"

      # What MUST happen after action
      expected_behavior:
        - type: "navigation"
          result: "[Expected URL or route]"
        # OR
        - type: "ui_update"
          result: "[What changes in UI]"
        # OR
        - type: "api_call"
          result: "[What API is called]"

      # What MUST NOT happen
      forbidden_behavior:
        - "[Error states that shouldn't occur]"
        - "[UI that shouldn't appear]"

    - step_number: 2
      step_name: "[Next action]"
      # ... repeat structure

  success_criteria:
    - "[What indicates journey completed successfully]"
    - "[Final state user should be in]"

  failure_scenarios:
    # What breaks this journey
    - scenario: "[Common failure]"
      if_happens: "[What test should catch]"

# How to enforce this journey
enforcement:
  test_framework: "playwright"  # or "cypress", "puppeteer"
  test_file: "src/__tests__/journeys/[journey_name].test.ts"

  run_frequency:
    - "On every PR"
    - "Before deployment"
    - "Daily regression suite"

  failure_handling:
    - "Block PR if journey breaks"
    - "Alert team immediately"

# Non-negotiable rules about this journey
non_negotiable_rules:
  - id: journey_[name]_001
    title: "Journey steps must remain in this order"
    description: >
      The sequence of steps is critical to user experience.
      Cannot be reordered without explicit product approval.

  - id: journey_[name]_002
    title: "Required elements must always be present"
    description: >
      Elements marked as required_elements cannot be removed
      or hidden without breaking the journey.

# What CAN change without breaking contract
allowed_changes:
  - "Styling and CSS (as long as elements remain visible)"
  - "Refactoring backend (as long as behavior is same)"
  - "Optimizing performance"
  - "Changing copy/text (as long as meaning preserved)"

# What CANNOT change
disallowed_changes:
  - "Removing required elements"
  - "Changing step order"
  - "Removing functionality"
  - "Changing expected outcomes"
```

---

## Real Examples

### Example 1: E-Commerce Checkout

```yaml
# docs/contracts/journey_checkout.yml
contract_meta:
  id: journey_checkout
  version: 1
  type: user_journey

journey_definition:
  name: "Complete Purchase"
  description: "User adds item to cart and completes checkout"
  user_type: "authenticated_user"

  preconditions:
    - "User is logged in"
    - "At least one product exists"

  steps:
    - step_number: 1
      step_name: "View Product"
      user_action: "Navigate to product page"

      required_elements:
        - selector: "[data-testid='product-title']"
          description: "Product name"
          must_be: "visible"

        - selector: "[data-testid='add-to-cart']"
          description: "Add to Cart button"
          must_be: "visible and enabled"

    - step_number: 2
      step_name: "Add to Cart"
      user_action: "Click 'Add to Cart' button"

      expected_behavior:
        - type: "ui_update"
          result: "Cart icon shows item count (1)"

        - type: "notification"
          result: "Success message appears"

      forbidden_behavior:
        - "Page navigation (should stay on product page)"
        - "Error messages"

    - step_number: 3
      step_name: "View Cart"
      user_action: "Click cart icon"

      expected_behavior:
        - type: "navigation"
          result: "/cart"

      required_elements:
        - selector: "[data-testid='cart-item']"
          description: "Item in cart"
          must_contain: "Product name from step 1"

        - selector: "[data-testid='checkout-button']"
          description: "Proceed to Checkout button"
          must_be: "visible and enabled"

    - step_number: 4
      step_name: "Proceed to Checkout"
      user_action: "Click 'Checkout' button"

      expected_behavior:
        - type: "navigation"
          result: "/checkout"

        - type: "form_display"
          result: "Payment form visible"

      required_elements:
        - selector: "input[name='card_number']"
          must_be: "visible"

        - selector: "button[type='submit']"
          description: "Complete Order button"
          must_be: "visible"

    - step_number: 5
      step_name: "Complete Payment"
      user_action: "Fill payment form and submit"

      expected_behavior:
        - type: "navigation"
          result: "/order-confirmation"

        - type: "api_call"
          result: "POST /api/orders"

      required_elements:
        - selector: "[data-testid='order-number']"
          description: "Order confirmation number"
          must_be: "visible"

  success_criteria:
    - "User sees order confirmation page"
    - "Order number is displayed"
    - "Email confirmation sent"

non_negotiable_rules:
  - id: journey_checkout_001
    title: "Cart must always show item count"
    description: "After adding to cart, icon MUST update with count"

  - id: journey_checkout_002
    title: "Cannot skip payment step"
    description: "Journey MUST go through payment, cannot skip"
```

**Test:**

```typescript
// src/__tests__/journeys/checkout.test.ts
describe('Journey: Complete Purchase', () => {
  it('follows complete checkout flow', async () => {
    // Load journey contract
    const journey = loadContract('journey_checkout.yml')

    // Step 1: View Product
    await page.goto('/products/1')
    await expect(page.locator('[data-testid="product-title"]')).toBeVisible()
    await expect(page.locator('[data-testid="add-to-cart"]')).toBeEnabled()

    // Step 2: Add to Cart
    await page.click('[data-testid="add-to-cart"]')
    await expect(page.locator('[data-testid="cart-count"]')).toHaveText('1')

    // Step 3: View Cart
    await page.click('[data-testid="cart-icon"]')
    expect(page.url()).toContain('/cart')
    await expect(page.locator('[data-testid="cart-item"]')).toBeVisible()

    // Step 4: Checkout
    await page.click('[data-testid="checkout-button"]')
    expect(page.url()).toContain('/checkout')
    await expect(page.locator('input[name="card_number"]')).toBeVisible()

    // Step 5: Complete Payment
    await page.fill('input[name="card_number"]', '4242424242424242')
    await page.click('button[type="submit"]')

    expect(page.url()).toContain('/order-confirmation')
    await expect(page.locator('[data-testid="order-number"]')).toBeVisible()
  })

  it('enforces non-negotiable rule: cart count updates', async () => {
    await page.goto('/products/1')
    const cartBefore = await page.textContent('[data-testid="cart-count"]')

    await page.click('[data-testid="add-to-cart"]')

    const cartAfter = await page.textContent('[data-testid="cart-count"]')
    if (cartBefore === cartAfter) {
      throw new Error(
        'CONTRACT VIOLATION: journey_checkout_001\n' +
        'Cart count did not update after adding item\n' +
        'See: docs/contracts/journey_checkout.yml'
      )
    }
  })
})
```

### Example 2: User Registration

```yaml
# docs/contracts/journey_registration.yml
journey_definition:
  name: "User Registration"
  steps:
    - step_number: 1
      step_name: "Land on Registration Page"
      required_elements:
        - selector: "input[name='email']"
        - selector: "input[name='password']"
        - selector: "button[type='submit']"

    - step_number: 2
      step_name: "Submit Registration"
      user_action: "Fill form and click submit"
      expected_behavior:
        - type: "api_call"
          result: "POST /api/auth/register"
        - type: "email_sent"
          result: "Confirmation email to user"

    - step_number: 3
      step_name: "Email Confirmation"
      user_action: "Click link in email"
      expected_behavior:
        - type: "navigation"
          result: "/confirm-email"
        - type: "account_activation"
          result: "User account activated"

    - step_number: 4
      step_name: "First Login"
      expected_behavior:
        - type: "navigation"
          result: "/dashboard"
        - type: "welcome_message"
          result: "Welcome message shown"
```

---

## Converting Specs to Journey Contracts

### Your Spec Says:

> **User Story:**
> As a user, I want to save my shopping cart so I can return later and complete purchase.

### Journey Contract:

```yaml
journey_definition:
  name: "Save and Resume Cart"

  steps:
    - step_number: 1
      step_name: "Add items to cart"
      user_action: "Add 2 products to cart"
      required_elements:
        - selector: "[data-testid='cart-count']"
          must_show: "2"

    - step_number: 2
      step_name: "Leave site"
      user_action: "Close browser"
      expected_behavior:
        - type: "storage_persist"
          result: "Cart saved to localStorage or server"

    - step_number: 3
      step_name: "Return to site"
      user_action: "Open site again (new session)"
      expected_behavior:
        - type: "cart_restore"
          result: "Cart shows same 2 items"

  success_criteria:
    - "Cart persists across sessions"
    - "Item count matches"
    - "Can proceed to checkout with saved cart"
```

**Test:**

```typescript
it('saves and restores cart across sessions', async () => {
  // Session 1: Add items
  await page.goto('/products')
  await page.click('[data-product-id="1"] [data-testid="add-to-cart"]')
  await page.click('[data-product-id="2"] [data-testid="add-to-cart"]')
  await expect(page.locator('[data-testid="cart-count"]')).toHaveText('2')

  // Close and reopen (simulates return visit)
  await context.close()
  const newContext = await browser.newContext()
  const newPage = await newContext.newPage()

  // Session 2: Check cart persisted
  await newPage.goto('/')
  const cartCount = await newPage.textContent('[data-testid="cart-count"]')

  if (cartCount !== '2') {
    throw new Error(
      'JOURNEY BROKEN: Cart did not persist\n' +
      'Expected 2 items, got ' + cartCount
    )
  }
})
```

---

## Journey Contract Generator (For LLMs)

**Input: User Story**
```
As a logged-in user
I want to edit my profile
So that my information is up to date
```

**Output: Journey Contract** (LLM generates)
```yaml
journey_definition:
  name: "Edit User Profile"
  user_type: "authenticated_user"

  steps:
    - step_number: 1
      step_name: "Navigate to profile"
      user_action: "Click profile icon → Click 'Edit Profile'"
      required_elements:
        - selector: "[data-testid='edit-profile-link']"

    - step_number: 2
      step_name: "Edit form appears"
      required_elements:
        - selector: "input[name='name']"
        - selector: "input[name='email']"
        - selector: "button[type='submit']"

    - step_number: 3
      step_name: "Update profile"
      user_action: "Change name, click save"
      expected_behavior:
        - type: "api_call"
          result: "PUT /api/user/profile"
        - type: "notification"
          result: "Success message shown"

    - step_number: 4
      step_name: "Verify update"
      expected_behavior:
        - type: "ui_update"
          result: "Profile shows new name"
```

**Instruction for LLM:**
```
Given user story:
[paste user story]

Generate journey contract using user-journey-template.yml
Include all steps user takes
Define required elements at each step
Specify expected behavior
```

---

## Benefits

### For Product Managers

✅ **Specs become tests** - Your user stories → enforceable contracts
✅ **Journey validation** - Know when flows break
✅ **No code required** - Write YAML, tests auto-generated

### For QA

✅ **Test what matters** - User journeys, not random units
✅ **Comprehensive coverage** - Entire flow tested
✅ **Regression prevention** - Journeys stay working

### For Engineers

✅ **Refactor safely** - Journey tests ensure behavior preserved
✅ **Clear requirements** - Journey contract = specification
✅ **Fast feedback** - Tests fail immediately on journey break

---

## Setup

### 1. Create Journey Contract

```bash
cp docs/contracts/templates/user-journey-template.yml docs/contracts/journey_my_flow.yml
# Edit to define your journey
```

### 2. Generate Test

```bash
# Use test generator
node scripts/generate-journey-test.js journey_my_flow.yml

# Or copy template
cp docs/contracts/templates/journey-test-template.test.ts src/__tests__/journeys/myFlow.test.ts
# Edit to match journey
```

### 3. Run Test

```bash
npm test -- journeys/myFlow
```

---

## Advanced Patterns

### Pattern 1: Parallel Journeys

```yaml
# Test multiple user types simultaneously
journeys:
  - journey: guest_checkout
    user_type: guest

  - journey: member_checkout
    user_type: authenticated

  - journey: admin_order_management
    user_type: admin
```

### Pattern 2: Journey Variants

```yaml
# Test success and failure paths
journey_definition:
  name: "Login Flow"

  success_path:
    steps: [...]

  failure_paths:
    - name: "Invalid Password"
      at_step: 2
      inject_failure: "Wrong password"
      expected_result: "Error message shown, stays on login page"
```

### Pattern 3: Journey Dependencies

```yaml
# Some journeys require others complete first
journey_definition:
  name: "Leave Product Review"

  depends_on:
    - journey_checkout  # Must complete purchase first

  steps: [...]
```

---

## FAQ

### "How is this different from E2E tests?"

Journey contracts are:
- **Spec-driven** - Written by PMs, not just QA
- **Enforceable** - Tests generated from contracts
- **Comprehensive** - Cover ALL journeys, not sample
- **Documented** - YAML contracts are living documentation

### "Do I need to test every journey?"

Start with **critical journeys:**
1. Purchase/checkout
2. Registration/login
3. Core feature workflows

Add more as you grow.

### "Can LLMs generate journey tests?"

**Yes!** Give LLM:
```
Create journey contract for: [user story]
Use template: docs/contracts/templates/user-journey-template.yml
Then generate test from contract
```

LLM creates both contract and test.

---

**Next Steps:**
1. Copy user-journey-template.yml
2. Define your first journey
3. Generate test
4. Run and iterate

**Test what matters. Test user journeys.**
