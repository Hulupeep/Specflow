# CLAUDE.md Contract Section Template

## Instructions for LLMs:

**Copy the section below and add it to the TOP of your project's CLAUDE.md file.**

Replace placeholders in [brackets] with your project-specific information.

---

## TEMPLATE START (Copy everything below this line)

```markdown
# [PROJECT_NAME] - Development Guide

## 🚨 CRITICAL: Architectural Contracts - READ THIS FIRST

### MANDATORY: Check Contracts Before ANY Code Changes

This project uses **architectural contracts** (YAML files in `docs/contracts/`) that define **non-negotiable rules**. These contracts are enforced by automated tests.

**⚠️ BEFORE modifying ANY protected file, you MUST:**
1. Read the relevant contract in `docs/contracts/`
2. Run the contract verification script
3. Check the compliance checklist in the contract
4. Only proceed if the change is allowed

#### Files Protected by Contracts:

<!-- UPDATE THIS LIST as you add contracts -->
- `[src/path/to/file.ts]` → `docs/contracts/[contract_name].yml`
- `[src/path/to/other.ts]` → `docs/contracts/[contract_name].yml`
<!-- Add more protected files here -->

#### How to Check Contracts:

```bash
# 1. Check if file is protected
node scripts/check-contracts.js src/your-file.ts

# 2. Read the contract (SOURCE OF TRUTH)
cat docs/contracts/[contract_name].yml

# 3. Run contract verification tests
npm test -- src/__tests__/contracts/

# 4. Check specific contract
npm test -- [contractName]
```

#### Contract Violation Example:

If you try to violate a contract:
```
❌ CONTRACT VIOLATION: [contract_id]
File contains forbidden pattern: /[pattern]/
Issue: [description of violation]
See docs/contracts/[contract_name].yml
```

The build will FAIL and the PR will be BLOCKED.

#### Overriding Contracts:

**Only the human user can override non-negotiable rules.**

To override, user must explicitly say:
```
override_contract: [contract_name]
```

Then you may proceed, but should:
1. Explain why this violates the contract
2. Warn about potential consequences
3. Ask if contract should be updated permanently

#### Available Contracts:

<!-- UPDATE THIS LIST as you add contracts -->

##### 1. `[contract_name].yml`
**Protects:** [Brief description of what this contract enforces]
**Rules:** [Number] non-negotiable rules
**Status:** Active
**Key rules:**
- `[rule_id]`: [Brief description]

<!-- Add more contracts here as you create them -->

##### Adding New Contracts:

See `docs/contracts/templates/META-INSTRUCTION.md` for complete setup guide.

**📖 Full Documentation:**
- Contract System: `docs/contracts/README.md`
- LLM Workflow: `docs/contracts/LLM-WORKFLOW.md`
- Templates: `docs/contracts/templates/`

---

## [REST OF YOUR CLAUDE.MD CONTENT]
<!-- Your existing CLAUDE.md content goes here -->
```

## TEMPLATE END

---

## Customization Guide:

### Required Changes:

1. **[PROJECT_NAME]** - Replace with your actual project name
2. **Files Protected by Contracts** - Add your protected files
3. **Available Contracts** - List your contracts with descriptions
4. **Contract names** - Replace `[contract_name]` with actual contract IDs

### Optional Sections:

You can add:
- Quick reference table of contracts
- Link to security team contact
- Escalation process for contract overrides
- Project-specific contract examples

### Example Filled-In Version:

```markdown
# TabStax Extension - Development Guide

## 🚨 CRITICAL: Architectural Contracts - READ THIS FIRST

### MANDATORY: Check Contracts Before ANY Code Changes

This project uses **architectural contracts** (YAML files in `docs/contracts/`) that define **non-negotiable rules**. These contracts are enforced by automated tests.

**⚠️ BEFORE modifying ANY protected file, you MUST:**
1. Read the relevant contract in `docs/contracts/`
2. Run the contract verification script
3. Check the compliance checklist in the contract
4. Only proceed if the change is allowed

#### Files Protected by Contracts:

- `src/background.ts` → `docs/contracts/background_auth_hydration.yml`
- `src/lib/authStorage.ts` → `docs/contracts/background_auth_hydration.yml`
- `src/services/supabase/index.ts` → `docs/contracts/background_auth_hydration.yml`
- `src/hooks/useStaxData/effects/useLoginEffect.ts` → `docs/contracts/background_auth_hydration.yml`

#### How to Check Contracts:

```bash
# 1. Check if file is protected
node scripts/check-contracts.js src/background.ts

# 2. Read the contract (SOURCE OF TRUTH)
cat docs/contracts/background_auth_hydration.yml

# 3. Run contract verification tests
npm test -- src/__tests__/contracts/

# 4. Check specific contract
npm test -- backgroundAuthHydration
```

#### Contract Violation Example:

If you try to add `localStorage` to `background.ts`:
```
❌ CONTRACT VIOLATION: bg_storage_002_chrome_storage_only
File contains forbidden pattern: /localStorage\.getItem/
Issue: localStorage.getItem() not allowed in MV3 service worker
See docs/contracts/background_auth_hydration.yml
```

The build will FAIL and the PR will be BLOCKED.

#### Overriding Contracts:

**Only the human user can override non-negotiable rules.**

To override, user must explicitly say:
```
override_contract: background_auth_hydration
```

#### Available Contracts:

##### 1. `background_auth_hydration.yml`
**Protects:** Background service worker auth and storage patterns
**Rules:** 3 non-negotiable rules
**Status:** Active
**Key rules:**
- `bg_auth_001_no_startup_hydration`: Background MUST NOT hydrate auth on startup
- `bg_storage_002_chrome_storage_only`: Background MUST use chrome.storage.local only
- `bg_messaging_003_fire_and_forget`: Popup sends sync requests fire-and-forget

**📖 Full Documentation:**
- Contract System: `docs/contracts/README.md`
- LLM Workflow: `docs/contracts/LLM-WORKFLOW.md`
- Templates: `docs/contracts/templates/`
```

---

## Verification:

After adding to CLAUDE.md, verify:

```bash
# 1. CLAUDE.md has contract section at top
head -50 CLAUDE.md | grep -i "architectural contracts"

# 2. Section is readable
cat CLAUDE.md | head -100

# 3. All links work
# Manually check that referenced files exist
```

Expected: Contract section appears in first 50 lines of CLAUDE.md

---

## Tips:

### Placement:
- Put contract section at **very top** (after title)
- Before project overview
- Before setup instructions
- LLMs read top of file first

### Brevity:
- Keep section concise (under 100 lines)
- Link to full docs for details
- Focus on "what to do" not "why"

### Updates:
- Update when adding new contracts
- Update protected files list
- Keep "Available Contracts" section current

### Testing:
After adding, test LLM workflow:
1. Ask LLM to modify a protected file
2. LLM should mention checking contract
3. LLM should run contract checker
4. LLM should read YAML contract

---

## Multi-Project Setup:

If you have multiple projects, add this to each project's CLAUDE.md:

```markdown
**Note:** Each project has its own contracts. Don't assume contracts
from Project A apply to Project B.

Current project: [PROJECT_NAME]
Contracts location: docs/contracts/
```
