# Should I Use Specflow?

This doc helps you decide. It covers what Specflow gives you, what it costs, what it doesn't catch, and what tools it works with.

[← Back to README](../README.md)

---

## What You Get

✅ **Specs become enforceable** — Requirements get IDs (AUTH-001). Contracts enforce them. Tests verify them. CI blocks violations automatically.

✅ **Single source of truth** — Each requirement maps to exactly one contract rule. Tests reference requirement IDs. Nothing drifts silently.

✅ **LLM-friendly** — Normalised spec format, clear IDs, reusable prompts, compliance checklists. Works with any LLM.

✅ **Mid-project safe** — Document the current state as a contract. Prevent regressions. Refactor safely without rewriting tests.

✅ **Incremental** — Add one REQ → update contract → update test → implement → verify. Not monolithic.

✅ **CI/CD integrated** — Tests run automatically. Violations block merges. No human enforcement required.

---

## The Three Layers

Every product has three kinds of invariants. Specflow enforces all three.

```
Architecture + Features + Journeys = The Product
```

| Layer | What It Defines | Example | Enforced By |
|-------|-----------------|---------|-------------|
| **Architecture** | Structural rules (always true) | "No payment data in localStorage" | Pattern scan before build |
| **Features** | Product capabilities | "Queue orders by FIFO" | Pattern scan before build |
| **Journeys** | What users must accomplish | "User can complete checkout" | Playwright E2E after build |

**Skip any layer → ship blind.** Define all three → contracts enforce them automatically.

> **Journeys are your Definition of Done.** A feature isn't complete when unit tests pass — it's complete when users can accomplish their goals.

---

## What It Works With

### LLMs & Claude Code

| Integration | What It Does |
|-------------|--------------|
| **Claude Code** | Skills, hooks, CLAUDE.md enforcement, 23+ Task Tool agents |
| **Agent Teams** | Persistent teammate coordination via TeammateTool API (Claude Code 4.6+) |
| **Any LLM** | Contracts work with any model — contract tests catch drift regardless |

### CI/CD

| Platform | Guide |
|----------|-------|
| GitHub Actions | [CI-INTEGRATION.md](../CI-INTEGRATION.md) |
| GitLab CI | [CI-INTEGRATION.md](../CI-INTEGRATION.md) |
| Azure Pipelines | [CI-INTEGRATION.md](../CI-INTEGRATION.md) |
| CircleCI | [CI-INTEGRATION.md](../CI-INTEGRATION.md) |

### Test Frameworks

| Type | Framework |
|------|-----------|
| Contract tests | Jest / Vitest / Mocha (anything that reads files) |
| Journey tests | Playwright |

### Memory & Learning

| Integration | What It Does |
|-------------|--------------|
| **[ruvector](https://github.com/ruvnet/ruvector)** | Store violations in vector memory so LLMs learn from past mistakes |

---

## Honest Limitations

Contract tests catch a lot. They don't catch everything.

### Pattern Scanning Has Blind Spots

Patterns match known code shapes. The same violation in a different syntax gets through:

```javascript
// Pattern: /localStorage/
localStorage.setItem('token', jwt)              // ✅ Caught
window['localStorage']['setItem']('token', jwt) // ❌ Missed
const s = window.localStorage; s.setItem(...)   // ❌ Missed
```

Patterns are narrow by design — too broad and you get false positives.

### Neither Layer Is Sufficient Alone

| Enforcement | What It Catches | What It Misses |
|-------------|-----------------|----------------|
| **Patterns** | Known code shapes, fast | Novel violations, runtime behaviour |
| **Journeys** | Actual breakage, authoritative | Slow, flaky, only what's tested |

### The Honest Numbers

```
Pattern tests:  catch ~80% of drift instantly
Journey tests:  catch another ~15% after build
Production:     ~5% still gets through
```

That's dramatically better than 0% enforcement — which is what you have without contracts. The gate gets stronger over time as you add patterns for violations that slip through.

### How to Strengthen the Gate

1. When a violation slips through, add a pattern for that specific shape
2. Cover critical flows with journey tests — if a pattern can't catch it, a journey can
3. Learn from escapes: every production issue → new pattern or journey

---

## Is Specflow Right for My Project?

**Good fit:**
- You use LLMs heavily for implementation
- You have architectural rules that must not be broken
- You have user flows that must always work
- You want CI to enforce rules automatically without human policing

**Not a fit yet:**
- You don't have any specs or architectural rules defined (start with the demo to see the concept)
- Your project is entirely exploratory with no invariants yet

**Works mid-project:** You don't need a greenfield project. Specflow's mid-project adoption path documents what works today as your first contract, then prevents regressions from there.

→ **Ready to install?** See [Getting Started](getting-started.md)
