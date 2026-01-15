# Part 2: The Spec

> **Role: User**
>
> I'm a solo founder who found the commission queue problem on Reddit. Now I'm writing a spec for QueueCraft using Specflow's SPEC-FORMAT.md as my guide.

---

## My Spec: QueueCraft

```markdown
# QueueCraft Product Specification

## Overview
Commission queue management for creative freelancers. One place to track clients,
deposits, progress, and deadlines.

## Target Users
- Cosplay makers with 3-12 month queues
- Furry/digital artists with 20-100+ pending commissions
- Custom prop/jewelry makers
- Anyone taking deposits for creative work

## Tech Stack
- Next.js 14 (App Router)
- Supabase (Auth + Database)
- Stripe (Payments)
- Playwright (E2E tests)

---

## REQS

### ARCH-001 (MUST)
All database operations must use Row Level Security (RLS).
A user must never see another user's queue or clients.

### ARCH-002 (MUST)
Payment amounts must never be stored in localStorage or exposed in client-side state.
All payment data flows through server actions only.

### ARCH-003 (MUST)
All API routes under /api/* must verify authentication.
No public endpoints except /api/health and /api/webhook/*.

---

### FEAT-001 (MUST)
Users can add clients to their queue with: name, contact method, project description,
quoted price, deposit amount, deposit status (paid/pending), deadline (optional).

### FEAT-002 (MUST)
Queue displays in FIFO order by default (oldest first).
Users can manually reorder but system tracks original position.

### FEAT-003 (MUST)
Each commission has a status: inquiry → quoted → deposit_paid → in_progress →
review → completed → delivered.

### FEAT-004 (MUST)
Users can record deposits with: amount, method (Venmo/PayPal/Cash App/Stripe/Cash),
date received, notes.

### FEAT-005 (MUST)
Dashboard shows: total queue count, total deposits received (this month),
commissions due this week, average turnaround time.

### FEAT-006 (SHOULD)
Clients can receive a unique link to check their position in queue and status
(no login required, link contains auth token).

### FEAT-007 (SHOULD)
Deadline warnings: 7 days before, 3 days before, day-of notifications.

### FEAT-008 (SHOULD)
"Rush fee" toggle that adds percentage to quoted price if deadline < 2 weeks.

---

## JOURNEYS

### J-QUEUE-001: Add New Commission (Critical)
**As a** commissioner
**I want to** quickly add a new client inquiry
**So that** I don't lose track of potential work

**Steps:**
1. Click "Add Commission" button
2. Enter client name and contact method
3. Enter project description
4. Enter quoted price
5. Save as "inquiry" status
6. See commission in queue

**Acceptance:** Commission appears in queue within 1 second of save.

---

### J-QUEUE-002: Record Deposit (Critical)
**As a** commissioner
**I want to** record when a client pays their deposit
**So that** I know they're committed and I can start planning

**Steps:**
1. Open commission detail
2. Click "Record Deposit"
3. Enter amount and payment method
4. Confirm
5. Status changes to "deposit_paid"
6. Queue position locked

**Acceptance:** Deposit recorded, status updated, dashboard totals reflect change.

---

### J-QUEUE-003: Client Checks Status (Important)
**As a** client
**I want to** check my queue position without bothering the artist
**So that** I know roughly when to expect my commission

**Steps:**
1. Click unique status link (from artist)
2. See: position in queue, current status, estimated completion
3. No login required

**Acceptance:** Page loads in < 2 seconds, shows accurate position.

---

### J-QUEUE-004: Move Through Workflow (Critical)
**As a** commissioner
**I want to** update commission status as I work
**So that** I track progress and clients get automatic updates

**Steps:**
1. Open commission
2. Click "Start Work" → status becomes "in_progress"
3. Click "Ready for Review" → status becomes "review"
4. Click "Complete" → status becomes "completed"
5. Click "Delivered" → status becomes "delivered", archived

**Acceptance:** Each status change persists immediately, triggers notification to client.

---

## DEFINITION OF DONE

### Critical (MUST PASS to ship)
- [ ] J-QUEUE-001: Add new commission
- [ ] J-QUEUE-002: Record deposit
- [ ] J-QUEUE-004: Move through workflow
- [ ] ARCH-001: RLS prevents cross-user data access
- [ ] ARCH-002: No payment data in client state
- [ ] ARCH-003: All API routes authenticated

### Important (SHOULD PASS)
- [ ] J-QUEUE-003: Client status check
- [ ] FEAT-005: Dashboard metrics accurate
- [ ] FEAT-007: Deadline warnings fire

### Future (NOT BLOCKING)
- [ ] FEAT-008: Rush fee calculation
- [ ] Export queue to CSV
- [ ] Stripe integration for in-app deposits
```

---

## What I Just Did

As the user, I:

1. **Started with architecture** (ARCH-xxx) - the non-negotiable structural rules
2. **Added features** (FEAT-xxx) - what the product does
3. **Defined journeys** (J-xxx) - actual user flows
4. **Prioritized the DOD** - what MUST work vs. nice-to-have

This spec follows Specflow's SPEC-FORMAT.md exactly. Now I hand it to the LLM.

---

## The Handoff

My prompt to the LLM:

```
Read LLM-MASTER-PROMPT.md.

Build QueueCraft from this spec. Follow the Specflow methodology:
1. Generate architecture contracts FIRST (ARCH-xxx)
2. Generate feature contracts (FEAT-xxx)
3. Generate journey contracts (J-xxx)
4. Implement with Playwright E2E tests
5. Verify all contracts pass before considering done

Here's the spec:
[paste spec above]
```

---

**Next:** [Part 3: Architecture Contracts →](03-architecture-contracts.md)
