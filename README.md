# Specflow

**Specs that enforce themselves.**

LLMs drift. You write a rule; three iterations later the model "helpfully" ignores it. Specflow turns your specs into contract tests that break the build when violated — so drift can't ship.

---

## The Problem

```typescript
// Your spec: "Service workers MUST NOT use localStorage"
// LLM adds this anyway after iteration 3:
const token = localStorage.getItem('auth') // No crash. Just drift.
```

**LLMs don't read. They attend.** Your carefully worded spec competes with millions of training examples. Three hours into a session, the model drifts while presenting itself as knowing exactly what you're working on. You can't fix this with better prompts. You need a gate.

---

## The Solution

Contract tests scan your source code for forbidden patterns. Break a rule → CI fails before build. Journey tests run Playwright against your critical flows. If a journey doesn't pass, the feature isn't done.

> *Do what you like — explore, generate, surprise me — but I'm going to type-check you at the end.*

---

## Get Started

```bash
npx @colmbyrne/specflow init .
```

That's it. Creates contracts, agents, hooks, tests, and verifies everything passes. No cloning, no samples, no demo files.

**Then update CLAUDE.md** with your project context and tell Claude Code:

```
Execute waves
```

### Other commands

```bash
npx @colmbyrne/specflow verify          # Check installation (13 sections)
npx @colmbyrne/specflow update . --ci   # Update hooks + install CI workflows
npx @colmbyrne/specflow audit 500       # Audit issue #500 for compliance
npx @colmbyrne/specflow graph           # Validate contract cross-references
```

For all setup paths (manual, SKILL.md, Claude-assisted), see [Getting Started](docs/getting-started.md).

---

## What You Get

| Layer | What it does |
|-------|-------------|
| **Contract tests** | YAML rules scan source for forbidden patterns — break a rule, build fails |
| **Journey tests** | Playwright tests for critical user flows — if a journey doesn't pass, the feature isn't done |
| **Hooks** | Auto-trigger tests on build/commit, catch violations on Write/Edit, reject commits without issue numbers |
| **CI workflows** | PR compliance gate + post-merge audit — no contract violations merge to main |
| **30+ agents** | Orchestrate wave execution, write contracts, audit boards, simulate specs |

---

## FAQ

**Isn't this just more testing?** No. Tests verify behaviour. Contracts verify architecture. "No localStorage in service workers" survives any refactor.

**What if I don't have a perfect spec?** Start with "document what works today." Your first contract can be: whatever we're doing now, don't break it.

**Can LLMs actually follow contracts?** Even if they don't, tests catch it. You don't need the LLM to behave. You need it to be checkable.

---

## Links

| | |
|---|---|
| [Getting Started](docs/getting-started.md) | Install, configure, verify |
| [Agent Library](agents/README.md) | 30+ agents for wave execution |
| [Contract Schema](CONTRACT-SCHEMA.md) | YAML format for contracts |
| [CI Integration](CI-INTEGRATION.md) | GitHub Actions setup |
| [npm package](https://www.npmjs.com/package/@colmbyrne/specflow) | `@colmbyrne/specflow` |
| [Issues](https://github.com/Hulupeep/Specflow/issues) | Bugs and ideas |
