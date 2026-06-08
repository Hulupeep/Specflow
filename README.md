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

**LLMs don't read. They attend.** Your spec competes with millions of training examples. You can't fix this with better prompts. You need a gate.

---

## The Solution

Contract tests scan your source code for forbidden patterns. Break a rule → build fails. Journey tests run Playwright against your critical flows. If a journey doesn't pass, the feature isn't done.

---

## Get Started

```bash
npx @colmbyrne/specflow init .
```

Creates CLAUDE.md, contracts, hooks, agents, and tests. Then fill in the **Project Context** section in CLAUDE.md (Repository, Board, CLI, Tech Stack).

### Commands

```bash
npx @colmbyrne/specflow init .          # Set up Specflow (safe to re-run)
npx @colmbyrne/specflow verify          # Check installation (13 sections)
npx @colmbyrne/specflow update . --ci   # Update hooks + install CI workflows
npx @colmbyrne/specflow audit 500       # Audit issue #500 for compliance
npx @colmbyrne/specflow graph           # Validate contract cross-references
```

---

## Recommended workflow: harden the PRD *before* you write tickets

Specflow makes tickets **enforceable**. It does not make them **correct** — a perfectly
specflow-compliant ticket can still encode the wrong thing, or a plausible lie with a green
checkmark on it. So put a hostile review *in front* of ticket-writing:

```
1. ADVERSARY      Harden the PRD with the Adversarial PRD Reviewer until it earns a
   (build spec)   SHIP / SHIP WITH STIPULATIONS verdict. Catches no-JTBD, untestable
                  requirements, fake backends, no-data loopholes, skip-to-green, and
                  false claims about the repo — BEFORE any ticket exists.
                  → https://github.com/Hulupeep/adversarial-prd-reviewer

2. SPECFLOW       Turn the hardened PRD into tickets: Gherkin acceptance criteria,
   (write)        data-testid selectors, contract references, E2E journey files.
                  (specflow-writer agent)

3. BOARD AUDITOR  Uplift the tickets to full compliance — fill missing SQL/RLS,
   (uplift)       TypeScript interfaces, invariants, data-testid coverage — then re-audit.
                  npx @colmbyrne/specflow audit <issue>
                  + the board-auditor / specflow-uplifter agents.
```

**Rule of thumb:** never write a ticket from a PRD that hasn't survived the adversary. The
adversary makes the spec honest *to begin with*; Specflow then keeps it honest *forever*
(contracts + journeys).

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
| [Detailed Setup](docs/getting-started.md) | Manual paths, updating, SKILL.md |
| [Agent Library](agents/README.md) | 30+ agents for wave execution |
| [Adversarial PRD Reviewer](https://github.com/Hulupeep/adversarial-prd-reviewer) | Harden the PRD *before* writing tickets (step 1 of the recommended workflow) |
| [Contract Schema](CONTRACT-SCHEMA.md) | YAML format for contracts |
| [CI Integration](CI-INTEGRATION.md) | GitHub Actions setup |
| [npm](https://www.npmjs.com/package/@colmbyrne/specflow) | `@colmbyrne/specflow` |
| [Issues](https://github.com/Hulupeep/Specflow/issues) | Bugs and ideas |
