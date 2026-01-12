# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## What Is Specflow?

Specflow is a methodology for building software with LLMs that doesn't drift.

**The problem:** You build with an LLM. It works. You iterate. Slowly, the code drifts from your original intent. Unit tests pass, but architectural rules get violated.

**The solution:** Describe what matters → Generate contracts → Auto-create tests → Violations fail the build.

## When a User Asks for Specflow

If a user says anything like:
- "Set up Specflow"
- "Create contracts for this project"
- "Protect this code from breaking"
- "Make sure no one can break [feature]"

**Your job:**

1. **Interview them in plain English** - Ask what matters:
   - "What architectural rules should NEVER be broken?"
   - "What's working today that you don't want anyone to break?"
   - "What user flows are critical?"

2. **YOU generate REQ IDs** from their answers:
   - `ARCH-001`, `ARCH-002` for architecture rules
   - `AUTH-001`, `STORAGE-001` for feature rules
   - `J-CHECKOUT-001` for user journeys

3. **Create contracts** in `docs/contracts/`:
   - `feature_*.yml` for pattern rules
   - `journey_*.yml` for user flows

4. **Create tests** in `src/__tests__/contracts/`:
   - Tests that scan for `forbidden_patterns`
   - Tests that verify `required_patterns`

5. **Update CI** to run contract tests on every PR

6. **Update this CLAUDE.md** with the contract rules so future LLMs know them

**The user describes things in plain English. You do the structuring.**

---

## Commands

### Demo (proves the concept works)
```bash
cd demo && npm install
npm run demo              # Full automated walkthrough
npm run demo:reset        # Reset to safe state
npm run test:unit         # Run unit tests only
npm run test:contracts    # Run contract tests only
npm test                  # Run all tests
```

### Verification
```bash
./verify-setup.sh         # Check if project setup is correct
```

### When adopting Specflow in your project
```bash
npm test -- contracts     # Run contract tests
npm test -- journeys      # Run journey tests (E2E)
```

---

## File Locations

| Type | Location | Naming |
|------|----------|--------|
| Specs | `docs/specs/*.md` | `authentication.md` |
| Feature contracts | `docs/contracts/feature_*.yml` | `feature_authentication.yml` |
| Journey contracts | `docs/contracts/journey_*.yml` | `journey_auth_register.yml` |
| Contract tests | `src/__tests__/contracts/*.test.ts` | `auth_contract.test.ts` |
| E2E journey tests | `tests/e2e/journey_*.spec.ts` | `journey_auth_register.spec.ts` |
| Contract index | `docs/contracts/CONTRACT_INDEX.yml` | Tracks all contracts |

---

## The Core Loop

```
User describes → You generate REQ IDs → Contract YAML → Test file → CI blocks violations
```

Example transformation:

**User says:** "Our auth uses Redis sessions, never localStorage"

**You generate:**
```yaml
# docs/contracts/feature_auth.yml
rules:
  non_negotiable:
    - id: AUTH-001
      title: "Sessions use Redis, not localStorage"
      scope: ["src/**/*.ts", "src/**/*.js"]
      behavior:
        forbidden_patterns:
          - pattern: /localStorage\.(get|set)Item.*session/i
            message: "Sessions must use Redis, not localStorage"
```

**And test:**
```typescript
// src/__tests__/contracts/auth.test.ts
it('AUTH-001: No localStorage for sessions', () => {
  // Scan source files for forbidden pattern
  // Fail with: CONTRACT VIOLATION: AUTH-001
})
```

---

## Key Concepts

### Requirement IDs
- Format: `[FEATURE]-[NUMBER]` (e.g., `AUTH-001`, `EMAIL-042`)
- Architecture: `ARCH-001`, `ARCH-002` (structural invariants, define first)
- Journeys: `J-AUTH-REGISTER`, `J-CHECKOUT` (user flows)
- Tags: `(MUST)` = non-negotiable, `(SHOULD)` = guideline

### Contract Rules
- `rules.non_negotiable`: MUST requirements - build fails if violated
- `rules.soft`: SHOULD requirements - guidelines, not enforced
- `forbidden_patterns`: Regex patterns that must NOT appear in code
- `required_patterns`: Regex patterns that MUST appear in code

### Test Output Format
Contract tests MUST output violations in this format:
```
CONTRACT VIOLATION: <REQ-ID> - <message>
  File: <path>
  Line: <number>
  Match: <matched_text>
```

---

## LLM Behavior Rules

When modifying this repo or projects using Specflow:

1. **Do NOT modify protected code without checking contracts first**
2. **Do NOT change `non_negotiable` rules unless user says `override_contract: <id>`**
3. **Always work incrementally:** spec → contract → test → code → verify
4. **Architecture contracts (`ARCH-*`) come before feature contracts**
5. **Critical journeys must pass before release**
6. **When user describes something in plain English, YOU generate the REQ IDs**

---

## Core Docs (Read Order)

For full details on the methodology:

1. **LLM-MASTER-PROMPT.md** - Complete workflow for LLMs
2. **SPEC-FORMAT.md** - How to write specs with requirement IDs
3. **CONTRACT-SCHEMA.md** - YAML format for contracts
4. **MID-PROJECT-ADOPTION.md** - Adding to existing projects
5. **CI-INTEGRATION.md** - Setting up CI gates

---

## The Key Insight

> We don't need LLMs to behave. We need them to be checkable.

- Unit tests verify behavior (does it work?)
- Contracts verify architecture (does it stay correct?)

**If someone violates a contract, the build fails. End of story.**
