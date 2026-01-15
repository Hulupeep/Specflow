# Part 3: Architecture Contracts

> **Role: LLM**
>
> I received the QueueCraft spec. My first job: generate architecture contracts.
> Architecture comes FIRST because it defines the structural invariants everything else depends on.

---

## The Fundamental Equation

```
Architecture + Features + Journeys = The Product
```

**This is not optional.** If you skip architecture:
- The LLM will infer one anyway
- But you won't know what it assumed
- When something breaks, you won't know why

**Architecture contracts are the foundation.** Features build on them. Journeys prove them.

---

## What Architecture Defines

Architecture contracts answer: **"What must ALWAYS be true, regardless of features?"**

- Data isolation (multi-tenancy)
- Security boundaries (auth requirements)
- Data sensitivity (what never goes to client)
- API structure (what's public vs. protected)

These aren't features. They're constraints that every feature must respect.

---

## The Architecture Contract

```yaml
# docs/contracts/feature_architecture.yml

contract_meta:
  id: feature_architecture
  version: 1
  created_from_spec: "docs/specs/queuecraft.md"
  covers_reqs:
    - ARCH-001
    - ARCH-002
    - ARCH-003
  owner: "core-team"

llm_policy:
  enforce: true
  llm_may_modify_non_negotiables: false
  override_phrase: "override_contract: feature_architecture"

rules:
  non_negotiable:

    # ARCH-001: Row Level Security
    - id: ARCH-001
      title: "All database operations must use RLS"
      scope:
        - "src/**/*.ts"
        - "src/**/*.tsx"
        - "!src/**/*.test.ts"
      behavior:
        forbidden_patterns:
          # Raw SQL without RLS context
          - pattern: /supabase\.from\(['"]\w+['"]\)\.select\(\)(?!.*\.eq\(['"]user_id['"])/
            message: "Query missing user_id filter - RLS violation risk"
          # Service role client in non-server code
          - pattern: /createClient.*service_role/
            message: "Service role client must only be used in server actions"
        required_patterns:
          - pattern: /supabase\.auth\.getUser\(\)/
            message: "Must verify user before database operations"
        example_violation: |
          // WRONG - No user context, could leak other users' data
          const { data } = await supabase.from('commissions').select()
        example_compliant: |
          // CORRECT - Scoped to authenticated user
          const { data: { user } } = await supabase.auth.getUser()
          const { data } = await supabase
            .from('commissions')
            .select()
            .eq('user_id', user.id)

    # ARCH-002: No payment data on client
    - id: ARCH-002
      title: "Payment amounts never in client state"
      scope:
        - "src/app/**/*.tsx"
        - "src/components/**/*.tsx"
        - "!src/app/api/**"
      behavior:
        forbidden_patterns:
          - pattern: /localStorage\.(set|get)Item\([^)]*(?:payment|amount|price|deposit)/i
            message: "Payment data must not be stored in localStorage"
          - pattern: /useState.*(?:payment|totalAmount|depositAmount)/i
            message: "Payment amounts should not be in React state - use server state"
          - pattern: /sessionStorage.*(?:payment|amount|price)/i
            message: "Payment data must not be stored in sessionStorage"
        example_violation: |
          // WRONG - Payment data in client state
          const [depositAmount, setDepositAmount] = useState(0)
          localStorage.setItem('pendingPayment', amount)
        example_compliant: |
          // CORRECT - Payment data fetched from server, not stored client-side
          const { data } = await getCommissionDetails(id) // Server action
          // Display only, no client storage

    # ARCH-003: API routes require auth
    - id: ARCH-003
      title: "All API routes must verify authentication"
      scope:
        - "src/app/api/**/*.ts"
        - "!src/app/api/health/**"
        - "!src/app/api/webhook/**"
      behavior:
        forbidden_patterns:
          - pattern: /export\s+(async\s+)?function\s+(GET|POST|PUT|DELETE|PATCH).*\{[^}]*(?!getUser|auth|session)/
            message: "API route may be missing authentication check"
        required_patterns:
          - pattern: /(?:getUser|auth|getSession|verifyAuth)/
            message: "Must verify authentication in API route"
        example_violation: |
          // WRONG - No auth check
          export async function GET(req: Request) {
            const data = await db.query('SELECT * FROM commissions')
            return Response.json(data)
          }
        example_compliant: |
          // CORRECT - Auth verified first
          export async function GET(req: Request) {
            const { data: { user } } = await supabase.auth.getUser()
            if (!user) return new Response('Unauthorized', { status: 401 })
            const data = await db.query('SELECT * FROM commissions WHERE user_id = ?', [user.id])
            return Response.json(data)
          }

compliance_checklist:
  before_editing_files:
    - question: "Does this code access the database?"
      if_yes: "Ensure user_id filter is applied and RLS is active"
    - question: "Does this code handle payment amounts?"
      if_yes: "Keep all payment logic in server actions, never in client state"
    - question: "Is this an API route?"
      if_yes: "Add authentication check unless it's /health or /webhook/*"

test_hooks:
  tests:
    - file: "src/__tests__/contracts/architecture.test.ts"
      description: "Scans for ARCH-001, ARCH-002, ARCH-003 violations"
```

---

## What This Contract Enforces

| ID | Rule | Catches |
|----|------|---------|
| ARCH-001 | RLS everywhere | Queries without user context |
| ARCH-002 | No client payment state | localStorage/useState with payment data |
| ARCH-003 | API auth required | Unprotected API routes |

---

## The Test That Enforces It

```typescript
// src/__tests__/contracts/architecture.test.ts

import { describe, it, expect } from '@jest/globals'
import * as fs from 'fs'
import * as glob from 'glob'

describe('Contract: feature_architecture', () => {

  describe('ARCH-001: RLS Required', () => {
    it('No raw database queries without user context', () => {
      const files = glob.sync('src/**/*.{ts,tsx}', {
        ignore: ['**/*.test.ts', '**/api/**']
      })
      const violations: string[] = []

      for (const file of files) {
        const content = fs.readFileSync(file, 'utf-8')
        // Check for supabase queries without user filtering
        if (/supabase\.from\(['"]\w+['"]\)\.select\(\)/.test(content) &&
            !/\.eq\(['"]user_id['"]/.test(content)) {
          violations.push(file)
        }
      }

      if (violations.length > 0) {
        throw new Error(
          `CONTRACT VIOLATION: ARCH-001\n` +
          `Database queries missing user_id filter:\n` +
          violations.map(f => `  - ${f}`).join('\n') +
          `\n\nFix: Add .eq('user_id', user.id) to queries`
        )
      }
    })
  })

  describe('ARCH-002: No Payment Data in Client', () => {
    it('No payment amounts in localStorage', () => {
      const files = glob.sync('src/app/**/*.tsx')
      const violations: string[] = []

      for (const file of files) {
        const content = fs.readFileSync(file, 'utf-8')
        if (/localStorage\.(set|get)Item\([^)]*(?:payment|amount|deposit)/i.test(content)) {
          violations.push(file)
        }
      }

      if (violations.length > 0) {
        throw new Error(
          `CONTRACT VIOLATION: ARCH-002\n` +
          `Payment data found in localStorage:\n` +
          violations.map(f => `  - ${f}`).join('\n') +
          `\n\nFix: Use server actions for payment data`
        )
      }
    })
  })

  describe('ARCH-003: API Auth Required', () => {
    it('All API routes verify authentication', () => {
      const files = glob.sync('src/app/api/**/*.ts', {
        ignore: ['**/health/**', '**/webhook/**']
      })
      const violations: string[] = []

      for (const file of files) {
        const content = fs.readFileSync(file, 'utf-8')
        const hasHandler = /export\s+(async\s+)?function\s+(GET|POST|PUT|DELETE|PATCH)/.test(content)
        const hasAuth = /(?:getUser|auth\.getSession|verifyAuth)/.test(content)

        if (hasHandler && !hasAuth) {
          violations.push(file)
        }
      }

      if (violations.length > 0) {
        throw new Error(
          `CONTRACT VIOLATION: ARCH-003\n` +
          `API routes missing authentication:\n` +
          violations.map(f => `  - ${f}`).join('\n') +
          `\n\nFix: Add auth check at start of handler`
        )
      }
    })
  })
})
```

---

## Why Architecture First?

If I had started with features:
- I might build a "record deposit" feature
- That stores `depositAmount` in React state
- Unit tests pass (it displays correctly!)
- But ARCH-002 is violated
- And I wouldn't know until production

**Architecture contracts catch this immediately.**

The LLM now knows:
- Every query needs user context
- Payment data stays server-side
- Every API route needs auth

Every feature I build will respect these constraints.

---

**Next:** [Part 4: Feature Contracts →](04-feature-contracts.md)
