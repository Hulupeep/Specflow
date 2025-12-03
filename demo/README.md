# Specflow Demo: Catch What Tests Miss

> **Goal:** Show how LLMs write passing tests while violating spec requirements, and how Specflow contracts catch this.

---

## What You'll See (60 seconds)

1. **Initial State:** Simple Node.js app with auth using Redis sessions (working, tested, deployed)
2. **LLM "Improvement":** LLM refactors to use localStorage for "better performance" (tests still pass!)
3. **Production Incident:** App crashes in browsers with localStorage disabled
4. **Contract Solution:** Add Specflow contract that blocks the bad refactor at build time

---

## Prerequisites

- Node.js 18+
- 5 minutes
- PM-level technical understanding (can run npm commands)

---

## Quick Start

```bash
# 1. Install dependencies
npm install

# 2. See it working (initial state)
npm test          # ✅ All tests pass
npm run demo:safe # ✅ App works with Redis

# 3. See the trap (LLM "improvement")
npm run demo:trap # 💥 App crashes (but tests still pass!)

# 4. Add contract protection
npm run contracts:generate
npm test -- contracts  # ❌ Catches the violation!

# 5. Reset and try again
npm run demo:reset
```

---

## The Scenario (Based on Real TabStax Bug)

### Initial Working State

**Spec Requirement:**
```markdown
## REQS

### AUTH-001 (MUST)
Session storage MUST use Redis with TTL, not browser localStorage.

**Rationale:**
- localStorage can be disabled by user
- localStorage doesn't expire automatically
- localStorage isn't available in service workers (MV3)
```

**Working Implementation:** (see `demo/initial-state/auth.js`)
```javascript
// ✅ COMPLIANT: Uses Redis with TTL
async function createSession(userId) {
  const sessionId = generateId()
  await redis.set(`session:${sessionId}`, userId, 'EX', 86400) // 24h TTL
  return sessionId
}
```

**Tests Pass:**
```javascript
// ✅ Test validates implementation works
it('creates session with expiry', async () => {
  const sessionId = await createSession('user123')
  expect(sessionId).toBeDefined()
  expect(await getSession(sessionId)).toBe('user123')
})
```

---

### The LLM "Improvement" (The Trap)

**User Prompt to LLM:**
> "Improve auth performance - Redis calls are slow"

**LLM Response:** (confident, helpful, wrong)
```javascript
// ❌ VIOLATION: Uses localStorage (faster! but breaks spec)
async function createSession(userId) {
  const sessionId = generateId()
  // Performance optimization: localStorage is 10x faster than Redis!
  localStorage.setItem(`session:${sessionId}`, JSON.stringify({
    userId,
    expiresAt: Date.now() + 86400000
  }))
  return sessionId
}
```

**Tests Still Pass:** (this is the problem!)
```javascript
// ✅ Test STILL validates implementation works
it('creates session with expiry', async () => {
  const sessionId = await createSession('user123')
  expect(sessionId).toBeDefined()
  expect(await getSession(sessionId)).toBe('user123')
})
```

**Production Incident:**
- Users with localStorage disabled → crash
- Service workers → crash (localStorage not available)
- 3 hours debugging
- Revenue impact

---

### The Contract Solution

**Generate Contract from Spec:**
```bash
npm run contracts:generate auth
```

**Generated Contract:** (`docs/contracts/feature_auth.yml`)
```yaml
contract_meta:
  id: feature_auth
  version: 1
  created_from_spec: "docs/specs/auth.md"
  covers_reqs:
    - AUTH-001
  owner: "backend-team"

rules:
  non_negotiable:
    - id: AUTH-001
      title: "Session storage must use Redis, not localStorage"
      scope:
        - "src/auth/**/*.js"
      behavior:
        forbidden_patterns:
          - pattern: /localStorage\.(get|set)Item/
            message: "localStorage not allowed for sessions (see AUTH-001)"
        required_patterns:
          - pattern: /redis\.(get|set)/
            message: "Must use Redis for session storage (see AUTH-001)"
```

**Generated Test:** (`src/__tests__/contracts/auth.test.js`)
```javascript
const fs = require('fs')
const glob = require('glob')

describe('Contract: feature_auth', () => {
  it('AUTH-001: Session storage uses Redis not localStorage', () => {
    const files = glob.sync('src/auth/**/*.js')

    files.forEach(file => {
      const content = fs.readFileSync(file, 'utf-8')

      // Check forbidden pattern
      const hasLocalStorage = /localStorage\.(get|set)Item/.test(content)
      if (hasLocalStorage) {
        throw new Error(
          `❌ CONTRACT VIOLATION: AUTH-001\n` +
          `File: ${file}\n` +
          `Issue: localStorage not allowed for sessions\n` +
          `See: docs/contracts/feature_auth.yml\n` +
          `Spec: docs/specs/auth.md#AUTH-001`
        )
      }

      // Check required pattern
      const hasRedis = /redis\.(get|set)/.test(content)
      if (!hasRedis) {
        throw new Error(
          `❌ CONTRACT VIOLATION: AUTH-001\n` +
          `File: ${file}\n` +
          `Issue: Must use Redis for session storage\n` +
          `See: docs/contracts/feature_auth.yml`
        )
      }
    })
  })
})
```

**Now the Build Catches It:**
```bash
$ npm test -- contracts

 FAIL  src/__tests__/contracts/auth.test.js
  Contract: feature_auth
    ✕ AUTH-001: Session storage uses Redis not localStorage (5 ms)

  ● AUTH-001: Session storage uses Redis not localStorage

    ❌ CONTRACT VIOLATION: AUTH-001
    File: src/auth/session.js
    Issue: localStorage not allowed for sessions
    See: docs/contracts/feature_auth.yml
    Spec: docs/specs/auth.md#AUTH-001

Test Suites: 1 failed, 0 passed, 1 total
Tests:       1 failed, 0 passed, 1 total
```

**Build Blocked → Production Safe**

---

## Comparison: What Catches What?

| Tool | Syntax Error | Type Error | API Misuse | Spec Violation | Example: localStorage in auth |
|------|-------------|-----------|-----------|---------------|------------------------------|
| **TypeScript** | ✅ | ✅ | ❌ | ❌ | Allows it (syntactically valid) |
| **ESLint** | ✅ | ⚠️ | ⚠️ | ❌ | Can ban API but no spec context |
| **Unit Tests** | ❌ | ❌ | ❌ | ❌ | Tests pass! (implementation works) |
| **Integration Tests** | ❌ | ❌ | ⚠️ | ❌ | Might catch runtime error, no spec link |
| **Code Review** | ⚠️ | ⚠️ | ⚠️ | ⚠️ | Human might catch it (if they remember spec) |
| **Documentation** | ❌ | ❌ | ❌ | ❌ | LLMs ignore comments |
| **Specflow Contracts** | ❌ | ❌ | ✅ | ✅ | **Maps AUTH-001 → forbidden pattern → build fails** |

**Key Insight:** Only Specflow connects spec requirements to build enforcement.

---

## Try It Yourself

### Step 1: See Initial Working State
```bash
npm run demo:safe
```

**Output:**
```
✅ Creating session for user123...
✅ Session created: sess_abc123
✅ Retrieving session...
✅ Session valid: user123
✅ Using Redis (compliant with AUTH-001)
```

### Step 2: See the Trap (LLM "Improvement")
```bash
npm run demo:trap
```

**Output:**
```
❌ Creating session for user123...
💥 ERROR: localStorage is not defined
💥 PRODUCTION INCIDENT: App crashed!
💥 This is what happens when requirements are violated

🧪 But the tests still pass:
$ npm test
  ✓ creates session with expiry
  ✓ retrieves session by id
  ✓ expires after TTL

  ✅ All tests passed! (3 passing)

🤔 Why? Tests validate implementation works, not that it meets spec.
```

### Step 3: Add Contract Protection
```bash
npm run contracts:generate auth
npm test -- contracts
```

**Output:**
```
❌ CONTRACT VIOLATION: AUTH-001
   File: src/auth/session.js:12
   Issue: localStorage not allowed for sessions (see AUTH-001)
   See: docs/contracts/feature_auth.yml
   Spec: docs/specs/auth.md#AUTH-001

🛡️  Build blocked - production safe!
```

### Step 4: Fix the Violation
```bash
# Revert to Redis implementation
npm run demo:fix

# Tests pass again
npm test -- contracts
```

**Output:**
```
✅ AUTH-001: Session storage uses Redis not localStorage

Test Suites: 1 passed, 1 total
Tests:       1 passed, 1 total
```

### Step 5: Reset and Try Again
```bash
npm run demo:reset
```

---

## File Structure

```
demo/
├── README.md                        # This file
├── package.json                     # Demo scripts
├── src/
│   ├── auth/
│   │   ├── session.js              # Auth implementation (swappable)
│   │   └── redis.js                # Redis client
│   └── __tests__/
│       ├── auth.test.js            # Unit tests (pass in both states!)
│       └── contracts/
│           └── auth.test.js        # Contract test (catches violation)
├── docs/
│   ├── specs/
│   │   └── auth.md                 # Spec with AUTH-001 requirement
│   └── contracts/
│       └── feature_auth.yml        # Generated contract
├── demo-states/
│   ├── safe-state/                 # Redis implementation (compliant)
│   ├── trap-state/                 # localStorage implementation (violation)
│   └── fixed-state/                # Reverted to Redis
└── scripts/
    ├── demo-safe.js                # Run with safe state
    ├── demo-trap.js                # Run with trap state
    ├── demo-fix.js                 # Revert to safe state
    └── demo-reset.js               # Reset to initial state
```

---

## Rollback & Retry

You can try the demo as many times as you want:

```bash
# Reset to initial state
npm run demo:reset

# Try the full sequence again
npm run demo:safe    # See working state
npm run demo:trap    # See violation
npm test -- contracts # See contract catch it
npm run demo:fix     # See fix
```

Each script swaps out `src/auth/session.js` with pre-written states from `demo-states/`.

---

## Your Next 5 Minutes

Want to protect YOUR scariest file?

1. **Document current behavior** (plain English is fine!)
```bash
cat > docs/current-behavior.md <<EOF
Our auth currently works like this:
- Sessions stored in Redis
- 24-hour expiry
- Never use localStorage (breaks in service workers)
EOF
```

2. **Generate contract** (LLM converts to REQ IDs)
```bash
npx specflow generate --from current-behavior.md
```

3. **Run contract tests**
```bash
npm test -- contracts
```

4. **Add to CI** (block PRs that violate)
```yaml
# .github/workflows/ci.yml
- name: Contract Tests
  run: npm test -- contracts
```

Done! Your spec is now executable.

---

## Why This Demo Matters

### The Problem
- LLMs are great at code
- LLMs confidently violate requirements
- Unit tests validate implementation, not intent
- Comments and docs are ignored

### The Solution
- Specs with REQ IDs (AUTH-001)
- Contracts map REQ IDs → rules
- Tests scan source code for violations
- Build fails with clear "CONTRACT VIOLATION: AUTH-001" message
- Production stays safe

### The Proof
This demo shows:
1. ✅ Tests can pass while spec is violated
2. ✅ Contracts catch violations tests miss
3. ✅ Clear error messages trace back to spec
4. ✅ 5-minute adoption path

---

## FAQ

### "Isn't this just ESLint?"
No. ESLint bans APIs but doesn't understand *why*. Specflow maps `AUTH-001` requirement → forbidden pattern → spec doc. When it fails, you know exactly which requirement was violated and why.

### "Can't I just write better comments?"
Comments are ignored by LLMs and CI. Contracts are enforced at build time.

### "What if I need to violate a requirement?"
1. Update the spec first (change requirement)
2. Update the contract (map new requirement)
3. Update the test (verify new requirement)
4. Then update the code

This forces conscious spec changes, not accidental violations.

### "Do I have to convert my entire codebase?"
No! Start with ONE scary file. Expand gradually as you touch code.

---

## Learn More

- **[Specflow Documentation](https://github.com/Hulupeep/Specflow)**
- **[How to Write Specs](https://github.com/Hulupeep/Specflow/blob/main/SPEC-FORMAT.md)**
- **[Contract Schema](https://github.com/Hulupeep/Specflow/blob/main/CONTRACT-SCHEMA.md)**
- **[Real-World Example: TabStax](https://github.com/Hulupeep/Specflow/blob/main/examples/tabstax-mv3.md)**

---

*Demo created: 2025-12-03*
*Based on real production incident from TabStax MV3 extension*
