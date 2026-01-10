# Part 4: Feature Contracts

> **Role: LLM (continued)**
>
> Architecture is set. Now I generate feature contracts for FEAT-001 through FEAT-008.
> These define what the product does, built on top of the architecture constraints.

---

## Features Build on Architecture

```
┌─────────────────────────────────────────┐
│           JOURNEYS (user flows)         │  ← What users accomplish
├─────────────────────────────────────────┤
│           FEATURES (capabilities)       │  ← What the product does
├─────────────────────────────────────────┤
│         ARCHITECTURE (invariants)       │  ← What's always true
└─────────────────────────────────────────┘
```

Every feature I build must respect ARCH-001, ARCH-002, ARCH-003.
The feature contracts add product-specific rules.

---

## The Feature Contract

```yaml
# docs/contracts/feature_queue_management.yml

contract_meta:
  id: feature_queue_management
  version: 1
  created_from_spec: "docs/specs/queuecraft.md"
  covers_reqs:
    - FEAT-001
    - FEAT-002
    - FEAT-003
    - FEAT-004
    - FEAT-005
  owner: "product-team"

llm_policy:
  enforce: true
  llm_may_modify_non_negotiables: false
  override_phrase: "override_contract: feature_queue_management"

rules:
  non_negotiable:

    # FEAT-001: Commission data model
    - id: FEAT-001
      title: "Commission requires core fields"
      scope:
        - "src/app/**/commission/**"
        - "src/components/**/commission/**"
        - "src/lib/types/**"
      behavior:
        required_patterns:
          - pattern: /client_name|clientName/
            message: "Commission must have client name field"
          - pattern: /contact_method|contactMethod/
            message: "Commission must have contact method field"
          - pattern: /quoted_price|quotedPrice/
            message: "Commission must have quoted price field"
          - pattern: /deposit_status|depositStatus/
            message: "Commission must track deposit status"
        example_compliant: |
          interface Commission {
            id: string
            user_id: string
            client_name: string
            contact_method: string
            project_description: string
            quoted_price: number
            deposit_amount: number
            deposit_status: 'pending' | 'paid'
            deadline?: Date
            created_at: Date
          }

    # FEAT-002: Queue ordering
    - id: FEAT-002
      title: "Queue defaults to FIFO ordering"
      scope:
        - "src/app/**/queue/**"
        - "src/components/**/queue/**"
      behavior:
        required_patterns:
          - pattern: /order.*created_at|created_at.*asc|orderBy.*createdAt/i
            message: "Queue must order by creation date (FIFO) by default"
        example_violation: |
          // WRONG - No default ordering, could be random
          const queue = await getCommissions()
        example_compliant: |
          // CORRECT - Explicit FIFO ordering
          const queue = await supabase
            .from('commissions')
            .select()
            .order('created_at', { ascending: true })

    # FEAT-003: Status workflow
    - id: FEAT-003
      title: "Commission status follows defined workflow"
      scope:
        - "src/**/*.ts"
        - "src/**/*.tsx"
      behavior:
        required_patterns:
          - pattern: /inquiry|quoted|deposit_paid|in_progress|review|completed|delivered/
            message: "Must use defined status values"
        forbidden_patterns:
          - pattern: /status.*=.*['"](?!inquiry|quoted|deposit_paid|in_progress|review|completed|delivered)['"]/
            message: "Invalid status value - must be one of: inquiry, quoted, deposit_paid, in_progress, review, completed, delivered"
        example_violation: |
          // WRONG - Invalid status
          commission.status = 'done'  // Not a valid status!
        example_compliant: |
          // CORRECT - Valid workflow status
          commission.status = 'completed'

    # FEAT-004: Deposit recording
    - id: FEAT-004
      title: "Deposits require amount, method, and date"
      scope:
        - "src/app/**/deposit/**"
        - "src/lib/actions/deposit*"
      behavior:
        required_patterns:
          - pattern: /amount/
            message: "Deposit must record amount"
          - pattern: /method|payment_method|paymentMethod/
            message: "Deposit must record payment method"
          - pattern: /date|received_at|receivedAt|created_at/
            message: "Deposit must record date received"
        example_compliant: |
          interface Deposit {
            id: string
            commission_id: string
            amount: number
            payment_method: 'venmo' | 'paypal' | 'cashapp' | 'stripe' | 'cash'
            received_at: Date
            notes?: string
          }

  soft:
    # FEAT-006: Client status page (nice to have)
    - id: FEAT-006
      title: "Client status pages should be read-only"
      suggestion: "Client status links should not allow edits"
      llm_may_bend_if:
        - "User explicitly wants client-editable features"

    # FEAT-007: Deadline warnings
    - id: FEAT-007
      title: "Deadline warnings at 7, 3, and 1 day"
      suggestion: "Implement notification triggers for deadline proximity"
      llm_may_bend_if:
        - "MVP scope doesn't include notifications"

    # FEAT-008: Rush fees
    - id: FEAT-008
      title: "Rush fee for < 2 week deadlines"
      suggestion: "Auto-calculate rush fee percentage"
      llm_may_bend_if:
        - "Manual pricing preferred"

compliance_checklist:
  before_editing_files:
    - question: "Creating or modifying commission data?"
      if_yes: "Ensure all required fields are present (FEAT-001)"
    - question: "Displaying commission queue?"
      if_yes: "Order by created_at ascending (FEAT-002)"
    - question: "Changing commission status?"
      if_yes: "Use only valid status values (FEAT-003)"
    - question: "Recording a deposit?"
      if_yes: "Include amount, method, and date (FEAT-004)"

test_hooks:
  tests:
    - file: "src/__tests__/contracts/queue_management.test.ts"
      description: "Validates FEAT-001 through FEAT-005"
```

---

## The Feature Test

```typescript
// src/__tests__/contracts/queue_management.test.ts

import { describe, it, expect } from '@jest/globals'
import * as fs from 'fs'
import * as glob from 'glob'

describe('Contract: feature_queue_management', () => {

  describe('FEAT-002: Queue FIFO Ordering', () => {
    it('Queue queries order by created_at', () => {
      const files = glob.sync('src/**/queue/**/*.{ts,tsx}')
      const violations: string[] = []

      for (const file of files) {
        const content = fs.readFileSync(file, 'utf-8')
        // Has a select but no ordering
        if (/\.select\(/.test(content) && !/order.*created_at|orderBy/i.test(content)) {
          violations.push(file)
        }
      }

      if (violations.length > 0) {
        throw new Error(
          `CONTRACT VIOLATION: FEAT-002\n` +
          `Queue queries missing FIFO ordering:\n` +
          violations.map(f => `  - ${f}`).join('\n') +
          `\n\nFix: Add .order('created_at', { ascending: true })`
        )
      }
    })
  })

  describe('FEAT-003: Valid Status Values', () => {
    it('Only uses defined status values', () => {
      const validStatuses = ['inquiry', 'quoted', 'deposit_paid', 'in_progress', 'review', 'completed', 'delivered']
      const files = glob.sync('src/**/*.{ts,tsx}')
      const violations: Array<{file: string, line: number, value: string}> = []

      for (const file of files) {
        const content = fs.readFileSync(file, 'utf-8')
        const lines = content.split('\n')

        lines.forEach((line, idx) => {
          // Look for status assignments
          const match = line.match(/status.*=.*['"](\w+)['"]/)
          if (match && !validStatuses.includes(match[1])) {
            violations.push({ file, line: idx + 1, value: match[1] })
          }
        })
      }

      if (violations.length > 0) {
        throw new Error(
          `CONTRACT VIOLATION: FEAT-003\n` +
          `Invalid status values found:\n` +
          violations.map(v => `  - ${v.file}:${v.line} - "${v.value}"`).join('\n') +
          `\n\nValid values: ${validStatuses.join(', ')}`
        )
      }
    })
  })

  describe('FEAT-004: Deposit Data Model', () => {
    it('Deposit operations include required fields', () => {
      const files = glob.sync('src/**/deposit*.{ts,tsx}')
      const violations: string[] = []

      for (const file of files) {
        const content = fs.readFileSync(file, 'utf-8')
        const hasInsert = /\.insert\(|createDeposit|recordDeposit/.test(content)

        if (hasInsert) {
          if (!/amount/.test(content)) violations.push(`${file}: missing amount`)
          if (!/method|payment_method/.test(content)) violations.push(`${file}: missing payment_method`)
        }
      }

      if (violations.length > 0) {
        throw new Error(
          `CONTRACT VIOLATION: FEAT-004\n` +
          `Deposit operations missing required fields:\n` +
          violations.map(v => `  - ${v}`).join('\n')
        )
      }
    })
  })
})
```

---

## Feature Contracts vs Architecture Contracts

| Aspect | Architecture | Features |
|--------|--------------|----------|
| Scope | Entire app | Specific functionality |
| Changes | Rarely | With product evolution |
| Violations | Security/integrity risk | Broken functionality |
| Example | "Auth required on API" | "Queue uses FIFO order" |

Architecture contracts are **structural** - they define boundaries.
Feature contracts are **behavioral** - they define what happens within those boundaries.

---

**Next:** [Part 5: Journey Contracts →](05-journey-contracts.md)
