# Specflow Skill for Claude Code

Create a `/specflow` slash command that sets up contract enforcement for any project.

## Quick Setup

```bash
mkdir -p ~/.claude/skills
```

Create `~/.claude/skills/specflow.md` with the content below.

---

## The Skill (Copy This Entire File)

```markdown
# Specflow Skill

Set up architectural contracts that prevent drift. Self-contained - no external docs needed.

## Trigger

/specflow

## Instructions

When the user runs /specflow, follow this workflow:

### Step 1: Interview the User

Ask these questions (user answers in plain English):

**Architecture:**
> "What architectural rules should NEVER be broken?"
> (If you don't know, I'll suggest best practices for your tech stack)

**Features:**
> "What features exist and how should they behave?"

**Journeys:**
> "What user journeys must always work?"
> (I'll suggest obvious ones based on your features)

### Step 2: Generate REQ IDs

From user answers, create IDs:
- Architecture: `ARCH-001`, `ARCH-002`, etc.
- Auth: `AUTH-001`, `AUTH-002`, etc.
- Features: `FEAT-001`, `FEAT-002`, etc.
- Security: `SEC-001`, `SEC-002`, etc.
- Journeys: `J-CHECKOUT-001`, `J-AUTH-001`, etc.

Format: `[DOMAIN]-[NUMBER]`

### Step 3: Create Contract YAML Files

Create `docs/contracts/feature_[name].yml`:

```yaml
contract_meta:
  id: feature_[name]
  version: 1
  covers_reqs:
    - [REQ-ID-1]
    - [REQ-ID-2]

rules:
  non_negotiable:
    - id: [REQ-ID]
      title: "[Short description]"
      scope:
        - "src/[path]/**/*.ts"
      behavior:
        forbidden_patterns:
          - pattern: /[regex]/
            message: "[Why forbidden]"
        required_patterns:
          - pattern: /[regex]/
            message: "[Why required]"
        example_violation: |
          // Bad code
        example_compliant: |
          // Good code

  soft:
    - id: [REQ-ID]
      title: "[Guideline]"
      suggestion: "[What to do instead]"

compliance_checklist:
  before_editing_files:
    - question: "[Question LLM should ask itself]"
      if_yes: "[Action to take]"
```

### Step 4: Create Contract Tests

Create `src/__tests__/contracts/[name].test.ts`:

```typescript
import * as fs from 'fs';
import * as path from 'path';
import { glob } from 'glob';

describe('Contract: [CONTRACT_ID]', () => {
  it('[REQ-ID]: [description]', () => {
    const files = glob.sync('src/[path]/**/*.ts');
    const violations: string[] = [];

    for (const file of files) {
      const content = fs.readFileSync(file, 'utf-8');

      // Check forbidden pattern
      if (/[forbidden_pattern]/.test(content)) {
        const lines = content.split('\n');
        lines.forEach((line, i) => {
          if (/[forbidden_pattern]/.test(line)) {
            violations.push(`${file}:${i + 1}: ${line.trim()}`);
          }
        });
      }
    }

    if (violations.length > 0) {
      throw new Error(
        `CONTRACT VIOLATION: [REQ-ID]\n` +
        `[Message]\n` +
        violations.map(v => `  ${v}`).join('\n') +
        `\n\nSee: docs/contracts/[contract].yml`
      );
    }
  });
});
```

### Step 5: Create Journey Tests (Playwright)

Create `tests/e2e/journey_[name].spec.ts`:

```typescript
import { test, expect } from '@playwright/test';

test.describe('Journey: [J-REQ-ID]', () => {
  test('[description]', async ({ page }) => {
    // Step 1
    await page.goto('/[path]');
    await expect(page.locator('[selector]')).toBeVisible();

    // Step 2
    await page.fill('[selector]', '[value]');
    await page.click('[selector]');

    // Step 3: Verify outcome
    await expect(page).toHaveURL(/[pattern]/);
  });
});
```

### Step 6: Update CLAUDE.md

Add to project's CLAUDE.md:

```markdown
## Architectural Contracts

This project uses Specflow contracts. Before modifying code:

1. Check `docs/contracts/` for rules
2. Run `npm test -- contracts` before committing
3. Contract violations = build fails

### Active Contracts
- [REQ-ID]: [description]
- [REQ-ID]: [description]

### To override a contract
User must explicitly say: `override_contract: [CONTRACT_ID]`
```

### Step 7: Set Up package.json Scripts

```json
{
  "scripts": {
    "test:contracts": "jest --testPathPattern=contracts",
    "test:journeys": "playwright test tests/e2e/"
  }
}
```

### Step 8: Verify

Run `npm run test:contracts` to ensure tests pass.

## Key Principles

- User describes in plain English, YOU generate everything
- Contract violations = build fails (no exceptions)
- Journey = Definition of Done (feature complete when users accomplish goals)
- Architecture contracts before feature contracts
- Contract tests run BEFORE build (pattern scanning)
- Journey tests run AFTER build (Playwright E2E)

## Tech Stack Suggestions

If user doesn't know what rules they need, suggest based on stack:

**Next.js:**
- ARCH-001: No direct DB calls from client components
- ARCH-002: API routes must check auth server-side
- ARCH-003: Secrets only in server code (no NEXT_PUBLIC_)
- AUTH-001: Tokens in httpOnly cookies, not localStorage

**Express/Node:**
- ARCH-001: All routes go through middleware chain
- SEC-001: No SQL string concatenation (use parameterized)
- SEC-002: Validate all req.body before use
- AUTH-001: JWT verification on protected routes

**React SPA:**
- ARCH-001: State management in designated stores only
- ARCH-002: API calls only through service layer
- SEC-001: No tokens in localStorage (use httpOnly cookies)
- SEC-002: Sanitize all user input before render

**Python/Django:**
- ARCH-001: Business logic in services, not views
- SEC-001: No raw SQL queries
- SEC-002: CSRF protection on all forms
- AUTH-001: Session-based auth with secure cookies

**Python/FastAPI:**
- ARCH-001: Dependency injection for services
- SEC-001: Pydantic validation on all inputs
- AUTH-001: OAuth2 or JWT with proper scopes
```

---

## Skill Variants

### /specflow init

```markdown
## Trigger

/specflow init

## Instructions

First-time setup:
1. Create `docs/contracts/` directory
2. Create `src/__tests__/contracts/` directory
3. Create `tests/e2e/` directory
4. Add test scripts to package.json
5. Create initial CLAUDE.md contract section
6. Start the interview process (run /specflow)
```

### /specflow add

```markdown
## Trigger

/specflow add

## Instructions

Add a single new contract:
1. Ask: "What rule should never be broken?"
2. Generate REQ ID
3. Create or update contract YAML
4. Create test file
5. Update CLAUDE.md
6. Run test to verify
```

### /specflow check

```markdown
## Trigger

/specflow check

## Instructions

Verify compliance:
1. Run `npm run test:contracts`
2. For each violation, report:
   - Which contract (REQ ID)
   - Which file:line
   - What pattern matched
   - How to fix it
```

### /specflow freeze

```markdown
## Trigger

/specflow freeze

## Instructions

Lock current working patterns:
1. Ask: "What's working today that you never want broken?"
2. Analyze the described code/behavior
3. Create "freeze contracts" that lock current patterns
4. Generate tests that verify current state
5. Report any existing violations (user decides if OK)
```

---

## Hooks Integration

### Post-Edit Hook

Create `.claude/hooks/post-edit.sh`:

```bash
#!/bin/bash
# Run contract tests after any file edit

if [ -d "src/__tests__/contracts" ]; then
  npm run test:contracts --silent 2>&1
  if [ $? -ne 0 ]; then
    echo "CONTRACT VIOLATION - fix before continuing"
  fi
fi
```

### Pre-Task Hook

Create `.claude/hooks/pre-task.sh`:

```bash
#!/bin/bash
# Remind about contracts before starting work

if [ -d "docs/contracts" ]; then
  echo "This project has Specflow contracts."
  echo "Check docs/contracts/ before modifying protected files."
fi
```

---

## Example Session

```
User: /specflow

Claude: I'll help you set up Specflow contracts.

**Architecture:** What rules should NEVER be broken?
(If unsure, I'll suggest best practices for your tech stack)

User: We're using Next.js. No idea what rules we need.

Claude: For Next.js, I suggest:
- ARCH-001: No direct database calls from client components
- ARCH-002: API routes must use server-side auth check
- ARCH-003: Environment variables with secrets only in server code

Sound good? Any to add or remove?

User: Add one - no localStorage for auth tokens

Claude: Got it. Adding:
- AUTH-001: Auth tokens must use httpOnly cookies, never localStorage

**Features:** What does your app do?

User: E-commerce. Browse products, add to cart, checkout.

Claude: Creating feature contracts:
- FEAT-001: Product queries must include inventory check
- FEAT-002: Cart operations must validate product availability
- FEAT-003: Checkout must verify cart total server-side

**Journeys:** What flows must always work?

User: Checkout flow is critical.

Claude: Creating journey:
- J-CHECKOUT-001: Browse → Cart → Checkout → Confirmation

Now generating files...

✅ docs/contracts/feature_architecture.yml
✅ docs/contracts/feature_auth.yml
✅ docs/contracts/feature_commerce.yml
✅ docs/contracts/journey_checkout.yml
✅ src/__tests__/contracts/architecture.test.ts
✅ src/__tests__/contracts/auth.test.ts
✅ tests/e2e/journey_checkout.spec.ts
✅ Updated CLAUDE.md

Running contract tests... ✅ All passing.

Your project now has Specflow protection.
```

---

## Tips

1. **Start small** - 2-3 critical contracts first
2. **Architecture first** - ARCH before FEAT contracts
3. **Freeze what works** - Use `/specflow freeze` for existing projects
4. **Journey = DOD** - Features aren't done until journeys pass
5. **Hard gate contracts, flexible gate journeys** - Contracts always block; journeys can be manual review
