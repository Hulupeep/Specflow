# Specflow: Type-Checking LLMs

**A 7-slide deck for Agentic Foundations**

---

## Slide 1: The Hook

# We Don't Need LLMs to Behave

# We Need Them to Be Checkable

---

## Slide 2: The Problem

# Drift

You build with an LLM. It works. You iterate.

Slowly, invisibly, the code **drifts** from your original intent.

```
Day 1:  Auth tokens in httpOnly cookies ✓
Day 3:  "Optimized" to localStorage      ✗
Day 5:  Unit tests still pass            ✓
Day 7:  Security breach                  💥
```

**Unit tests verify behavior. They don't verify architecture.**

The LLM didn't disobey. It optimized. And nothing stopped it.

---

## Slide 3: Why It Happens

# Humans Read. LLMs Attend.

A butterfly sees a flower—but not as petals and beauty.
It sees **UV patterns, contrast gradients, motion cues**.

Same photons. Radically different experience.

When you say *"No shortcuts, do it properly"*:
- You assume it perceives salience like you do
- It doesn't
- Your instruction is one voice in a crowd of competing signals

**Fluency ≠ correctness**
**Continuity ≠ memory**
**Confidence ≠ constraint**

---

## Slide 4: The Approach

# Stop Arguing With the Butterfly

# Paint UV Markers on the Flower

```
OLD: Human intent → Prompt → Hope → Review → Fix

NEW: Human intent → Contract → Generate → Test → Ship
```

- **Prompting** = hoping the right things feel salient
- **Contracts** = making salience executable
- **Tests** = deciding what the model must see

> *"Do what you like—explore, generate, surprise me—*
> *but I'm going to type-check you at the end."*

---

## Slide 5: How It Works

# Architecture + Features + Journeys = The Product

| Layer | Defines | Example |
|-------|---------|---------|
| **ARCH** | Structural invariants | "No payment data in localStorage" |
| **FEAT** | Product capabilities | "Queue orders by FIFO" |
| **JOURNEY** | User accomplishments | "User can complete checkout" |

**Skip any layer → ship blind.**

```yaml
# Contract (YAML)
rules:
  non_negotiable:
    - id: ARCH-002
      forbidden_patterns:
        - pattern: /localStorage.*payment/i
          message: "Payment data must not be in localStorage"
```

```typescript
// Test (auto-generated)
if (/localStorage.*payment/i.test(code)) {
  throw new Error("CONTRACT VIOLATION: ARCH-002")
}
```

---

## Slide 6: See It In Action

# QueueCraft: Built in 4 Hours

**Problem:** Commission queue management for creative freelancers

**The Catch:**

LLM adds "quick add" feature. Stores `quoted_price` in localStorage.

```
Unit tests:  ✅ All pass (localStorage.setItem works correctly!)
Contract:    💥 VIOLATION: ARCH-002 - Payment data in localStorage
```

**Unit tests verified behavior. Contract verified architecture.**

The violation was caught. The fix took 5 minutes.

→ [Full dev blog: 8 parts, real code, real catch](../blog/README.md)

---

## Slide 7: Apply It Yourself

# 15 Minutes to Your First Contract

**Step 1: Pick one critical rule**
```
"API routes must require authentication"
```

**Step 2: Write the contract**
```yaml
forbidden_patterns:
  - pattern: /export.*function.*(GET|POST).*\{(?!.*auth)/
    message: "API route missing auth check"
```

**Step 3: Write the test**
```typescript
if (pattern.test(code)) {
  throw new Error("CONTRACT VIOLATION: AUTH-001")
}
```

**Step 4: Run on CI**
```
Violations block merge. Done.
```

---

## Resources

| Resource | What It Is |
|----------|------------|
| [github.com/Hulupeep/Specflow](https://github.com/Hulupeep/Specflow) | The repo |
| [README.md](../README.md) | Start here |
| [blog/](../blog/) | QueueCraft dev blog |
| [demo/](../demo/) | 2-minute working demo |
| [QUICKSTART.md](../QUICKSTART.md) | Choose your path |

---

## The Takeaway

```
LLMs aren't bad junior developers.
They're untyped, side-effect-prone generators.

So instead of instruction, we need compilation.

Generate freely.
Fail loudly.
Nothing ships unless it type-checks.
```

---

*Made with Specflow. Caught what unit tests missed.*
