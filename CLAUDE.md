# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## For Your Project

**Add the content below to your project's CLAUDE.md** to enable Specflow contract enforcement.

**Two options:**

1. **Quick start:** Copy the simple template below
2. **Full template:** Use [CLAUDE-MD-TEMPLATE.md](CLAUDE-MD-TEMPLATE.md) for detailed placeholders and examples

Or just tell your LLM:
```
Add Specflow CLAUDE.md content to my project's CLAUDE.md
```

---

# ⬇️ COPY EVERYTHING BELOW INTO YOUR PROJECT'S CLAUDE.md ⬇️

---

## Specflow Contracts

This project uses **Specflow contracts** to prevent architectural drift.

**The rule:** If you violate a contract, the build fails. No exceptions.

### Before Modifying Protected Code

1. Check if the file is covered by a contract in `docs/contracts/`
2. Read the contract's `forbidden_patterns` and `required_patterns`
3. Run `npm test -- contracts` before committing
4. If tests fail with `CONTRACT VIOLATION: <REQ-ID>`, fix the violation

### Contract Locations

| Type | Location |
|------|----------|
| Feature contracts | `docs/contracts/feature_*.yml` |
| Journey contracts | `docs/contracts/journey_*.yml` |
| Contract tests | `src/__tests__/contracts/*.test.ts` |

### What Contracts Enforce

- `rules.non_negotiable` - MUST requirements. Build fails if violated.
- `rules.soft` - SHOULD requirements. Guidelines, not enforced.
- `forbidden_patterns` - Regex patterns that must NOT appear in code.
- `required_patterns` - Regex patterns that MUST appear in code.

### Override Protocol

If you need to break a contract (rare), the user must explicitly say:
```
override_contract: <contract_id>
```

Then you MUST:
1. Explain what rule is being broken and why
2. Update the contract if the change is permanent
3. Update the tests to match

### Commands

```bash
npm test -- contracts    # Run contract tests
npm test -- journeys     # Run journey tests (E2E)
```

### When User Asks to Set Up Specflow

If the user asks to "set up Specflow" or "create contracts":

1. **Interview them** - Ask what should never be broken (plain English is fine)
2. **Generate REQ IDs** - Create AUTH-001, STORAGE-001, J-CHECKOUT-001 from their answers
3. **Create contracts** - Write YAML files in `docs/contracts/`
4. **Create tests** - Write test files in `src/__tests__/contracts/`
5. **Update CI** - Add contract tests to the build pipeline
6. **Update this section** - Add the specific contracts below

### Active Contracts

<!-- LLM: Add your project's contracts here after generating them -->
<!-- Example:
- AUTH-001: Sessions must use Redis, not localStorage
- AUTH-002: All /api/* routes require authMiddleware
- SEC-001: Passwords must be bcrypt hashed
- J-CHECKOUT-001: Cart → Payment → Confirmation flow must work
-->

_No contracts defined yet. Ask your LLM to set up Specflow._

---

# ⬆️ END OF CONTENT TO COPY ⬆️

---

## About This Repository

This is the **Specflow methodology repository**. It contains:

- Documentation on how to write specs and contracts
- Templates and examples
- A demo proving contracts catch what unit tests miss

### Demo Commands

```bash
cd demo && npm install
npm run demo              # Full automated walkthrough
npm run demo:reset        # Reset to safe state
npm run test:unit         # Run unit tests only
npm run test:contracts    # Run contract tests only
```

### Key Docs

| Doc | Purpose |
|-----|---------|
| LLM-MASTER-PROMPT.md | How LLMs should generate contracts |
| SPEC-FORMAT.md | How to write specs with REQ IDs |
| CONTRACT-SCHEMA.md | YAML contract format |
| MID-PROJECT-ADOPTION.md | Adding to existing projects |
| CI-INTEGRATION.md | Setting up CI gates |

See [README.md](README.md) for full documentation.
