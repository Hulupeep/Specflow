# chat2repo - Specflow Example

## IMPLEMENTATION SUMMARY

**Input:** chat2repo-spec.md + journeys.md (Chrome extension for sending ChatGPT/web content to GitHub)

**Output:** Complete contract-based development setup

### Generated Artifacts

| Type | Count | Files |
|------|-------|-------|
| Normalized Spec | 1 | `spec.md` |
| Feature Contracts | 5 | `contracts/feature_*.yml` |
| Journey Contracts | 2 | `contracts/journey_*.yml` |
| Contract Tests | 1 | `__tests__/contracts.test.js` |
| Contract Index | 1 | `contracts/CONTRACT_INDEX.yml` |
| CLAUDE.md | 1 | `CLAUDE.md` |

### Requirements Coverage

- **16 MUST requirements** extracted and mapped to contracts
- **3 SHOULD guidelines** documented
- **8 user journeys** defined (2 with contracts, 6 pending)

### Verification Commands

```bash
cd sample_spec
npm install
npm test                 # Run all tests
npm run test:contracts   # Run contract tests only
```

### Contract Protection

Future LLMs editing the chat2repo codebase will:
1. See contracts in CLAUDE.md (required reading)
2. Run tests before committing
3. Be blocked by CI if contracts violated

**Your spec is now ENFORCED, not just documented.**

---

## Contents

```
sample_spec/
├── chat2repo-spec.md      # Original prose spec (input)
├── journeys.md            # Original user journeys (input)
├── spec.md                # Normalized spec with REQ IDs (generated)
├── contracts/             # YAML contracts (generated)
│   ├── feature_architecture.yml
│   ├── feature_security.yml
│   ├── feature_mv3.yml
│   ├── feature_markdown.yml
│   ├── feature_ux.yml
│   ├── journey_chatgpt_quicksend.yml
│   └── journey_error_noconfig.yml
├── __tests__/
│   └── contracts.test.js  # Contract enforcement tests
└── package.json
```

## What Was Generated

From the original prose specs, Specflow produced:

### 1. Normalized Spec (`spec.md`)
- 16 MUST requirements with IDs (ARCH-001, SEC-001, etc.)
- 3 SHOULD guidelines
- 8 user journeys with IDs (J-CHATGPT-QUICKSEND, etc.)

### 2. Feature Contracts
| Contract | Requirements | Purpose |
|----------|--------------|---------|
| `feature_architecture.yml` | ARCH-001, ARCH-002, ARCH-003 | Layering, module boundaries, size limits |
| `feature_security.yml` | SEC-001, SEC-002, SEC-003 | PAT storage, logging, permissions |
| `feature_mv3.yml` | MV3-001, MV3-002 | Service worker, no polling |
| `feature_markdown.yml` | MD-001, MD-002, MD-003 | Front-matter schema stability |
| `feature_ux.yml` | UX-001, UX-002, UX-003, ERR-001, ERR-002 | User flows, error handling |

### 3. Journey Contracts
| Contract | Journey | Purpose |
|----------|---------|---------|
| `journey_chatgpt_quicksend.yml` | J-CHATGPT-QUICKSEND | Quick send E2E flow |
| `journey_error_noconfig.yml` | J-ERROR-NOCONFIG | Error handling flow |

### 4. Contract Tests
- Scans source code for pattern violations
- Validates manifest.json structure
- Outputs clear `CONTRACT VIOLATION: REQ-ID` messages

## Running Tests

```bash
cd sample_spec
npm install
npm test
```

Since there's no actual `packages/` implementation yet, most tests will skip (no files to scan).

To see violations, create mock files that violate contracts:

```bash
# Create a violating file
mkdir -p packages/core/src
echo "const x = chrome.storage.local.get('test')" > packages/core/src/bad.ts

# Run tests - should fail with ARCH-001 violation
npm test
```

## How to Use This in Your Project

1. **Copy the contracts pattern** - Use these contracts as templates
2. **Adapt to your spec** - Change patterns to match your architecture
3. **Integrate with CI** - Run contract tests on every PR

```yaml
# .github/workflows/ci.yml
- name: Contract Tests
  run: npm run test:contracts
```

## Key Patterns Enforced

| Pattern | What It Catches |
|---------|-----------------|
| `/chrome\./` in core | Browser API leaking into pure TS package |
| `/api\.github\.com/` in content | Direct API calls bypassing background |
| `/console\.log.*token/` | Accidentally logging secrets |
| `/setInterval/` in background | MV3-incompatible polling |
| `/<all_urls>/` in manifest | Over-broad permissions |

## Next Steps

When implementing chat2repo:

1. Create `packages/core/` and `packages/extension/` structure
2. Run contract tests as you develop
3. Tests will fail if you violate architectural rules
4. Fix violations or update contracts (with justification)
