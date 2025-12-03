# Demo Implementation Plan

> **Goal:** Build working demo that can be rolled back and retried multiple times

---

## File Structure (What to Create)

```
demo/
├── README.md                        # ✅ DONE (instructions for PM-level users)
├── IMPLEMENTATION-PLAN.md          # ✅ DONE (this file)
├── package.json                     # TODO: Demo scripts + deps
├── src/
│   ├── auth/
│   │   ├── session.js              # TODO: Symlink to current state
│   │   └── redis.js                # TODO: Mock Redis client
│   └── __tests__/
│       ├── auth.test.js            # TODO: Unit tests (pass in both states!)
│       └── contracts/
│           └── auth.test.js        # TODO: Contract test (catches violation)
├── docs/
│   ├── specs/
│   │   └── auth.md                 # TODO: Spec with AUTH-001 requirement
│   └── contracts/
│       └── feature_auth.yml        # TODO: Generated contract (can be manual for demo)
├── demo-states/
│   ├── safe-state/
│   │   └── session.js              # TODO: Redis implementation (compliant)
│   ├── trap-state/
│   │   └── session.js              # TODO: localStorage implementation (violation)
│   └── fixed-state/
│       └── session.js              # TODO: Same as safe-state (for clarity)
└── scripts/
    ├── demo-safe.js                # TODO: Swap to safe state + run
    ├── demo-trap.js                # TODO: Swap to trap state + run (show crash)
    ├── demo-fix.js                 # TODO: Swap to fixed state + run
    └── demo-reset.js               # TODO: Reset to safe state
```

---

## Implementation Steps

### Step 1: Setup package.json

```json
{
  "name": "specflow-demo",
  "version": "1.0.0",
  "description": "Demo showing how Specflow contracts catch violations tests miss",
  "scripts": {
    "test": "jest",
    "test:contracts": "jest src/__tests__/contracts",
    "demo:safe": "node scripts/demo-safe.js",
    "demo:trap": "node scripts/demo-trap.js",
    "demo:fix": "node scripts/demo-fix.js",
    "demo:reset": "node scripts/demo-reset.js",
    "contracts:generate": "echo 'Contract generation (manual for demo)'"
  },
  "devDependencies": {
    "jest": "^29.7.0",
    "glob": "^10.3.10"
  },
  "jest": {
    "testEnvironment": "node",
    "testMatch": [
      "**/__tests__/**/*.test.js"
    ]
  }
}
```

**Why:**
- Simple scripts for PM-level users
- Jest for testing (familiar to most devs)
- Glob for contract scanning

---

### Step 2: Create Spec (docs/specs/auth.md)

```markdown
# Feature: Authentication

## REQS

### AUTH-001 (MUST)
Session storage MUST use Redis with TTL, not browser localStorage.

**Rationale:**
- localStorage can be disabled by user/admin policies
- localStorage doesn't expire automatically (manual cleanup required)
- localStorage isn't available in service workers (Chrome MV3 extensions)

**Compliance:**
- ✅ Use `redis.set(key, value, 'EX', ttl)`
- ❌ Do NOT use `localStorage.setItem()`
- ❌ Do NOT use `sessionStorage.setItem()`

**Test:**
Source code scan: Forbid `/localStorage\.(get|set)Item/` in `src/auth/`

---

## Context

This requirement emerged from TabStax production incident where LLM "optimized"
auth by switching to localStorage, breaking the extension in enterprise
environments with localStorage disabled.
```

**Why:**
- Real-world rationale (not toy example)
- Clear compliance examples
- Explicit test strategy
- Production context (trust building)

---

### Step 3: Create Contract (docs/contracts/feature_auth.yml)

```yaml
contract_meta:
  id: feature_auth
  version: 1
  created_from_spec: "docs/specs/auth.md"
  covers_reqs:
    - AUTH-001
  owner: "backend-team"
  created_at: "2025-12-03"

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
          - pattern: /sessionStorage\.(get|set)Item/
            message: "sessionStorage not allowed for sessions (see AUTH-001)"
        required_patterns:
          - pattern: /redis\.(get|set)/
            message: "Must use Redis for session storage (see AUTH-001)"
      rationale: |
        localStorage can be disabled by browser policies and isn't
        available in service workers. Redis provides:
        - Automatic TTL expiry
        - Cross-process consistency
        - Works in all runtime contexts
```

**Why:**
- Maps directly to AUTH-001
- Clear forbidden/required patterns
- Rationale explains the "why"
- Easy to parse for contract test

---

### Step 4: Create Mock Redis (src/auth/redis.js)

```javascript
// Mock Redis client for demo purposes
// In real app, use actual redis/ioredis client

class MockRedis {
  constructor() {
    this.store = new Map()
    this.ttls = new Map()
  }

  async set(key, value, mode, ttl) {
    this.store.set(key, value)
    if (mode === 'EX' && ttl) {
      this.ttls.set(key, Date.now() + ttl * 1000)
    }
    return 'OK'
  }

  async get(key) {
    // Check expiry
    const ttl = this.ttls.get(key)
    if (ttl && Date.now() > ttl) {
      this.store.delete(key)
      this.ttls.delete(key)
      return null
    }
    return this.store.get(key) || null
  }

  async del(key) {
    this.store.delete(key)
    this.ttls.delete(key)
    return 1
  }
}

module.exports = new MockRedis()
```

**Why:**
- No external Redis required (demo simplicity)
- Implements TTL behavior (shows spec requirement)
- Familiar Redis API (realistic)

---

### Step 5: Create Safe State (demo-states/safe-state/session.js)

```javascript
const redis = require('../redis')

// ✅ COMPLIANT: Uses Redis with TTL (AUTH-001)
function generateId() {
  return 'sess_' + Math.random().toString(36).substr(2, 9)
}

async function createSession(userId) {
  const sessionId = generateId()
  // AUTH-001 COMPLIANT: Redis with 24h TTL
  await redis.set(`session:${sessionId}`, userId, 'EX', 86400)
  console.log(`✅ Session created: ${sessionId} (Redis, 24h TTL)`)
  return sessionId
}

async function getSession(sessionId) {
  // AUTH-001 COMPLIANT: Redis lookup
  const userId = await redis.get(`session:${sessionId}`)
  if (!userId) {
    console.log(`❌ Session expired or not found: ${sessionId}`)
    return null
  }
  console.log(`✅ Session valid: ${userId}`)
  return userId
}

async function deleteSession(sessionId) {
  // AUTH-001 COMPLIANT: Redis delete
  await redis.del(`session:${sessionId}`)
  console.log(`✅ Session deleted: ${sessionId}`)
}

module.exports = {
  createSession,
  getSession,
  deleteSession
}
```

**Why:**
- Clear compliance markers
- Console logs for demo visibility
- Implements spec requirement correctly

---

### Step 6: Create Trap State (demo-states/trap-state/session.js)

```javascript
// ❌ CONTRACT VIOLATION: Uses localStorage (violates AUTH-001)
// This code was "helpfully" suggested by an LLM to "improve performance"

function generateId() {
  return 'sess_' + Math.random().toString(36).substr(2, 9)
}

async function createSession(userId) {
  const sessionId = generateId()

  // LLM REASONING: "localStorage is 10x faster than Redis for local dev!"
  // PROBLEM: Breaks in production with localStorage disabled
  // VIOLATES: AUTH-001 (Session storage MUST use Redis)

  localStorage.setItem(`session:${sessionId}`, JSON.stringify({
    userId,
    expiresAt: Date.now() + 86400000  // Manual TTL tracking (fragile)
  }))

  console.log(`✅ Session created: ${sessionId} (localStorage, 24h expiry)`)
  return sessionId
}

async function getSession(sessionId) {
  // VIOLATES: AUTH-001 (localStorage instead of Redis)
  const data = localStorage.getItem(`session:${sessionId}`)
  if (!data) {
    console.log(`❌ Session not found: ${sessionId}`)
    return null
  }

  const parsed = JSON.parse(data)

  // Manual expiry check (fragile, can be bypassed)
  if (Date.now() > parsed.expiresAt) {
    localStorage.removeItem(`session:${sessionId}`)
    console.log(`❌ Session expired: ${sessionId}`)
    return null
  }

  console.log(`✅ Session valid: ${parsed.userId}`)
  return parsed.userId
}

async function deleteSession(sessionId) {
  // VIOLATES: AUTH-001 (localStorage instead of Redis)
  localStorage.removeItem(`session:${sessionId}`)
  console.log(`✅ Session deleted: ${sessionId}`)
}

module.exports = {
  createSession,
  getSession,
  deleteSession
}
```

**Why:**
- Shows realistic LLM reasoning (performance optimization)
- Clear violation markers
- Looks plausible (this is the trap!)
- Includes the seductive reasoning ("10x faster")

---

### Step 7: Create Unit Tests (src/__tests__/auth.test.js)

```javascript
const fs = require('fs')
const path = require('path')

// IMPORTANT: This test suite passes in BOTH states!
// That's the problem: unit tests validate implementation works,
// not that it meets spec requirements.

describe('Authentication', () => {
  let sessionModule
  let mockRedis

  beforeEach(() => {
    // Clear module cache to get fresh instance
    jest.resetModules()

    // Load current session implementation (swapped by demo scripts)
    sessionModule = require('../auth/session')

    // Mock Redis if it's being used
    mockRedis = require('../auth/redis')
  })

  it('creates session with expiry', async () => {
    const sessionId = await sessionModule.createSession('user123')

    // TEST PASSES in both Redis and localStorage states!
    expect(sessionId).toBeDefined()
    expect(sessionId).toMatch(/^sess_/)
  })

  it('retrieves session by id', async () => {
    const sessionId = await sessionModule.createSession('user123')
    const userId = await sessionModule.getSession(sessionId)

    // TEST PASSES in both states!
    expect(userId).toBe('user123')
  })

  it('deletes session', async () => {
    const sessionId = await sessionModule.createSession('user123')
    await sessionModule.deleteSession(sessionId)
    const userId = await sessionModule.getSession(sessionId)

    // TEST PASSES in both states!
    expect(userId).toBeNull()
  })

  it('expires sessions after TTL', async () => {
    // NOTE: This test would need time manipulation to test properly
    // Skipped for demo simplicity
  })
})
```

**Why:**
- Tests pass in BOTH states (this is the key insight!)
- Shows unit tests validate behavior, not compliance
- Realistic test structure
- Commented to explain the trap

---

### Step 8: Create Contract Test (src/__tests__/contracts/auth.test.js)

```javascript
const fs = require('fs')
const path = require('path')
const glob = require('glob')

describe('Contract: feature_auth', () => {
  it('AUTH-001: Session storage uses Redis not localStorage', () => {
    // Scan auth source files
    const files = glob.sync('src/auth/**/*.js', {
      ignore: ['**/redis.js']  // Exclude the Redis client itself
    })

    let violations = []

    files.forEach(file => {
      const content = fs.readFileSync(file, 'utf-8')
      const relPath = path.relative(process.cwd(), file)

      // Check for forbidden patterns
      const localStorageMatch = content.match(/localStorage\.(get|set)Item/)
      const sessionStorageMatch = content.match(/sessionStorage\.(get|set)Item/)

      if (localStorageMatch || sessionStorageMatch) {
        const lineNum = getLineNumber(content, localStorageMatch || sessionStorageMatch)
        violations.push({
          file: relPath,
          line: lineNum,
          pattern: localStorageMatch ? 'localStorage' : 'sessionStorage',
          snippet: getLineSnippet(content, lineNum)
        })
      }

      // Check for required patterns
      const redisMatch = content.match(/redis\.(get|set)/)
      if (!redisMatch && !localStorageMatch) {
        // If no localStorage AND no Redis, that's also a violation
        // (means no storage implementation at all)
        violations.push({
          file: relPath,
          line: 1,
          pattern: 'missing redis.get/set',
          snippet: ''
        })
      }
    })

    // Report violations
    if (violations.length > 0) {
      const errorMsg = formatViolations(violations)
      throw new Error(errorMsg)
    }
  })
})

// Helper functions
function getLineNumber(content, match) {
  if (!match) return 1
  const lines = content.split('\n')
  for (let i = 0; i < lines.length; i++) {
    if (lines[i].includes(match[0])) {
      return i + 1
    }
  }
  return 1
}

function getLineSnippet(content, lineNum) {
  const lines = content.split('\n')
  if (lineNum > 0 && lineNum <= lines.length) {
    return lines[lineNum - 1].trim()
  }
  return ''
}

function formatViolations(violations) {
  let msg = '\n❌ CONTRACT VIOLATION: AUTH-001\n'
  msg += '━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n\n'

  violations.forEach(v => {
    msg += `File: ${v.file}:${v.line}\n`
    msg += `Issue: ${v.pattern} not allowed (violates AUTH-001)\n`
    if (v.snippet) {
      msg += `Code: ${v.snippet}\n`
    }
    msg += '\n'
  })

  msg += 'Requirement: Session storage MUST use Redis with TTL\n'
  msg += 'See: docs/contracts/feature_auth.yml\n'
  msg += 'Spec: docs/specs/auth.md#AUTH-001\n'
  msg += '\n━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n'

  return msg
}
```

**Why:**
- Source code scanning (realistic contract test)
- Clear violation formatting (PM-readable)
- References spec and contract (traceability)
- Fails ONLY in trap state (demonstrates value)

---

### Step 9: Create Demo Scripts

#### scripts/demo-safe.js
```javascript
#!/usr/bin/env node
const fs = require('fs')
const path = require('path')
const { execSync } = require('child_process')

console.log('\n🔵 Demo: SAFE State (Compliant with AUTH-001)\n')

// Copy safe state to active location
const safePath = path.join(__dirname, '../demo-states/safe-state/session.js')
const activePath = path.join(__dirname, '../src/auth/session.js')
fs.copyFileSync(safePath, activePath)

console.log('✅ Using Redis implementation (compliant)')
console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n')

// Run the code
try {
  const session = require('../src/auth/session')

  async function demo() {
    console.log('Creating session for user123...')
    const sessionId = await session.createSession('user123')

    console.log('\nRetrieving session...')
    const userId = await session.getSession(sessionId)

    console.log('\n✅ SUCCESS: App works correctly')
    console.log('✅ Using Redis (compliant with AUTH-001)')
    console.log('\nRun contract tests:')
    console.log('$ npm test -- contracts')
    console.log('Expected: ✅ Tests pass\n')
  }

  demo().catch(console.error)

} catch (err) {
  console.error('❌ Error:', err.message)
}
```

#### scripts/demo-trap.js
```javascript
#!/usr/bin/env node
const fs = require('fs')
const path = require('path')

console.log('\n🔴 Demo: TRAP State (LLM "Optimization" - Violates AUTH-001)\n')

// Copy trap state to active location
const trapPath = path.join(__dirname, '../demo-states/trap-state/session.js')
const activePath = path.join(__dirname, '../src/auth/session.js')
fs.copyFileSync(trapPath, activePath)

console.log('❌ Using localStorage implementation (violates AUTH-001)')
console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n')

// Try to run the code (will crash in Node.js - no localStorage)
try {
  const session = require('../src/auth/session')

  async function demo() {
    console.log('Attempting to create session for user123...')
    const sessionId = await session.createSession('user123')
  }

  demo().catch(err => {
    console.error('\n💥 PRODUCTION INCIDENT!')
    console.error('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━')
    console.error('Error:', err.message)
    console.error('\nThis is what happens in production:')
    console.error('- Users with localStorage disabled → crash')
    console.error('- Service workers (MV3) → crash')
    console.error('- 3 hours debugging')
    console.error('- Revenue impact\n')
    console.error('BUT... unit tests still pass!')
    console.error('Run: npm test')
    console.error('Expected: ✅ All tests pass (but code is broken!)\n')
    console.error('NOW run contract tests:')
    console.error('$ npm test -- contracts')
    console.error('Expected: ❌ CONTRACT VIOLATION: AUTH-001\n')
  })

} catch (err) {
  console.error('\n💥 PRODUCTION INCIDENT!')
  console.error('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━')
  console.error('Error:', err.message)
  console.error('\nThis demonstrates the problem:')
  console.error('- LLM suggested "performance optimization"')
  console.error('- Used localStorage instead of Redis')
  console.error('- Unit tests still pass!')
  console.error('- But code crashes in production\n')
  console.error('Try running contract tests:')
  console.error('$ npm test -- contracts')
  console.error('Expected: ❌ CONTRACT VIOLATION: AUTH-001\n')
}
```

#### scripts/demo-fix.js
```javascript
#!/usr/bin/env node
const fs = require('fs')
const path = require('path')

console.log('\n🟢 Demo: FIXED State (Reverted to Redis)\n')

// Copy fixed state (same as safe) to active location
const fixedPath = path.join(__dirname, '../demo-states/fixed-state/session.js')
const activePath = path.join(__dirname, '../src/auth/session.js')
fs.copyFileSync(fixedPath, activePath)

console.log('✅ Reverted to Redis implementation')
console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n')

// Run the code
try {
  const session = require('../src/auth/session')

  async function demo() {
    console.log('Creating session for user123...')
    const sessionId = await session.createSession('user123')

    console.log('\nRetrieving session...')
    const userId = await session.getSession(sessionId)

    console.log('\n✅ SUCCESS: App works correctly')
    console.log('✅ Using Redis (compliant with AUTH-001)')
    console.log('\nRun contract tests:')
    console.log('$ npm test -- contracts')
    console.log('Expected: ✅ Tests pass\n')
    console.log('🛡️  Build unblocked - safe to deploy!')
  }

  demo().catch(console.error)

} catch (err) {
  console.error('❌ Error:', err.message)
}
```

#### scripts/demo-reset.js
```javascript
#!/usr/bin/env node
const fs = require('fs')
const path = require('path')

console.log('\n🔄 Resetting demo to initial safe state...\n')

// Copy safe state to active location
const safePath = path.join(__dirname, '../demo-states/safe-state/session.js')
const activePath = path.join(__dirname, '../src/auth/session.js')
fs.copyFileSync(safePath, activePath)

console.log('✅ Reset complete')
console.log('✅ Now using Redis implementation (safe state)')
console.log('\nYou can now run the demo sequence again:')
console.log('1. npm run demo:safe    # See working state')
console.log('2. npm run demo:trap    # See violation')
console.log('3. npm test -- contracts # See contract catch it')
console.log('4. npm run demo:fix     # See fix\n')
```

**Why:**
- Simple Node.js scripts (no complex build tools)
- Clear console output with emojis (PM-friendly)
- File swapping for instant state changes
- Helpful next-step prompts

---

## Demo Flow (How User Experiences It)

### 1. Initial Setup (1 minute)
```bash
cd demo
npm install
```

### 2. See Safe State (30 seconds)
```bash
npm run demo:safe
```
**User sees:**
- ✅ Session created successfully
- ✅ Using Redis (compliant)
- Prompt to run contract tests

### 3. See Trap State (30 seconds)
```bash
npm run demo:trap
```
**User sees:**
- 💥 localStorage crash
- ❌ Production incident scenario
- Unit tests still pass (the trap!)
- Prompt to run contract tests

### 4. Run Contract Tests (30 seconds)
```bash
npm test -- contracts
```
**User sees:**
- ❌ CONTRACT VIOLATION: AUTH-001
- Clear error with file/line/spec reference
- Build blocked message

### 5. Fix and Verify (30 seconds)
```bash
npm run demo:fix
npm test -- contracts
```
**User sees:**
- ✅ Reverted to Redis
- ✅ Contract tests pass
- 🛡️ Safe to deploy

### 6. Reset and Retry (any time)
```bash
npm run demo:reset
```
**User can:**
- Run full sequence again
- Show colleagues
- Experiment with changes

---

## Success Criteria

After running the demo, user should be able to answer:

1. **What problem?**
   - "LLMs write working code that violates requirements"

2. **Why not tests?**
   - "Unit tests validate implementation, not spec compliance"

3. **How do contracts help?**
   - "Map spec requirements to build enforcement"

4. **What's my next step?**
   - "Protect my scariest file with one contract"

---

## Next Steps for Implementation

1. **Create all files in order above**
2. **Test each demo script manually**
3. **Verify rollback/retry works**
4. **Add to Specflow repo as `/demo` folder**
5. **Update main README to link to demo**

---

*Implementation plan created: 2025-12-03*
*Estimated implementation time: 2-3 hours for initial version*
