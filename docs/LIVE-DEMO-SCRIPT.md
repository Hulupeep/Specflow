# Live Demo Script

**Guaranteed to work. 3 minutes. One invariant.**

---

## Setup (Before Going Live)

```bash
cd demo
npm install        # Only once
npm run demo:reset # Reset to safe state
```

Verify it's ready:
```bash
npm run test:unit      # Should pass (4 tests)
npm run test:contracts # Should pass (1 test)
```

---

## The Demo (3 Minutes)

### Part 1: The Baseline (30 sec)

**Say:** "Here's a simple auth module. Sessions stored with TTL. Meets our requirement AUTH-001."

```bash
cat src/auth.js | head -20
```

Show: `store.set()` with TTL - compliant code.

```bash
npm run test:unit
```

**Say:** "Unit tests pass. 4 for 4."

```bash
npm run test:contracts
```

**Say:** "Contract tests pass. We're good."

---

### Part 2: The LLM "Optimization" (30 sec)

**Say:** "Now an LLM suggests an optimization: 'localStorage is 10x faster!'"

```bash
cp states/trap.js src/auth.js
cat src/auth.js | head -25
```

Show: `localStorage.setItem()` - the violation.

**Say:** "The LLM changed store.set to localStorage. Seems reasonable. Let's test it."

---

### Part 3: Unit Tests Still Pass (30 sec)

```bash
npm run test:unit
```

**Say:** "4 for 4. Unit tests still pass. Ship it?"

**Pause for effect.**

**Say:** "This is the problem. Unit tests verify behavior. They don't verify architecture."

---

### Part 4: Contract Tests Catch It (60 sec)

```bash
npm run test:contracts
```

**THE MONEY SHOT:**

```
❌ CONTRACT VIOLATION: AUTH-001
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

File: src/auth.js:19
Issue: localStorage not allowed (violates AUTH-001)
Code: localStorage.setItem(`session:${sessionId}`...

Requirement AUTH-001:
"Session storage MUST use Redis with TTL"

Why: localStorage breaks in service workers and
     can be disabled by browser policies
```

**Say:** "The contract test scans the source code. It found `localStorage`. Build blocked."

**Say:** "This is what unit tests miss. This is what Specflow catches."

---

### Part 5: The Takeaway (30 sec)

**Say:**

> "Unit tests verify your code works.
> Contracts verify your code stays correct.
>
> We don't need LLMs to behave.
> We need them to be checkable."

---

## Reset After Demo

```bash
npm run demo:reset
```

---

## If Something Goes Wrong

**Tests not running?**
```bash
cd demo && npm install
```

**Wrong state?**
```bash
npm run demo:reset  # Back to safe
```

**Want automated version?**
```bash
npm run demo  # Runs all steps with pauses
```

---

## The Invariant Being Tested

| ID | Rule | Pattern |
|----|------|---------|
| AUTH-001 | Sessions must use store with TTL | `localStorage` forbidden, `store.set` required |

**Why this invariant?**
- Simple to understand (everyone knows localStorage)
- Real-world consequence (breaks in service workers)
- Clear violation message
- Guaranteed to work (no external dependencies)

---

## Files Involved

```
demo/
├── src/auth.js              # The code being tested
├── states/
│   ├── safe.js              # Compliant (store.set with TTL)
│   └── trap.js              # Violation (localStorage)
├── src/__tests__/
│   ├── auth.test.js         # Unit tests (pass in both states!)
│   └── contracts.test.js    # Contract test (catches violation)
└── demo.js                  # Orchestrates the demo
```
