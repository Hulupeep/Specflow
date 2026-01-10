# Specflow Infrastructure Setup Guide

> **📌 STATUS: Infrastructure Setup Guide (Foundational)**
>
> This document focuses on setting up the infrastructure (directories, templates, scripts, CI).
>
> **After setup, use these docs for the actual workflow:**
> - **[CONTRACTS-README.md](CONTRACTS-README.md)** - What contracts are, how they work
> - **[SPEC-FORMAT.md](SPEC-FORMAT.md)** - How to write specs
> - **[CONTRACT-SCHEMA.md](CONTRACT-SCHEMA.md)** - Contract YAML format
> - **[LLM-MASTER-PROMPT.md](LLM-MASTER-PROMPT.md)** - LLM workflow
>
> **Use this doc for:** Infrastructure setup only (directories, templates, CI/CD).
>
> **Don't use this doc for:** Understanding contract semantics or LLM workflow (see core docs above).
>
> ---

## FOR LLMs: How to Set Up Contract Infrastructure in Any Project

This is a **complete, executable guide** for setting up architectural contracts in a codebase. Follow every step sequentially. Do not skip or skim.

---

## Part 1: Understanding Contract-Based Development

### What You're Building:

A system where:
1. **YAML files** define non-negotiable architectural rules
2. **Automated tests** enforce those rules by scanning source code
3. **LLMs check contracts** before making changes (preventing violations)
4. **CI/CD blocks merges** if contracts are violated

### Real-World Example:

**Problem:** Future LLM adds `localStorage` to MV3 service worker → crashes production

**Solution with Contracts:**
1. Contract says: "NEVER use localStorage in background.ts"
2. Test scans background.ts for `/localStorage/` pattern
3. If found → test fails → build blocked → violation prevented

---

## Part 2: Prerequisites Check

**Before starting, verify:**

```bash
# 1. Project has npm/package.json
ls package.json

# 2. Project has test infrastructure (Jest/Vitest/etc)
npm test 2>&1 | head -5

# 3. Project has CI/CD that runs tests
ls .github/workflows/*.yml || ls .gitlab-ci.yml || echo "No CI found"

# 4. You have write access
touch test-write-access && rm test-write-access
```

**If any fail, stop and ask user to set up missing infrastructure first.**

---

## Part 3: Step-by-Step Setup (Execute Sequentially)

### Step 1: Create Directory Structure

```bash
# Create directories
mkdir -p docs/contracts
mkdir -p docs/contracts/templates
mkdir -p src/__tests__/contracts
mkdir -p scripts

# Verify creation
ls -la docs/contracts/
ls -la src/__tests__/contracts/
```

**Expected output:**
```
docs/contracts/
docs/contracts/templates/
src/__tests__/contracts/
scripts/
```

**✅ Checkpoint:** All directories exist before proceeding.

---

### Step 2: Create Contract Template

**File:** `docs/contracts/contract_template.yml`

**Action:** Copy the complete template below exactly:

```yaml
# contract/[contract_name].yaml
# Template for creating architectural contracts

contract_meta:
  id: contract_name_here
  version: 1
  system: project_name
  scope:
    - files
    - affected
  owner: "your_name"
  last_reviewed_by: "your_name"
  last_reviewed_at: "YYYY-MM-DD"
  created_from: "source of this contract (docs, discussion, bug fix)"

llm_edit_policy:
  # If true, future LLMs MUST treat this contract as the source of truth
  enforce_contract: true

  # Only the human user can change non-negotiable rules
  llm_may_modify_non_negotiables: false

  # Optional: exact phrase user must use to allow changes
  override_requires_explicit_phrase: "override_contract: contract_name_here"

context_summary:
  short_description: >
    One paragraph explaining what this contract protects and why.
  rationale:
    - "Reason 1 for this architectural decision"
    - "Reason 2 for this architectural decision"
  references:
    - "docs/file.md"
    - "commit SHA or PR link"

non_negotiable_rules:
  - id: rule_001
    title: "Short description of rule"
    description: >
      Detailed explanation of what this rule enforces and why
      it's non-negotiable.
    status: active
    mutability: immutable   # LLMs cannot change this
    must_hold: true
    scope:
      - src/file.ts
      - src/directory/
    behavior_spec:
      # Define expected behavior in detail
      forbidden_patterns:
        - pattern: /localStorage\.getItem/
          message: "localStorage not allowed in this context"
      required_patterns:
        - pattern: /chrome\.storage\.local/
          message: "Must use chrome.storage.local instead"
    logging_contract:
      normal_logs:
        - message: "Expected log message"
          meaning: "What this log means"
          severity: "info"
      forbidden_logs:
        - pattern: "Error pattern that indicates violation"
          reason: "Why this log indicates a problem"
    allowed_changes:
      - "Safe refactoring that maintains behavior"
      - "Adding instrumentation/logging"
    disallowed_changes:
      - "Specific forbidden modification"
      - "Pattern that violates contract"

soft_rules:
  - id: rule_010
    title: "Preferred pattern (not enforced)"
    description: >
      Guidelines that are preferred but not strictly enforced.
      LLMs can propose changes but should explain reasoning.
    status: active
    mutability: soft
    must_hold: false
    suggested_behavior:
      - "Preferred approach"
    llm_may_adjust_if:
      - "User explicitly requests different approach"
      - "Platform constraints require alternative"

test_requirements:
  required_test_files:
    - path: "src/__tests__/contracts/contractName.test.ts"
      purpose: "Verify rule_001 compliance"
  test_scenarios:
    - scenario: "Description of test scenario"
      verifies: "rule_001"
      assertions:
        - "Assertion 1"
        - "Assertion 2"

compliance_checklist:
  before_modifying_file:
    - question: "Does this change violate rule_001?"
      if_yes: "STOP - Violates rule_001"
    - question: "Does this change require new patterns?"
      if_yes: "Update contract and tests first"

enforcement:
  for_llms:
    - "Read this contract BEFORE proposing changes"
    - "Check compliance_checklist for every edit"
    - "If user request violates rules, explain and ask for override"
    - "Run test_requirements tests after changes"
  for_humans:
    - "This contract documents architectural decisions"
    - "To override: specify override phrase in request"
    - "Tests must pass before merging"
```

**Action after creating:**
```bash
# Verify file exists
cat docs/contracts/contract_template.yml | head -20

# Check it's valid YAML
python3 -c "import yaml; yaml.safe_load(open('docs/contracts/contract_template.yml'))" && echo "✅ Valid YAML"
```

**✅ Checkpoint:** Template file exists and is valid YAML.

---

### Step 3: Create Test Template

**File:** `src/__tests__/contracts/contractTemplate.test.ts`

**Action:** Copy this complete test template:

```typescript
/**
 * Contract Verification Tests: [CONTRACT_NAME]
 *
 * This test suite verifies the [contract_name] contract
 * defined in docs/contracts/[contract_name].yml
 *
 * FROM LLM PERSPECTIVE: These tests ensure that future code changes
 * respect the architectural constraints defined in the contract.
 *
 * Contract ID: [contract_id]
 * Status: immutable (non-negotiable)
 */

describe('Contract: [contract_id]', () => {
  describe('Rule: [rule_001_title]', () => {
    it('LLM CHECK: source code does NOT contain forbidden patterns', async () => {
      const fs = await import('fs')
      const path = await import('path')

      // File to check (adjust path as needed)
      const filePath = path.resolve(__dirname, '../../path/to/file.ts')
      const fileSource = fs.readFileSync(filePath, 'utf-8')

      // Forbidden patterns from contract
      const forbiddenPatterns = [
        { pattern: /localStorage\.getItem/, message: 'localStorage.getItem() not allowed' },
        { pattern: /localStorage\.setItem/, message: 'localStorage.setItem() not allowed' },
      ]

      // Check each forbidden pattern
      for (const { pattern, message } of forbiddenPatterns) {
        if (pattern.test(fileSource)) {
          throw new Error(
            `CONTRACT VIOLATION: [contract_id]\n` +
            `File contains forbidden pattern: ${pattern}\n` +
            `Issue: ${message}\n` +
            `See docs/contracts/[contract_name].yml`
          )
        }
      }
    })

    it('LLM CHECK: required patterns are present', async () => {
      const fs = await import('fs')
      const path = await import('path')

      const filePath = path.resolve(__dirname, '../../path/to/file.ts')
      const fileSource = fs.readFileSync(filePath, 'utf-8')

      // Required patterns from contract
      const requiredPatterns = [
        { pattern: /chrome\.storage\.local/, message: 'Must use chrome.storage.local' },
      ]

      for (const { pattern, message } of requiredPatterns) {
        if (!pattern.test(fileSource)) {
          throw new Error(
            `CONTRACT VIOLATION: [contract_id]\n` +
            `File missing required pattern: ${pattern}\n` +
            `Requirement: ${message}\n` +
            `See docs/contracts/[contract_name].yml`
          )
        }
      }
    })

    it('LLM CHECK: behavior matches contract specification', () => {
      // Test runtime behavior
      // Example: verify function returns expected values
      const mockFunction = () => {
        // Simulate contract-compliant behavior
        return true
      }

      expect(mockFunction()).toBe(true)
    })
  })

  describe('Logging Contract', () => {
    it('LLM CHECK: forbidden log patterns do not appear', async () => {
      const fs = await import('fs')
      const path = await import('path')

      const filePath = path.resolve(__dirname, '../../path/to/file.ts')
      const fileSource = fs.readFileSync(filePath, 'utf-8')

      const forbiddenLogPatterns = [
        /ERROR.*expected_normal_condition/,
      ]

      for (const pattern of forbiddenLogPatterns) {
        if (pattern.test(fileSource)) {
          throw new Error(
            `CONTRACT VIOLATION: [contract_id] logging contract\n` +
            `File contains forbidden log pattern: ${pattern}\n` +
            `See docs/contracts/[contract_name].yml`
          )
        }
      }
    })
  })

  describe('Compliance Checklist', () => {
    it('LLM CHECK: documents compliance questions for LLMs', () => {
      // This test documents the compliance checklist from contract
      const complianceQuestions = [
        {
          question: 'Does this change violate rule_001?',
          expected: 'NO',
          violation: '[contract_id]',
        },
      ]

      complianceQuestions.forEach(check => {
        expect(check.question).toBeDefined()
        expect(check.violation).toBeDefined()
      })
    })
  })
})
```

**Action after creating:**
```bash
# Verify test file exists
ls -la src/__tests__/contracts/contractTemplate.test.ts

# Run the test (should pass as template)
npm test -- contractTemplate
```

**✅ Checkpoint:** Test template exists and can be run.

---

### Step 4: Create Contract Checker Script

**File:** `scripts/check-contracts.js`

**Action:** Copy this complete script:

```javascript
#!/usr/bin/env node
/**
 * Contract Verification Script
 *
 * Quick checker for LLMs to verify contract compliance before making changes.
 * Run this BEFORE modifying any file protected by a contract.
 *
 * Usage:
 *   node scripts/check-contracts.js [file_path]
 *   node scripts/check-contracts.js  # Check all protected files
 */

const fs = require('fs')
const path = require('path')

// CONTRACT REGISTRY - EDIT THIS FOR YOUR PROJECT
// Maps files to their contracts
const CONTRACT_REGISTRY = {
  // Example:
  // 'src/background.ts': ['background_auth_hydration.yml'],
  // 'src/lib/storage.ts': ['storage_patterns.yml'],
}

// FORBIDDEN PATTERNS - EDIT THIS FOR YOUR PROJECT
// Define forbidden patterns from your contracts
const FORBIDDEN_PATTERNS = {
  // Example pattern set:
  // 'example_rule_001': [
  //   { pattern: /localStorage\.getItem/, message: 'localStorage not allowed' },
  //   { pattern: /document\.createElement/, message: 'document API not allowed' },
  // ],
}

function checkFile(filePath) {
  const normalizedPath = filePath.replace(/\\/g, '/')
  const contracts = CONTRACT_REGISTRY[normalizedPath]

  if (!contracts) {
    console.log(`✅ ${filePath} - Not protected by any contracts`)
    return true
  }

  if (!fs.existsSync(filePath)) {
    console.log(`⚠️  ${filePath} - File not found`)
    return true
  }

  const content = fs.readFileSync(filePath, 'utf-8')
  let violations = []

  // Check all forbidden patterns
  for (const [ruleId, patterns] of Object.entries(FORBIDDEN_PATTERNS)) {
    for (const { pattern, message } of patterns) {
      if (pattern.test(content)) {
        violations.push({
          ruleId,
          pattern: pattern.toString(),
          message,
        })
      }
    }
  }

  if (violations.length === 0) {
    console.log(`✅ ${filePath} - Passes all contract checks`)
    console.log(`   Protected by: ${contracts.join(', ')}`)
    return true
  } else {
    console.log(`❌ ${filePath} - CONTRACT VIOLATIONS FOUND`)
    console.log(`   Protected by: ${contracts.join(', ')}`)
    console.log('')
    violations.forEach(({ ruleId, pattern, message }, i) => {
      console.log(`   Violation ${i + 1}: ${ruleId}`)
      console.log(`   Pattern: ${pattern}`)
      console.log(`   Issue: ${message}`)
      console.log('')
    })
    console.log(`   See: docs/contracts/${contracts[0]}`)
    return false
  }
}

function main() {
  console.log('🔍 Contract Verification\n')

  const targetFile = process.argv[2]

  if (targetFile) {
    // Check single file
    const passed = checkFile(targetFile)
    process.exit(passed ? 0 : 1)
  } else {
    // Check all protected files
    console.log('Checking all protected files:\n')
    let allPassed = true

    for (const filePath of Object.keys(CONTRACT_REGISTRY)) {
      const passed = checkFile(filePath)
      allPassed = allPassed && passed
      console.log('')
    }

    if (allPassed) {
      console.log('✅ All protected files pass contract checks')
      process.exit(0)
    } else {
      console.log('❌ Some files have contract violations')
      console.log('\nTo fix:')
      console.log('  1. Read the contract: cat docs/contracts/[contract_name].yml')
      console.log('  2. Run contract tests: npm test -- src/__tests__/contracts/')
      console.log('  3. Check compliance checklist in contract YAML')
      process.exit(1)
    }
  }
}

main()
```

**Action after creating:**
```bash
# Make executable
chmod +x scripts/check-contracts.js

# Test it runs
node scripts/check-contracts.js

# Expected output: "Checking all protected files" (none yet)
```

**✅ Checkpoint:** Checker script exists and is executable.

---

### Step 5: Add Contract Section to CLAUDE.md

**Action:** Add this section to the **TOP** of your project's CLAUDE.md (or create if missing):

```markdown
# Project Name - Development Guide

## 🚨 CRITICAL: Architectural Contracts - READ THIS FIRST

### MANDATORY: Check Contracts Before ANY Code Changes

This project uses **architectural contracts** (YAML files in `docs/contracts/`) that define **non-negotiable rules**. These contracts are enforced by automated tests.

**⚠️ BEFORE modifying ANY protected file, you MUST:**
1. Read the relevant contract in `docs/contracts/`
2. Run the contract verification script
3. Check the compliance checklist in the contract
4. Only proceed if the change is allowed

#### How to Check Contracts:

```bash
# 1. Read the contract FIRST
cat docs/contracts/[contract_name].yml

# 2. Run contract verification tests
npm test -- src/__tests__/contracts/

# 3. Quick check specific file
node scripts/check-contracts.js src/your-file.ts
```

#### Contract Violation Example:
If you violate a contract:
```
❌ CONTRACT VIOLATION: [contract_id]
File contains forbidden pattern
See docs/contracts/[contract_name].yml
```

#### Overriding Contracts:
**Only the human user can override non-negotiable rules.**
To override, user must explicitly say:
```
override_contract: [contract_name]
```

#### Available Contracts:
(Add your contracts here as you create them)
- **[contract_name].yml**: Description of what it protects

**📖 See `docs/contracts/README.md` for full contract system documentation**

---
```

**Action after adding:**
```bash
# Verify CLAUDE.md has contract section
head -50 CLAUDE.md | grep -i contract

# Should show contract section at top
```

**✅ Checkpoint:** CLAUDE.md has contract section at top.

---

### Step 6: Create Contract README

**File:** `docs/contracts/README.md`

**Action:** Copy this complete README (adapting PROJECT_NAME):

```markdown
# Architectural Contracts - [PROJECT_NAME]

## What Are Contracts?

Contracts are **machine-readable architectural decisions** stored as YAML files that:
- Define **non-negotiable rules** LLMs cannot change without user override
- Enforce rules via **automated tests** that scan source code
- **Block builds** if violated (CI/CD integration)
- Provide **compliance checklists** for LLMs to verify before changes

## Quick Start for LLMs

**Before modifying ANY code:**

```bash
# 1. Check if file is protected
node scripts/check-contracts.js src/your-file.ts

# 2. Read the contract (source of truth)
cat docs/contracts/[contract_name].yml

# 3. Run contract tests
npm test -- src/__tests__/contracts/
```

## Available Contracts

(This section will be populated as you create contracts)

### `example_contract.yml`
**Protects:** Description
**Status:** Active
**Rules:** X non-negotiable rules
**Tests:** Y tests

## Creating New Contracts

### When to Create:
- Critical architectural decisions that shouldn't change
- Platform constraints LLMs might not know
- Performance patterns with subtle tradeoffs
- Security boundaries that must be preserved

### Steps:
1. Copy `docs/contracts/contract_template.yml`
2. Fill in contract metadata and rules
3. Create tests in `src/__tests__/contracts/`
4. Add to `scripts/check-contracts.js` registry
5. Update this README

## Integration with CI/CD

Contracts are enforced automatically:

```bash
npm test  # Runs contract tests
→ If violated, build fails
→ PR blocked from merging
```

## For More Information

- **Templates:** `docs/contracts/templates/`
- **LLM Workflow:** `docs/contracts/LLM-WORKFLOW.md`
- **Meta-Instructions:** `docs/contracts/templates/META-INSTRUCTION.md`
```

**Action after creating:**
```bash
# Verify README exists
cat docs/contracts/README.md | head -20
```

**✅ Checkpoint:** Contract README exists.

---

### Step 7: Integrate with CI/CD

**Action:** Verify contracts run in CI:

```bash
# Check if npm test runs contracts
npm test -- src/__tests__/contracts/ 2>&1 | grep -i "test suites"

# Check your CI config includes npm test
cat .github/workflows/*.yml | grep "npm test" || \
cat .gitlab-ci.yml | grep "npm test" || \
echo "⚠️  Add 'npm test' to your CI config"
```

**If CI doesn't run tests:**

Add to `.github/workflows/ci.yml` (or equivalent):
```yaml
- name: Run Tests
  run: npm test

- name: Verify Contracts
  run: npm test -- src/__tests__/contracts/
```

**✅ Checkpoint:** CI runs contract tests.

---

### Step 8: Create Your First Contract

**Now create a REAL contract for your project:**

1. **Identify a constraint:**
   - What architectural rule should NEVER be broken?
   - Example: "API endpoints must have authentication"
   - Example: "Database queries must use prepared statements"

2. **Copy template:**
   ```bash
   cp docs/contracts/contract_template.yml docs/contracts/my_first_contract.yml
   ```

3. **Fill in contract:**
   - Set `contract_meta.id` to unique name
   - Define 1-3 `non_negotiable_rules`
   - Specify forbidden/required patterns
   - Write compliance checklist

4. **Create tests:**
   ```bash
   cp src/__tests__/contracts/contractTemplate.test.ts src/__tests__/contracts/myFirstContract.test.ts
   ```

   - Update file paths to scan
   - Add forbidden/required patterns from contract
   - Run test: `npm test -- myFirstContract`

5. **Register in checker:**
   - Edit `scripts/check-contracts.js`
   - Add to `CONTRACT_REGISTRY`
   - Add to `FORBIDDEN_PATTERNS`

6. **Verify end-to-end:**
   ```bash
   node scripts/check-contracts.js
   npm test -- src/__tests__/contracts/
   ```

**✅ Checkpoint:** First contract works end-to-end.

---

## Part 4: Verification Checklist

**Run ALL these commands to verify setup:**

```bash
# 1. Directory structure
ls docs/contracts/
ls docs/contracts/templates/
ls src/__tests__/contracts/
ls scripts/check-contracts.js

# 2. Template files exist
ls docs/contracts/contract_template.yml
ls src/__tests__/contracts/contractTemplate.test.ts

# 3. Checker script works
node scripts/check-contracts.js

# 4. CLAUDE.md has contract section
grep -i "architectural contracts" CLAUDE.md

# 5. Tests can run
npm test -- src/__tests__/contracts/

# 6. CI includes tests
grep -r "npm test" .github/ .gitlab-ci.yml 2>/dev/null
```

**Expected results:**
- ✅ All directories exist
- ✅ All templates exist
- ✅ Checker runs without errors
- ✅ CLAUDE.md has contract section
- ✅ Tests run successfully
- ✅ CI config includes tests

---

## Part 5: Usage Examples

### Example 1: Creating "No SQL Injection" Contract

**Step 1: Create contract**
```yaml
# docs/contracts/sql_injection_prevention.yml
contract_meta:
  id: sql_injection_prevention
  version: 1

non_negotiable_rules:
  - id: sql_001_no_string_concat
    title: "Database queries MUST use prepared statements"
    behavior_spec:
      forbidden_patterns:
        - pattern: /query\s*\(\s*["'`].*\$\{.*\}/
          message: "String interpolation in SQL queries is forbidden"
        - pattern: /query\s*\(\s*["'`].*\+/
          message: "String concatenation in SQL queries is forbidden"
      required_patterns:
        - pattern: /query\s*\(\s*["'`].*\?\s*["'`]/
          message: "Must use parameterized queries"
```

**Step 2: Create test**
```typescript
it('LLM CHECK: no SQL injection vulnerabilities', async () => {
  const fs = await import('fs')
  const files = getAllSQLFiles() // Your helper function

  for (const file of files) {
    const content = fs.readFileSync(file, 'utf-8')

    if (/query\(.*\$\{/.test(content)) {
      throw new Error(
        `SQL INJECTION RISK: ${file}\n` +
        `String interpolation in query detected\n` +
        `Use prepared statements instead`
      )
    }
  }
})
```

**Step 3: Verify**
```bash
npm test -- sql
node scripts/check-contracts.js src/db/
```

### Example 2: Creating "React Hooks Order" Contract

**Step 1: Create contract**
```yaml
non_negotiable_rules:
  - id: react_001_hooks_order
    title: "React hooks must be called at top level"
    behavior_spec:
      forbidden_patterns:
        - pattern: /if\s*\(.*\)\s*{\s*use[A-Z]/
          message: "Hooks cannot be called conditionally"
        - pattern: /for\s*\(.*\)\s*{\s*use[A-Z]/
          message: "Hooks cannot be called in loops"
```

**Step 2: Create test** (scans all React components)

**Step 3: Add to CI**

---

## Part 6: Maintenance

### When Contract Changes:

1. **User must explicitly override:**
   ```
   User: "override_contract: contract_name"
   ```

2. **Update contract YAML:**
   - Increment version
   - Add to changelog
   - Update rules

3. **Update tests:**
   - Match new patterns
   - Run and verify pass

4. **Update checker script:**
   - Add new patterns
   - Test on affected files

### Regular Audits:

```bash
# Monthly: Review all contracts
ls docs/contracts/*.yml | xargs -I {} bash -c 'echo "=== {} ===" && grep "last_reviewed_at" {}'

# Update last_reviewed_at if still valid
```

---

## Part 7: Success Criteria

**You've successfully set up contract infrastructure when:**

✅ Templates exist and are documented
✅ Tests run and enforce at least one contract
✅ Checker script works for protected files
✅ CLAUDE.md instructs LLMs to check contracts
✅ CI/CD runs contract tests automatically
✅ Team understands how to create new contracts

**Test with intentional violation:**
1. Add forbidden pattern to protected file
2. Run `node scripts/check-contracts.js`
3. Should detect violation
4. Run `npm test -- contracts`
5. Should fail with clear message

---

## Part 8: Common Issues

### Issue: "Tests don't fail when I violate contract"

**Solution:**
- Check test file paths are correct
- Verify regex patterns match actual code
- Run test with `npm test -- contracts --verbose`

### Issue: "Checker script says no contracts"

**Solution:**
- Add files to `CONTRACT_REGISTRY` in `check-contracts.js`
- Add patterns to `FORBIDDEN_PATTERNS`

### Issue: "CI doesn't run contract tests"

**Solution:**
- Add explicit step: `npm test -- src/__tests__/contracts/`
- Verify test command in CI config

---

## Part 9: Next Steps

After setup:

1. **Create 2-3 core contracts** for your most critical constraints
2. **Train team** on contract system (share this doc)
3. **Add contracts gradually** as architectural decisions emerge
4. **Review quarterly** to ensure contracts reflect current architecture

---

## Appendix: File Checklist

```
Project Root
├── docs/
│   └── contracts/
│       ├── README.md                    ✅ Created
│       ├── contract_template.yml        ✅ Created
│       └── templates/
│           ├── META-INSTRUCTION.md      ✅ This file
│           ├── contract-example.yml     (Next to create)
│           └── test-example.test.ts     (Next to create)
├── src/
│   └── __tests__/
│       └── contracts/
│           └── contractTemplate.test.ts ✅ Created
├── scripts/
│   └── check-contracts.js               ✅ Created
└── CLAUDE.md                            ✅ Updated with contract section
```

---

**END OF META-INSTRUCTION**

**To verify this instruction worked:**
```bash
./scripts/verify-contract-setup.sh  # We'll create this next
```
