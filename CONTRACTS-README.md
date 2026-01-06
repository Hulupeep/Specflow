# Specflow System Overview

Turn your product spec into executable rules that enforce themselves.

This system uses **contracts** to make specs testable.

You write a simple spec.
We convert it into:
- YAML **feature contracts** (pattern-based rules)
- YAML **journey contracts** (Definition of Done)
- Automated **tests**
- A **master LLM prompt** that keeps the app aligned with those contracts.

If a contract is violated:
- Tests fail
- CI blocks the merge
- LLMs get a clear violation message

---

## Two Contract Primitives

This system has exactly **two types of contracts**:

### 1. Feature Contracts (Code Patterns)
**What they enforce:** Architectural rules at the code level
**Location:** `docs/contracts/feature_*.yml`

```yaml
rules:
  non_negotiable:
    - id: AUTH-001
      forbidden_patterns:
        - pattern: /localStorage/
          message: "Not available in service workers"
```

Feature contracts scan source files for patterns that must exist or must never appear. They catch bad code before it ships.

### 2. Journey Contracts (User Flows = Definition of Done)
**What they enforce:** Complete user experiences work end-to-end
**Location:** `docs/contracts/journey_*.yml`

```yaml
dod:
  criticality: critical    # critical | important | future
  status: passing          # passing | failing | not_tested
  blocks_release: true

journey_definition:
  name: "Complete Purchase"
  steps:
    - step_name: "Add to Cart"
      required_elements:
        - selector: "[data-testid='add-to-cart']"
```

**Journey contracts ARE your Definition of Done.** A feature isn't complete when code compiles—it's complete when users can accomplish their goals. Critical journeys block release if failing.

See `USER-JOURNEY-CONTRACTS.md` for the complete template and examples.

---

## 🔁 Core Loop

1. **Write or update spec**
   - Edit `docs/specs/<feature>.md` in a simple, constrained format (see `SPEC-FORMAT.md`).
   - **Define ARCHITECTURE constraints first** (ARCH-xxx) - structural invariants.
   - Define REQS (feature requirements) and JOURNEYS (user flows).
   - Mark journeys as **Critical**, **Important**, or **Future** in your Definition of Done.

2. **Generate / update contracts (Architecture First!)**
   - **First:** Create `feature_architecture.yml` with ARCH-xxx rules (if it doesn't exist).
   - **Then:** Create feature contracts with FEAT-xxx rules.
   - **Then:** Create journey contracts with DOD criticality.
   - Use the LLM with `LLM-MASTER-PROMPT.md` or run `npm run contracts:generate <feature>`.

3. **Run tests**
   - `npm test -- contracts` (pattern tests - includes architecture checks)
   - `npm test -- journeys` (E2E journey tests)
   - Fix any violations.

4. **Feature Impact Analysis (for changes)**
   - Which existing journeys does this feature touch?
   - Re-run ALL affected journey tests.
   - Architecture violations in new code break ALL journeys.

5. **Verify Definition of Done**
   - All **Critical** journeys must be `passing`.
   - **Important** journeys should be `passing`.
   - **Future** journeys can remain `not_tested`.

6. **Implement or refactor**
   - LLMs AND humans read contracts before touching protected files.
   - Architecture contracts are NEVER bypassed without explicit override.

---

## 🧩 Key Pieces

### Specification
- **`SPEC-FORMAT.md`** → How to write specs with REQS, JOURNEYS, and DEFINITION OF DONE

### Contract Primitives
- **`docs/contracts/feature_*.yml`** → Feature contracts (code patterns)
- **`docs/contracts/journey_*.yml`** → Journey contracts (user flows = DOD)
- **`CONTRACT-SCHEMA.md`** → YAML schema for both contract types
- **`USER-JOURNEY-CONTRACTS.md`** → Complete guide to journey contracts

### Tests
- **`src/__tests__/contracts/*.test.ts`** → Pattern tests for feature contracts
- **`tests/e2e/journey_*.spec.ts`** → E2E tests for journey contracts (release gates)

### LLM Integration
- **`LLM-MASTER-PROMPT.md`** → Prompt that enforces contracts during development

---

## 🧠 How LLMs Should Behave

Before modifying ANY protected file:

1. Ask: "Is this file protected by a contract?"
2. If yes:
   - Read the relevant `.yml` contract.
   - Check the `compliance_checklist`.
   - Run `npm test -- contracts` or `node scripts/check-contracts.js <file>`.
   - Only then propose code changes.

If user says:

```text
override_contract: <contract_id>
```

then LLM may suggest changes but **must**:

* Explain what rule is being broken.
* Suggest how to update the contract and tests if the change is permanent.

---

## 🧪 Quick Commands

```bash
# Run all contract tests
npm test -- contracts

# Quick check a single file
node scripts/check-contracts.js src/path/to/file.ts

# Generate or update contracts for a feature (LLM-assisted)
npm run contracts:generate spec/user-authentication.md
```

See `SPEC-FORMAT.md` and `CONTRACT-SCHEMA.md` to define new features and contracts.

---

## Where Things Live

```
project/
├── docs/
│   ├── specs/               ← Your feature specs (SPEC-FORMAT.md)
│   │   ├── authentication.md
│   │   └── email-service.md
│   └── contracts/           ← Generated contracts (CONTRACT-SCHEMA.md)
│       ├── feature_authentication.yml
│       └── journey_auth_register.yml
├── src/
│   └── __tests__/
│       └── contracts/       ← Contract verification tests
│           ├── auth_contract.test.ts
│           └── email_contract.test.ts
└── scripts/
    └── check-contracts.js   ← Quick contract checker
```

---

## Quick Start Paths

### Path 1: New Project with Spec
1. Write spec in `docs/specs/<feature>.md` using `SPEC-FORMAT.md`
2. Give LLM: `LLM-MASTER-PROMPT.md` + your spec
3. LLM generates contracts + tests + implementation
4. Run `npm test -- contracts` to verify

### Path 2: Existing Project (Freeze Current State)
1. Document what works today: "Auth uses sessions in Redis, 7-day expiry"
2. Create contract: "Freeze this behavior—don't break it"
3. Generate tests that verify current state
4. Now you can refactor safely—tests catch regressions

### Path 3: Single Feature Addition
1. Add new section to existing spec: `AUTH-004 (MUST): 2FA required for admin`
2. Update contract: Add rule for AUTH-004
3. Update tests: Check for 2FA enforcement
4. Implement feature

---

## Common Workflows

### "I want to add authentication to my API"

1. Create `docs/specs/authentication.md`:
   ```markdown
   ## REQS
   ### AUTH-001 (MUST)
   All API endpoints must require authentication.
   ```

2. Run LLM with `LLM-MASTER-PROMPT.md`:
   ```
   "Generate contracts for docs/specs/authentication.md"
   ```

3. LLM creates:
   - `docs/contracts/feature_authentication.yml`
   - `src/__tests__/contracts/auth_contract.test.ts`

4. Run tests: `npm test -- auth_contract`

5. Implement: Add `authMiddleware` to routes

6. Tests pass → merge

---

### "LLM broke my app—how do I prevent this?"

1. Identify what broke: "LLM used `localStorage` in service worker"

2. Document as contract:
   ```yaml
   # docs/contracts/feature_storage.yml
   rules:
     non_negotiable:
       - id: STORAGE-001
         forbidden_patterns:
           - pattern: /localStorage/
             message: "localStorage not available in service workers"
   ```

3. Create test that scans for `/localStorage/` in service worker files

4. Next time LLM tries this → test fails → build blocked

---

## Why Contracts? The Attention Problem

**Humans read. LLMs attend.**

A butterfly sees a flower—but not as petals, stems, or beauty. It sees UV patterns, contrast gradients, motion cues. Same photons. Radically different experience.

When you say "No shortcuts. Do it properly," you're hoping the LLM perceives salience the way you do. It doesn't. It optimizes what it was trained to attend to—and your carefully-worded instructions are just one voice in the crowd, competing with learned priors, token optimization, and style matching.

Three hours into a session, it starts to drift while simultaneously presenting itself as knowing exactly what you're working on. This appearance of continuity is entirely aesthetic—an optimization artifact. It's not real. And it causes cognitive dissonance because we mistake fluency for understanding.

**Stop arguing with the butterfly. Paint UV markers on the flower.**

- Prompting = *hoping* the right things feel salient
- Contracts = *making* salience executable
- Tests = *deciding* what the model must see

We don't need LLMs to behave. **We need them to be checkable.**

> Prompting expresses intent. Contracts enforce behaviour.
> If you don't turn continuity into code, you'll mistake fluency for truth.

---

## Why Contracts vs. Just Tests?

**The compiler analogy:**

Most LLM workflows look like this:
```
Human intent → Prompt → Hope → Review → Fix
```

Specflow inverts it:
```
Human intent → Contract → Generate → Test → Stop or Ship
```

You don't *trust* the middle. You *verify* the boundary.

**Traditional tests**: Check implementation details (units, functions)
**Contracts**: Check architectural invariants (business rules, journeys)

**Example:**
- ❌ Test: "login function returns token"
  → Breaks if you refactor login internals

- ✅ Contract: "Users must be authenticated before accessing data"
  → Enforces requirement, survives refactors

Contracts test **what must stay true**, not **how it's built**.

The difference matters most with LLMs. A unit test checks code correctness. A contract catches the moment an LLM "optimizes" your auth flow into something that passes all tests but violates your security requirements.

> LLMs aren't bad junior developers. They're untyped, side-effect-prone generators.
> So instead of instruction, we need compilation.
>
> Generate freely. Fail loudly. Nothing ships unless it type-checks.

---

## 🎯 Journeys as Definition of Done

**The core insight:** Unit tests passing ≠ feature complete. Users don't care about your unit tests—they care about completing their goals.

### Traditional vs. DOD Approach

| Traditional | Definition of Done |
|-------------|-------------------|
| "Tests pass" = done | "User journeys pass" = done |
| Check functions work | Check flows work |
| Developer-centric | User-centric |
| Build breaks on unit failure | Build breaks on journey failure |

### DOD Criticality Levels

```
Critical (MUST PASS)     → Blocks release if failing
Important (SHOULD PASS)  → Should fix before release
Future (NOT BLOCKING)    → Can release without
```

### Example: Authentication Feature

```markdown
## DEFINITION OF DONE

### Critical (MUST PASS)
- J-AUTH-REGISTER → User can create account
- J-AUTH-LOGIN → User can sign in

### Important (SHOULD PASS)
- J-AUTH-LOGOUT → User can sign out

### Future (NOT BLOCKING)
- J-AUTH-2FA → Two-factor authentication
```

**Release gate logic:**
- All Critical journeys `status: passing`? ✅ Can release
- Any Critical journey `status: failing`? ❌ Cannot release
- Any Critical journey `status: not_tested`? ❌ Cannot release

---

## Integration with CI/CD

Contracts and journeys run automatically in CI:

```yaml
# .github/workflows/ci.yml
- name: Run Unit Tests
  run: npm test

- name: Verify Feature Contracts
  run: npm test -- contracts

- name: Verify Journey DOD (Critical)
  run: npm test -- journeys --grep "critical"

- name: Check DOD Status
  run: node scripts/check-dod-status.js
```

**Release gates:**
- Feature contracts fail → PR blocked
- Critical journey fails → Release blocked
- DOD check shows `not_tested` critical journey → Release blocked

---

## For More Information

**Core Docs:**
- `SPEC-FORMAT.md` - How to write specs
- `CONTRACT-SCHEMA.md` - YAML contract format
- `USER-JOURNEY-CONTRACTS.md` - Journey contracts and Definition of Done
- `LLM-MASTER-PROMPT.md` - LLM workflow

**Legacy Guides (for reference):**
- `MASTER-ORCHESTRATOR.md` - Complete automation workflow (comprehensive but heavy)
- `SPEC-TO-CONTRACT.md` - Detailed conversion examples
- `META-INSTRUCTION.md` - Infrastructure setup guide

**Templates:**
- `contract-example.yml` - Real contract example
- `test-example.test.ts` - Test template

---

## Success Criteria

You're doing it right when:

1. ✅ Feature contract exists - YAML file with pattern rules
2. ✅ Journey contract exists - YAML file with DOD criticality
3. ✅ Pattern tests enforce feature contracts
4. ✅ E2E tests enforce journey contracts
5. ✅ Intentional violation fails - Tests catch it
6. ✅ Critical journeys pass - DOD verified
7. ✅ CI gates releases - No shipping with broken journeys

---

**Made with ❤️ for vibe coders who want specs that actually matter**
