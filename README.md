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

## What "Specflow-Compliant" Actually Means

An issue or spec is not Specflow-compliant just because it has `REQS` and `JOURNEYS`.

Minimum required sections:
- `REQS`
- `INVARIANTS`
- `Persona Simulation`
- `JOURNEYS`
- `TESTS`
- `DEFINITION OF DONE`

Minimum required traceability:
- every `MUST` requirement maps to at least one test
- each ticket/spec declares whether it has a direct UI surface
- direct UI surfaces must have Playwright coverage or an explicit `N/A` justification
- docs/discoverability work must either expose a real discovery surface or declare itself repo-only
- persona simulation must feed structured pre-flight findings (`simulation_status`, `CRITICAL`, `P1`, `P2`)

Test categories can include:
- feature
- contract
- security
- Playwright / e2e
- unit / integration when appropriate

If `INVARIANTS` or `TESTS` are missing, the issue/spec is not compliant.
If a workflow, UI, permissions, or automation ticket is missing `Persona Simulation`, it is not compliant.

---

## FAQ

**Isn't this just more testing?** No. Tests verify behaviour. Contracts verify architecture. "No localStorage for tokens" survives any refactor. "login() returns a token" doesn't.

**What if I don't have a perfect spec?** Start with "document what works today." Your first contract can be: whatever we're doing now, don't break it.

**Can LLMs actually follow contracts?** Yes — and even if they don't, tests catch it in CI. You don't need the LLM to behave. You need it to be checkable.

**How is this different from linting?** Linting: syntax and style. Contracts: architecture and business rules. Both valuable, different problems.

---

## Built on Real Projects

Delivered 280+ GitHub issues on a production project using Specflow. 0 critical E2E anti-patterns (down from 117). Autonomous wave execution across 30 waves. [Full story →](docs/team-workflows.md#production-track-record)

---

## Where Do You Want to Go?

| I want to... | Go here |
|---|---|
| Decide if Specflow is right for my project | [Should I use Specflow?](docs/should-i-use-specflow.md) |
| Install and configure Specflow | [Getting Started](docs/getting-started.md) |
| Understand how it works | [How It Works](docs/how-it-works.md) |
| Use Specflow with a team | [Team Workflows](docs/team-workflows.md) |
| Set up CI enforcement | [CI Integration](CI-INTEGRATION.md) |
| Browse all 23+ agents | [Agent Library](agents/README.md) |
| Commands and config reference | [Reference](docs/reference.md) |

---

*Made for developers who want specs that actually matter.*
[Colm Byrne](https://www.linkedin.com/in/colmbyrne/) · [GitHub](https://github.com/Hulupeep) · [MIT License](https://opensource.org/licenses/MIT) · [Issues / Ideas](https://github.com/Hulupeep/Specflow/issues)

---

## Try It (2 minutes)

```bash
cd demo && npm install && npm run demo
```

A working app. An LLM "optimisation" that breaks it. Contract tests catching what unit tests missed.
