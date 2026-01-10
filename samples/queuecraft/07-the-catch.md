# Part 7: The Catch

> **The moment that makes Specflow worth it.**
>
> This is where a contract catches a violation that unit tests would miss.

---

## The Setup

It's day 3 of building QueueCraft. Everything is going well. All unit tests pass. The journey tests pass.

Then I ask the LLM to add a "quick add" feature - let users add a commission without opening the full form.

---

## The "Optimization"

The LLM writes this:

```tsx
// src/components/quick-add.tsx
'use client'

import { useState } from 'react'

export function QuickAdd() {
  const [clientName, setClientName] = useState('')
  const [price, setPrice] = useState('')

  async function handleQuickAdd() {
    // Store in localStorage for the form to pick up later
    localStorage.setItem('pendingCommission', JSON.stringify({
      client_name: clientName,
      quoted_price: parseFloat(price),
      deposit_amount: 0,
    }))

    // Navigate to full form
    window.location.href = '/dashboard/new'
  }

  return (
    <div className="flex gap-2">
      <input
        placeholder="Client name"
        value={clientName}
        onChange={(e) => setClientName(e.target.value)}
      />
      <input
        placeholder="Price"
        type="number"
        value={price}
        onChange={(e) => setPrice(e.target.value)}
      />
      <button onClick={handleQuickAdd}>Quick Add</button>
    </div>
  )
}
```

---

## Unit Tests: All Green

```typescript
// src/__tests__/quick-add.test.tsx

import { render, fireEvent } from '@testing-library/react'
import { QuickAdd } from '@/components/quick-add'

describe('QuickAdd', () => {
  it('stores pending commission data', () => {
    const { getByPlaceholder, getByText } = render(<QuickAdd />)

    fireEvent.change(getByPlaceholder('Client name'), {
      target: { value: 'Test Client' }
    })
    fireEvent.change(getByPlaceholder('Price'), {
      target: { value: '500' }
    })
    fireEvent.click(getByText('Quick Add'))

    const stored = localStorage.getItem('pendingCommission')
    expect(stored).not.toBeNull()
    expect(JSON.parse(stored!).client_name).toBe('Test Client')
    expect(JSON.parse(stored!).quoted_price).toBe(500)
  })

  it('renders input fields', () => {
    const { getByPlaceholder } = render(<QuickAdd />)
    expect(getByPlaceholder('Client name')).toBeInTheDocument()
    expect(getByPlaceholder('Price')).toBeInTheDocument()
  })
})
```

```bash
npm test -- quick-add

# ✓ stores pending commission data (45ms)
# ✓ renders input fields (12ms)
# Test Suites: 1 passed, 1 total
# Tests:       2 passed, 2 total
```

**All tests pass.** Ship it, right?

---

## Contract Tests: VIOLATION

```bash
npm test -- contracts

# FAIL src/__tests__/contracts/architecture.test.ts
#
# CONTRACT VIOLATION: ARCH-002
# Payment data found in localStorage:
#   - src/components/quick-add.tsx
#
# Fix: Use server actions for payment data
#
# Contract: docs/contracts/feature_architecture.yml
```

---

## What the Contract Caught

The LLM's "optimization" stores `quoted_price` (payment data) in localStorage.

```typescript
localStorage.setItem('pendingCommission', JSON.stringify({
  client_name: clientName,
  quoted_price: parseFloat(price),  // 💥 ARCH-002 VIOLATION
  deposit_amount: 0,
}))
```

**Why this is bad:**
- localStorage is accessible to any script on the domain
- XSS attack could read pending commission prices
- Price manipulation before form submission
- Violates our security architecture

**Why unit tests didn't catch it:**
- Unit tests check if localStorage.setItem was called
- They don't know it's a BAD thing to do
- They verify functionality, not architecture

**Why the contract caught it:**

```yaml
# From ARCH-002 in feature_architecture.yml
forbidden_patterns:
  - pattern: /localStorage\.(set|get)Item\([^)]*(?:payment|amount|price|deposit)/i
    message: "Payment data must not be stored in localStorage"
```

The pattern `/localStorage.*price/i` matches `localStorage.setItem(...quoted_price...)`.

---

## The Fix

```tsx
// src/components/quick-add.tsx
'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'

export function QuickAdd() {
  const [clientName, setClientName] = useState('')
  const [price, setPrice] = useState('')
  const router = useRouter()

  function handleQuickAdd() {
    // ARCH-002 COMPLIANT: Use URL params, not localStorage
    // Price travels through URL to server, never stored client-side
    const params = new URLSearchParams({
      client: clientName,
      price: price,  // Server will validate
    })

    router.push(`/dashboard/new?${params.toString()}`)
  }

  return (
    <div className="flex gap-2">
      <input
        placeholder="Client name"
        value={clientName}
        onChange={(e) => setClientName(e.target.value)}
      />
      <input
        placeholder="Price"
        type="number"
        value={price}
        onChange={(e) => setPrice(e.target.value)}
      />
      <button onClick={handleQuickAdd}>Quick Add</button>
    </div>
  )
}
```

**Why this is better:**
- URL params are ephemeral, not persisted
- Server validates price on receipt
- No localStorage = no XSS attack vector
- Still achieves "quick add" functionality

---

## Run Contracts Again

```bash
npm test -- contracts

# ✓ ARCH-001: No raw database queries without user context
# ✓ ARCH-002: No payment amounts in localStorage
# ✓ ARCH-003: All API routes verify authentication
# ✓ FEAT-002: Queue queries order by created_at
# ✓ FEAT-003: Only uses defined status values

# Test Suites: 1 passed, 1 total
# Tests:       5 passed, 5 total
```

---

## The Lesson

```
┌─────────────────────────────────────────────────────────────┐
│                     WHAT CAUGHT WHAT                        │
├─────────────────────────────────────────────────────────────┤
│                                                             │
│  Unit Tests:                                                │
│    ✅ "Does localStorage.setItem get called?" → Yes         │
│    ✅ "Is the data formatted correctly?" → Yes              │
│    ❌ "Is this violating our security architecture?" → ???  │
│                                                             │
│  Contract Tests:                                            │
│    ✅ "Is payment data being stored in localStorage?" → YES │
│    ✅ "VIOLATION DETECTED" → Build blocked                  │
│                                                             │
└─────────────────────────────────────────────────────────────┘
```

**Unit tests verify behavior. Contract tests verify architecture.**

Both are necessary. Neither is sufficient alone.

---

## This Is Why Specflow Exists

The LLM didn't make a "mistake" - it solved the problem efficiently. localStorage is a reasonable optimization for persisting form data.

But it violated an architectural constraint the LLM didn't know about (or forgot about, or deprioritized).

**Contracts externalize constraints.**

They exist outside the LLM's context window. They're checked automatically. They don't rely on the LLM remembering what matters.

---

**Next:** [Part 8: Summary →](08-summary.md)
