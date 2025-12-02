# Contracts as Spec – System Overview

This repo uses **contracts** to turn your product spec into executable rules.

You write a simple spec.
We convert it into:
- YAML **contracts**
- Automated **tests**
- A **master LLM prompt** that keeps the app aligned with those contracts.

If a contract is violated:
- Tests fail
- CI blocks the merge
- LLMs get a clear violation message

---

## 🔁 Core Loop

1. **Write or update spec**
   - Edit `docs/specs/<feature>.md` in a simple, constrained format (see `SPEC-FORMAT.md`).

2. **Generate / update contracts**
   - Use the LLM with `LLM-MASTER-PROMPT.md` or run `npm run contracts:generate <feature>`.

3. **Run tests**
   - `npm test -- contracts`
   - Fix any violations.

4. **Implement or refactor**
   - LLMs AND humans read contracts before touching protected files.

---

## 🧩 Key Pieces

- **`SPEC-FORMAT.md`**
  → How to write specs that are easy to turn into contracts.

- **`CONTRACT-SCHEMA.md`**
  → The exact YAML shape for all contracts (lean and consistent).

- **`docs/contracts/*.yml`**
  → Actual contracts, each tied to one or more spec requirements.

- **`src/__tests__/contracts/*.test.ts`**
  → Tests generated from contracts. They:
    - Scan for forbidden patterns (e.g. `localStorage` in a service worker)
    - Check required patterns (e.g. `authMiddleware` on API routes)
    - Optionally run behavioural checks for critical flows.

- **`LLM-MASTER-PROMPT.md`**
  → The prompt you give to Claude/Cursor/etc. to:
    - Convert spec → contracts
    - Generate / update tests
    - Implement features respecting contracts.

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

## Why Contracts vs. Just Tests?

**Traditional tests**: Check implementation details (units, functions)
**Contracts**: Check architectural invariants (business rules, journeys)

**Example:**
- ❌ Test: "login function returns token"
  → Breaks if you refactor login internals

- ✅ Contract: "Users must be authenticated before accessing data"
  → Enforces requirement, survives refactors

Contracts test **what must stay true**, not **how it's built**.

---

## Integration with CI/CD

Contracts run automatically in CI:

```yaml
# .github/workflows/ci.yml
- name: Run Tests
  run: npm test

- name: Verify Contracts
  run: npm test -- contracts
```

If contracts fail → build fails → PR blocked.

---

## For More Information

**Core Docs:**
- `SPEC-FORMAT.md` - How to write specs
- `CONTRACT-SCHEMA.md` - YAML contract format
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

1. ✅ Contract exists - YAML file with clear rules
2. ✅ Test enforces it - Test scans source code
3. ✅ Intentional violation fails - Test catches it
4. ✅ Fix makes it pass - Test verifies fix
5. ✅ CI runs automatically - Every PR tested

---

**Made with ❤️ for vibe coders who want specs that actually matter**
