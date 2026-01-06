# Part 6: Implementation

> **Role: LLM (continued)**
>
> Contracts are defined. Now I implement QueueCraft.
> Every line of code must pass the contracts.

---

## The Implementation Mindset

Before writing ANY code, I check:

1. **What architecture constraints apply?**
2. **What feature rules must I follow?**
3. **What journey will this code support?**

```
┌─────────────────────────────────────────┐
│  Code I'm writing: Add Commission Form  │
├─────────────────────────────────────────┤
│  Architecture:                          │
│    ARCH-001: Must use RLS/user context  │
│    ARCH-003: API route needs auth       │
│                                         │
│  Features:                              │
│    FEAT-001: Required fields            │
│    FEAT-003: Status must be 'inquiry'   │
│                                         │
│  Journey:                               │
│    J-QUEUE-001: Add New Commission      │
└─────────────────────────────────────────┘
```

---

## Project Structure

```
queuecraft/
├── src/
│   ├── app/
│   │   ├── api/
│   │   │   ├── commissions/
│   │   │   │   └── route.ts          # ARCH-003: Needs auth
│   │   │   └── health/
│   │   │       └── route.ts          # Excluded from ARCH-003
│   │   ├── dashboard/
│   │   │   └── page.tsx
│   │   └── login/
│   │       └── page.tsx
│   ├── components/
│   │   ├── commission-form.tsx
│   │   ├── commission-list.tsx
│   │   └── deposit-modal.tsx
│   ├── lib/
│   │   ├── actions/
│   │   │   ├── commissions.ts        # Server actions
│   │   │   └── deposits.ts
│   │   ├── supabase/
│   │   │   ├── client.ts
│   │   │   └── server.ts
│   │   └── types/
│   │       └── commission.ts
│   └── __tests__/
│       └── contracts/
│           ├── architecture.test.ts
│           └── queue_management.test.ts
├── tests/
│   └── e2e/
│       ├── journey_add_commission.spec.ts
│       └── journey_record_deposit.spec.ts
└── docs/
    └── contracts/
        ├── feature_architecture.yml
        ├── feature_queue_management.yml
        └── journey_add_commission.yml
```

---

## Implementation: Types

```typescript
// src/lib/types/commission.ts

/**
 * Commission type - implements FEAT-001 required fields
 */
export type CommissionStatus =
  | 'inquiry'
  | 'quoted'
  | 'deposit_paid'
  | 'in_progress'
  | 'review'
  | 'completed'
  | 'delivered'  // FEAT-003: Valid status values

export interface Commission {
  id: string
  user_id: string           // ARCH-001: RLS key
  client_name: string       // FEAT-001: Required
  contact_method: string    // FEAT-001: Required
  project_description: string
  quoted_price: number      // FEAT-001: Required
  deposit_amount: number
  deposit_status: 'pending' | 'paid'  // FEAT-001: Required
  status: CommissionStatus  // FEAT-003: Valid values only
  deadline?: string
  queue_position: number    // FEAT-002: For reordering
  created_at: string        // FEAT-002: For FIFO ordering
}

export interface Deposit {
  id: string
  commission_id: string
  amount: number            // FEAT-004: Required
  payment_method: PaymentMethod  // FEAT-004: Required
  received_at: string       // FEAT-004: Required
  notes?: string
}

export type PaymentMethod = 'venmo' | 'paypal' | 'cashapp' | 'stripe' | 'cash'
```

---

## Implementation: Server Action

```typescript
// src/lib/actions/commissions.ts
'use server'

import { createServerClient } from '@/lib/supabase/server'
import { revalidatePath } from 'next/cache'
import type { Commission } from '@/lib/types/commission'

/**
 * Create new commission
 * - ARCH-001: Uses RLS via user context
 * - ARCH-003: Server action = authenticated by default
 * - FEAT-001: Requires all core fields
 * - FEAT-003: Sets initial status to 'inquiry'
 */
export async function createCommission(data: {
  client_name: string
  contact_method: string
  project_description: string
  quoted_price: number
  deposit_amount?: number
  deadline?: string
}): Promise<{ data: Commission | null; error: string | null }> {
  const supabase = await createServerClient()

  // ARCH-001: Get authenticated user
  const { data: { user }, error: authError } = await supabase.auth.getUser()
  if (authError || !user) {
    return { data: null, error: 'Unauthorized' }
  }

  // FEAT-003: New commissions start as 'inquiry'
  const { data: commission, error } = await supabase
    .from('commissions')
    .insert({
      user_id: user.id,  // ARCH-001: Scoped to user
      client_name: data.client_name,
      contact_method: data.contact_method,
      project_description: data.project_description,
      quoted_price: data.quoted_price,
      deposit_amount: data.deposit_amount ?? 0,
      deposit_status: 'pending',
      status: 'inquiry',  // FEAT-003: Valid initial status
    })
    .select()
    .single()

  if (error) {
    return { data: null, error: error.message }
  }

  revalidatePath('/dashboard')
  return { data: commission, error: null }
}

/**
 * Get user's commission queue
 * - ARCH-001: RLS ensures user only sees their data
 * - FEAT-002: Orders by created_at (FIFO)
 */
export async function getCommissionQueue(): Promise<Commission[]> {
  const supabase = await createServerClient()

  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return []

  const { data } = await supabase
    .from('commissions')
    .select('*')
    .eq('user_id', user.id)  // ARCH-001: User context
    .order('created_at', { ascending: true })  // FEAT-002: FIFO
    .neq('status', 'delivered')  // Don't show archived

  return data ?? []
}

/**
 * Update commission status
 * - FEAT-003: Validates status value
 */
export async function updateCommissionStatus(
  commissionId: string,
  status: Commission['status']
): Promise<{ error: string | null }> {
  const supabase = await createServerClient()

  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return { error: 'Unauthorized' }

  // FEAT-003: TypeScript enforces valid status values
  const { error } = await supabase
    .from('commissions')
    .update({ status })
    .eq('id', commissionId)
    .eq('user_id', user.id)  // ARCH-001: Can't update others' data

  revalidatePath('/dashboard')
  return { error: error?.message ?? null }
}
```

---

## Implementation: Commission Form Component

```tsx
// src/components/commission-form.tsx
'use client'

import { useState } from 'react'
import { createCommission } from '@/lib/actions/commissions'

/**
 * Commission form - supports J-QUEUE-001 journey
 * Uses data-testid attributes for Playwright
 */
export function CommissionForm({ onClose }: { onClose: () => void }) {
  const [loading, setLoading] = useState(false)
  const [errors, setErrors] = useState<Record<string, string>>({})

  async function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault()
    setLoading(true)
    setErrors({})

    const formData = new FormData(e.currentTarget)

    // Client-side validation
    const newErrors: Record<string, string> = {}
    if (!formData.get('client_name')) {
      newErrors.client_name = 'Client name is required'
    }
    if (!formData.get('quoted_price')) {
      newErrors.quoted_price = 'Quoted price is required'
    }

    if (Object.keys(newErrors).length > 0) {
      setErrors(newErrors)
      setLoading(false)
      return
    }

    const result = await createCommission({
      client_name: formData.get('client_name') as string,
      contact_method: formData.get('contact_method') as string,
      project_description: formData.get('project_description') as string,
      quoted_price: parseFloat(formData.get('quoted_price') as string),
      deadline: formData.get('deadline') as string || undefined,
    })

    setLoading(false)

    if (result.error) {
      setErrors({ form: result.error })
    } else {
      onClose()
    }
  }

  return (
    <form
      onSubmit={handleSubmit}
      data-testid="commission-form"  // J-QUEUE-001: Step 1
      className="space-y-4"
    >
      <div>
        <label htmlFor="client_name">Client Name *</label>
        <input
          id="client_name"
          name="client_name"
          data-testid="client-name-input"  // J-QUEUE-001: Step 2
          className="w-full border rounded px-3 py-2"
        />
        {errors.client_name && (
          <span data-testid="error-client-name" className="text-red-500">
            {errors.client_name}
          </span>
        )}
      </div>

      <div>
        <label htmlFor="contact_method">Contact Method</label>
        <input
          id="contact_method"
          name="contact_method"
          data-testid="contact-method-input"  // J-QUEUE-001: Step 3
          placeholder="discord:username#1234"
          className="w-full border rounded px-3 py-2"
        />
      </div>

      <div>
        <label htmlFor="project_description">Project Description</label>
        <textarea
          id="project_description"
          name="project_description"
          data-testid="project-description-input"  // J-QUEUE-001: Step 4
          rows={3}
          className="w-full border rounded px-3 py-2"
        />
      </div>

      <div>
        <label htmlFor="quoted_price">Quoted Price ($) *</label>
        <input
          id="quoted_price"
          name="quoted_price"
          type="number"
          step="0.01"
          data-testid="quoted-price-input"  // J-QUEUE-001: Step 5
          className="w-full border rounded px-3 py-2"
        />
        {errors.quoted_price && (
          <span data-testid="error-quoted-price" className="text-red-500">
            {errors.quoted_price}
          </span>
        )}
      </div>

      <div>
        <label htmlFor="deadline">Deadline (optional)</label>
        <input
          id="deadline"
          name="deadline"
          type="date"
          data-testid="deadline-input"
          className="w-full border rounded px-3 py-2"
        />
      </div>

      {errors.form && (
        <div className="text-red-500">{errors.form}</div>
      )}

      <button
        type="submit"
        disabled={loading}
        data-testid="save-commission-btn"  // J-QUEUE-001: Step 6
        className="w-full bg-blue-600 text-white py-2 rounded hover:bg-blue-700 disabled:opacity-50"
      >
        {loading ? 'Saving...' : 'Save Commission'}
      </button>
    </form>
  )
}
```

---

## Running the Tests

```bash
# Run contract tests (pattern scanning)
npm test -- contracts

# Output:
# ✓ ARCH-001: No raw database queries without user context
# ✓ ARCH-002: No payment amounts in localStorage
# ✓ ARCH-003: All API routes verify authentication
# ✓ FEAT-002: Queue queries order by created_at
# ✓ FEAT-003: Only uses defined status values
# ✓ FEAT-004: Deposit operations include required fields

# Run journey tests (E2E)
npx playwright test

# Output:
# ✓ J-QUEUE-001: Commissioner can add new client inquiry (1.2s)
# ✓ J-QUEUE-001: Form validates required fields (0.8s)
# ✓ J-QUEUE-002: Commissioner can record deposit (1.5s)
```

---

## Contracts Guided Implementation

Notice how contracts influenced every decision:

| Code Section | Contract | What It Enforced |
|--------------|----------|------------------|
| `supabase.auth.getUser()` | ARCH-001 | User context required |
| `.eq('user_id', user.id)` | ARCH-001 | RLS filter |
| `status: 'inquiry'` | FEAT-003 | Valid initial status |
| `.order('created_at', {...})` | FEAT-002 | FIFO ordering |
| `data-testid` attributes | J-QUEUE-001 | Playwright selectors |

**I couldn't "forget" these requirements.** The contracts are my checklist.

---

**Next:** [Part 7: The Catch →](07-the-catch.md)
