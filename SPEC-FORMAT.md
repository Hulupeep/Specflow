# Spec Format – From Vibes to Contracts

Write specs in a **minimal structure** so LLMs can reliably turn them into contracts.

---

## Why This Format?

**Problem:** You write prose specs → LLM guesses at meaning → contracts miss critical details

**Solution:** Constrained format with IDs → LLM parses deterministically → contracts map 1:1 to requirements

---

## 1. File Layout

Each feature gets its own spec file under `docs/specs/`, e.g.:

```
docs/specs/
├── authentication.md
├── email-service.md
├── payment-processing.md
└── user-profile.md
```

**One feature per file.** Don't create god-specs.

---

## 2. Section Layout

Each spec file uses the same structure:

```markdown
# Feature: [Feature Name]

## REQS

### [REQ-ID] (MUST)
[Requirement description]

### [REQ-ID] (SHOULD)
[Preferred behavior, not enforced]

---

## JOURNEYS

### [JOURNEY-ID]
[User journey description]
```

---

## 3. REQS Section

### Format:

```markdown
### AUTH-001 (MUST)
All API endpoints (except /health and /public/*) MUST require authentication.

### AUTH-002 (MUST)
Auth tokens MUST be stored in httpOnly cookies, never in localStorage or sessionStorage.

### AUTH-003 (MUST)
Sessions MUST expire after 7 days.

### AUTH-010 (SHOULD)
Session timeout SHOULD be configurable per environment.
```

### Rules:

1. **IDs are unique across project**: `AUTH-001`, `EMAIL-001`, `PAY-001`
   - Format: `[FEATURE]-[NUMBER]`
   - Numbers 001-009 for critical MUST requirements
   - Numbers 010+ for SHOULD requirements

2. **Tags are explicit**: `(MUST)` or `(SHOULD)`
   - `(MUST)` → Becomes `non_negotiable` rule in contract
   - `(SHOULD)` → Becomes `soft` rule in contract

3. **One requirement per ID**: Don't mix multiple rules in one REQ

4. **Be specific**: "Auth tokens in httpOnly cookies" not "Tokens should be secure"

---

## 4. JOURNEYS Section

### Format:

```markdown
### J-AUTH-REGISTER

User registration:
1. User visits /register
2. User fills email + password
3. User submits the form
4. System sends confirmation email
5. User clicks confirmation link
6. User lands on /dashboard

### J-AUTH-LOGIN

User login:
1. Visit /login
2. Submit valid credentials
3. Get redirected to /dashboard
```

### Rules:

1. **Journey IDs**: `J-[FEATURE]-[NAME]` (e.g. `J-AUTH-REGISTER`)

2. **Numbered steps**: Clear 1, 2, 3 sequence

3. **Observable actions**: Things you can test (navigation, form submission, API calls)

4. **Expected outcomes**: What should happen at each step

---

## 5. DEFINITION OF DONE (DOD)

Journeys serve as your **Definition of Done**. A feature isn't complete when code is written—it's complete when users can accomplish their goals.

### Format:

```markdown
## DEFINITION OF DONE

### Critical (MUST PASS)
- J-AUTH-REGISTER
- J-AUTH-LOGIN

### Important (SHOULD PASS)
- J-AUTH-PASSWORD-RESET

### Future (NOT BLOCKING)
- J-AUTH-2FA
```

### Criticality Levels:

| Level | Meaning | Release Gate |
|-------|---------|--------------|
| `Critical` | Core user flows | ❌ Cannot release if failing |
| `Important` | Key features | ⚠️ Should fix before release |
| `Future` | Planned features | ✅ Can release without |

### Rules:

1. **Every Critical journey must have**:
   - A journey contract (`journey_*.yml`)
   - An E2E test file
   - Passing status before release

2. **DOD answers**: "When is this feature done?"
   - Unit tests pass? Not enough.
   - Integration tests pass? Getting closer.
   - **Critical journeys pass? NOW it's done.**

3. **Journey status tracking**:
   - `passing` - E2E tests green
   - `failing` - E2E tests red (blocks release if Critical)
   - `not_tested` - No E2E test yet (blocks release if Critical)

---

## 6. Complete Example

```markdown
# Feature: User Authentication

## REQS

### AUTH-001 (MUST)
All API endpoints (except /health and /public/*) MUST require authentication.

Enforcement:
- Every route under /api/* must have authMiddleware
- No bypass flags or environment variables

### AUTH-002 (MUST)
Auth tokens MUST be stored in httpOnly cookies, never in localStorage or sessionStorage.

Rationale:
- localStorage vulnerable to XSS attacks
- httpOnly cookies inaccessible to JavaScript

### AUTH-003 (MUST)
Sessions MUST expire after 7 days.

Implementation:
- Set maxAge: 7 * 24 * 60 * 60 * 1000
- No "remember me" option that extends this

### AUTH-004 (MUST)
Passwords MUST be hashed with bcrypt (min 10 rounds) before storage.

Enforcement:
- Never store plaintext passwords
- Use bcrypt.hash(password, 10) or higher

### AUTH-010 (SHOULD)
Session timeout SHOULD be configurable per environment.

Rationale:
- Dev environments may want longer sessions
- Production should default to 7 days

---

## JOURNEYS

### J-AUTH-REGISTER

User registration:
1. User visits /register
2. User fills email + password form
3. User submits the form
4. System validates email format
5. System hashes password (AUTH-004)
6. System creates user record
7. System sends confirmation email
8. User clicks link in email
9. System marks email as confirmed
10. User lands on /dashboard

### J-AUTH-LOGIN

User login:
1. User visits /login
2. User enters email + password
3. User submits form
4. System validates credentials
5. System creates session with httpOnly cookie (AUTH-002)
6. System redirects to /dashboard
7. User sees authenticated dashboard

### J-AUTH-LOGOUT

User logout:
1. User clicks logout button
2. System clears session cookie
3. System redirects to /login
4. User cannot access protected routes

---

## DEFINITION OF DONE

### Critical (MUST PASS)
- J-AUTH-REGISTER
- J-AUTH-LOGIN

### Important (SHOULD PASS)
- J-AUTH-LOGOUT

### Future (NOT BLOCKING)
- J-AUTH-2FA
- J-AUTH-PASSWORD-RESET
```

---

## 7. What the LLM Does With This

Given this spec, the LLM:

1. **Parses REQs**:
   - `AUTH-001 (MUST)` → Creates contract rule `AUTH-001` in `docs/contracts/feature_authentication.yml`
   - `AUTH-010 (SHOULD)` → Creates soft rule (guideline, not enforced)

2. **Generates contracts**:
   ```yaml
   rules:
     non_negotiable:
       - id: AUTH-001
         title: "API endpoints require authentication"
         forbidden_patterns:
           - pattern: /router\.(get|post).*\/api\/(?!health|public)/
             message: "Route missing authMiddleware"
   ```

3. **Creates tests**:
   ```typescript
   it('AUTH-001: API routes have authMiddleware', () => {
     // Scan src/routes/ for patterns
     // Fail if violation found
   })
   ```

4. **Generates journey tests**:
   ```typescript
   it('J-AUTH-REGISTER: Complete registration flow', async () => {
     await page.goto('/register')
     // Follow steps 1-10
     expect(page.url()).toContain('/dashboard')
   })
   ```

---

## 8. Writing Tips

### ✅ Good REQs:

```markdown
### EMAIL-001 (MUST)
Email sending MUST be rate-limited to 100 emails/min per user.

### PAY-002 (MUST)
Payment webhooks MUST verify Stripe signatures before processing.

### DATA-003 (MUST)
User data MUST be encrypted at rest using AES-256.
```

**Why good:**
- Specific numbers (100/min, AES-256)
- Clear enforcement criteria
- Observable/testable

---

### ❌ Bad REQs:

```markdown
### SEC-001 (MUST)
The system should be secure.
```

**Why bad:**
- Too vague
- No enforcement criteria
- Not testable

**Fix:**
```markdown
### SEC-001 (MUST)
All API endpoints MUST use HTTPS in production.

### SEC-002 (MUST)
All user inputs MUST be validated before database queries.

### SEC-003 (MUST)
Authentication tokens MUST expire after 7 days.
```

---

## 9. Spec Maintenance

### When to Update:

1. **New feature**: Add new REQs section

2. **Requirement changes**: Update existing REQ, bump contract version

3. **Journey changes**: Update JOURNEYS section

### Version Control:

Add changelog at bottom of spec:

```markdown
---

## Changelog

### 2025-12-02 - v2
- Added AUTH-004: Password hashing requirement
- Updated J-AUTH-REGISTER: Added email confirmation step

### 2025-11-15 - v1
- Initial spec
```

---

## 10. Spec → Contract Mapping

| Spec Element | Contract Element | Test Type |
|--------------|------------------|-----------|
| `AUTH-001 (MUST)` | `rules.non_negotiable[0].id: AUTH-001` | Pattern scan |
| `AUTH-010 (SHOULD)` | `rules.soft[0].id: AUTH-010` | Guideline |
| `J-AUTH-REGISTER` | `journey_meta.id: J-AUTH-REGISTER` | E2E test |
| `Critical (MUST PASS)` | `journey_meta.dod_criticality: critical` | Release gate |

---

## 11. Quick Reference Card

```
┌─────────────────────────────────────────────────────────┐
│ Spec Format Quick Reference                             │
├─────────────────────────────────────────────────────────┤
│ File:        docs/specs/<feature>.md                    │
│                                                          │
│ Structure:                                              │
│   # Feature: [Name]                                     │
│   ## REQS                                               │
│   ### [ID] (MUST)                                       │
│   [Description]                                         │
│                                                          │
│   ## JOURNEYS                                           │
│   ### J-[FEATURE]-[NAME]                                │
│   1. Step one                                           │
│   2. Step two                                           │
│                                                          │
│   ## DEFINITION OF DONE                                 │
│   ### Critical (MUST PASS)                              │
│   - J-[FEATURE]-[NAME]                                  │
│                                                          │
│ ID Format:   [FEATURE]-[NUMBER]                         │
│              AUTH-001, EMAIL-042                        │
│                                                          │
│ Tags:        (MUST) = non-negotiable                    │
│              (SHOULD) = guideline                       │
│                                                          │
│ Journeys:    J-[FEATURE]-[NAME]                         │
│              J-AUTH-REGISTER                            │
│                                                          │
│ DOD Levels:  Critical = blocks release                  │
│              Important = should fix                     │
│              Future = can skip                          │
└─────────────────────────────────────────────────────────┘
```

---

## Examples by Feature Type

### API Service:
```markdown
### API-001 (MUST)
All endpoints MUST validate input schemas before processing.

### API-002 (MUST)
All endpoints MUST return structured error responses with status codes.
```

### E-Commerce:
```markdown
### CART-001 (MUST)
Cart items MUST persist across sessions for authenticated users.

### J-CHECKOUT
1. User adds item to cart
2. User proceeds to checkout
3. User enters payment details
4. User confirms order
5. User sees order confirmation
```

### Data Service:
```markdown
### DATA-001 (MUST)
All database queries MUST use prepared statements.

### DATA-002 (MUST)
Personal data MUST be encrypted before storage.
```

---

**Next:** See `CONTRACT-SCHEMA.md` to understand how these specs become contracts.
