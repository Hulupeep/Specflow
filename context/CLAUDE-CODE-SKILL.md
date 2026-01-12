# Specflow Skill for Claude Code

Create a `/specflow` slash command that sets up contract enforcement for any project.

## Quick Setup

Add this to your Claude Code skills directory:

```bash
mkdir -p ~/.claude/skills
```

Create `~/.claude/skills/specflow.md`:

```markdown
# Specflow Skill

Set up architectural contracts that prevent drift.

## Trigger

/specflow

## Instructions

When the user runs /specflow, do the following:

1. **Check for Specflow docs** in the project:
   - Look for `docs/Specflow/` or `Specflow/` folder
   - If not found, tell user to copy Specflow into their project first

2. **Read the core docs:**
   - LLM-MASTER-PROMPT.md
   - SPEC-FORMAT.md
   - CONTRACT-SCHEMA.md
   - USER-JOURNEY-CONTRACTS.md

3. **Interview the user:**
   Ask these questions (user can answer in plain English):

   - "What architectural rules should NEVER be broken?"
     (If they don't know, suggest best practices for their tech stack)

   - "What features exist and how should they behave?"

   - "What user journeys must always work?"
     (Suggest obvious ones based on their features)

4. **Generate from their answers:**
   - REQ IDs (AUTH-001, STORAGE-001, J-CHECKOUT-001, etc.)
   - Contract YAML files in `docs/contracts/`
   - Contract tests in `src/__tests__/contracts/`
   - Journey tests in `tests/e2e/` (Playwright)
   - CI configuration for GitHub Actions
   - Update CLAUDE.md with contract rules

5. **Explain enforcement:**
   - Contract tests: hard gate (always block PR)
   - Journey tests: flexible (hard gate OR manual review)

6. **Verify setup:**
   Run `npm test -- contracts` to verify tests work.

## Key Principles

- User describes in plain English, YOU generate the structure
- Contract violations = build fails (no exceptions)
- Journey = Definition of Done (feature complete when users accomplish goals)
- Architecture contracts come before feature contracts
```

## Alternative: Project-Local Skill

Add to your project's `.claude/skills/specflow.md` for project-specific behavior:

```markdown
# Specflow Skill (Project-Specific)

## Trigger

/specflow

## Instructions

This project uses Specflow. Read these docs first:
- docs/Specflow/LLM-MASTER-PROMPT.md
- docs/Specflow/SPEC-FORMAT.md
- docs/Specflow/CONTRACT-SCHEMA.md

Then follow the standard Specflow workflow:
1. Interview user about architecture, features, journeys
2. Generate REQ IDs from their answers
3. Create contracts in docs/contracts/
4. Create tests in src/__tests__/contracts/
5. Update CLAUDE.md with contract rules

Existing contracts in this project:
<!-- List your project's contracts here -->
- AUTH-001: Sessions use Redis, not localStorage
- SEC-001: No SQL string concatenation
- J-CHECKOUT-001: Cart → Payment → Confirmation flow
```

## Skill Variants

### /specflow init

First-time setup for a project.

```markdown
## Trigger

/specflow init

## Instructions

1. Copy Specflow docs into project (if not present)
2. Create docs/contracts/ directory
3. Create src/__tests__/contracts/ directory
4. Create tests/e2e/ directory
5. Add contract test script to package.json
6. Create initial CLAUDE.md contract section
7. Start the interview process
```

### /specflow add

Add a new contract to existing setup.

```markdown
## Trigger

/specflow add

## Instructions

1. Ask: "What rule should never be broken?"
2. Generate REQ ID
3. Create contract YAML
4. Create test file
5. Update CLAUDE.md
6. Run test to verify
```

### /specflow check

Verify current compliance.

```markdown
## Trigger

/specflow check

## Instructions

1. Run `npm test -- contracts`
2. Report any violations
3. For each violation, explain:
   - Which contract was violated
   - What file/line caused it
   - How to fix it
```

### /specflow freeze

Create contracts from existing working code.

```markdown
## Trigger

/specflow freeze

## Instructions

1. Ask: "What's working today that you never want broken?"
2. Analyze the described behavior
3. Create "freeze contracts" that lock current patterns
4. Generate tests that verify current state
5. Any existing violations are reported (user decides if OK)
```

## Hooks Integration

Combine with Claude Code hooks for automatic enforcement:

### Post-Edit Hook

Create `.claude/hooks/post-edit.sh`:

```bash
#!/bin/bash
# Run contract tests after any file edit

# Only run if contracts exist
if [ -d "src/__tests__/contracts" ]; then
  echo "Running contract tests..."
  npm test -- contracts --silent

  if [ $? -ne 0 ]; then
    echo "⚠️  CONTRACT VIOLATION - check output above"
  fi
fi
```

### Pre-Task Hook

Create `.claude/hooks/pre-task.sh`:

```bash
#!/bin/bash
# Remind about contracts before starting work

if [ -f "docs/contracts/CONTRACT_INDEX.yml" ]; then
  echo "📋 This project has Specflow contracts."
  echo "   Check docs/contracts/ before modifying protected files."
fi
```

## Example Session

```
User: /specflow

Claude: I'll help you set up Specflow contracts. Let me ask a few questions.

**Architecture:** What rules should NEVER be broken?
(If unsure, I'll suggest best practices for your tech stack)

User: We're using Next.js. No idea what rules we need.

Claude: For Next.js, I'd suggest these architecture rules:
- ARCH-001: No direct database calls from client components
- ARCH-002: API routes must use server-side auth check
- ARCH-003: Environment variables with secrets only in server code

Sound good? Any to add or remove?

User: Add one - no localStorage for auth tokens

Claude: Got it. Adding:
- AUTH-001: Auth tokens must use httpOnly cookies, never localStorage

**Features:** What does your app do?

User: It's an e-commerce site. Users browse products, add to cart, checkout.

Claude: I'll create feature contracts for:
- FEAT-001: Product queries must include inventory check
- FEAT-002: Cart operations must validate product availability
- FEAT-003: Checkout must verify cart total server-side

**Journeys:** What flows must always work?

User: The checkout flow is critical. Browse → Cart → Checkout → Confirmation.

Claude: Creating journey contract:
- J-CHECKOUT-001: User can complete purchase (Browse → Cart → Checkout → Confirmation)

Now generating:
- docs/contracts/feature_architecture.yml
- docs/contracts/feature_auth.yml
- docs/contracts/feature_commerce.yml
- docs/contracts/journey_checkout.yml
- src/__tests__/contracts/architecture.test.ts
- src/__tests__/contracts/auth.test.ts
- tests/e2e/journey_checkout.spec.ts
- Updated CLAUDE.md

Running contract tests... ✅ All passing.

Your project now has Specflow protection. Contract violations will fail the build.
```

## Tips

1. **Start small** - Add 2-3 critical contracts first, expand later
2. **Architecture first** - ARCH contracts before FEAT contracts
3. **Freeze what works** - Use `/specflow freeze` for existing projects
4. **Journey = DOD** - Features aren't done until journeys pass
5. **Manual gate journeys** - Hard gate contracts, flexible gate E2E
