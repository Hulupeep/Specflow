# Hook: Journey Verification Agent

## Purpose

Automatically verify journey contracts at BUILD BOUNDARIES. Prevents "build passed but production broken" scenarios by running E2E tests at the right moments.

## Key Principle

**Triggers fire at boundaries, NOT on every activity:**
- PRE-BUILD: Before build runs
- POST-BUILD: After build succeeds
- POST-COMMIT: After commit succeeds
- POST-MIGRATION: After database migration succeeds (if applicable)

**Ticket discovery is AUTOMATIC:**
- From active tasks (TaskList)
- From wave execution context
- From recent git commits
- From conversation context

You do NOT need to mention a ticket number explicitly.

---

## Configuration

Before using, configure these project-specific values in your `.claude/hooks/config.yml` or set in your CLAUDE.md:

```yaml
# .claude/hooks/config.yml (optional - or just document in CLAUDE.md)
project:
  package_manager: pnpm          # npm | yarn | pnpm | bun
  build_command: build           # The script name in package.json
  test_command: test:e2e         # E2E test script
  test_directory: tests/e2e      # Where E2E tests live
  test_pattern: "journey_*.spec.ts"  # Test file pattern

deploy:
  platform: vercel               # vercel | netlify | railway | cloudflare | none
  wait_seconds: 90               # Time to wait for deploy
  production_url: https://www.yourapp.com

database:
  type: supabase                 # supabase | prisma | drizzle | none
  migration_command: "supabase db push"  # or "prisma migrate deploy"
```

---

## Trigger Points

### 1. PRE-BUILD: Before running build
```
Trigger: User says "build" or agent is about to run build command
```

**Agent thinks:**
> "About to build. Let me first check what journeys are affected by the current work."

**Actions:**
1. Check TaskList for in-progress tasks
2. If executing a wave, get issues from wave context
3. Look up journey contracts from those issues
4. Run baseline E2E tests BEFORE building

```bash
# Discover current ticket from tasks or git
gh issue view $(git log -1 --format=%s | grep -oE '#[0-9]+' | head -1 | tr -d '#') 2>/dev/null

# Run baseline tests (replace with your test command)
$PACKAGE_MANAGER run $TEST_COMMAND $TEST_DIRECTORY/$TEST_PATTERN 2>&1 | tee /tmp/pre-build-baseline.log
```

**Report:**
> "Current work touches J-USER-SIGNUP. Baseline: 5/8 tests passing.
> Proceeding with build..."

---

### 2. POST-BUILD: After build succeeds
```
Trigger: Build command exits 0
```

**Agent thinks:**
> "Build passed. TypeScript compiles. Now let me verify the actual user journeys work."

**Actions:**
1. Get journey contracts from current context (tasks, waves, recent commits)
2. Run E2E tests with console capture
3. Compare against pre-build baseline

```bash
# Run with console capture
$PACKAGE_MANAGER run $TEST_COMMAND 2>&1 | tee /tmp/post-build-tests.log

# Check for common errors
grep -E "(does not exist|permission denied|404|500|error|Error)" /tmp/post-build-tests.log
```

**If errors found:**
> "Build passed but E2E tests caught issues:
> - API returned 400 error
> - Baseline was 5/8, now 4/8 (REGRESSION)
>
> Let me investigate before commit."

**If improved:**
> "Build passed. Journey tests: 7/8 (up from 5/8 baseline). Ready for commit."

---

### 3. POST-COMMIT: After commit succeeds
```
Trigger: git commit exits 0
```

**Agent thinks:**
> "Committed. This will deploy. Let me verify production after deploy."

**Actions:**
1. Wait for deploy (configurable seconds)
2. Run E2E tests against production URL
3. Report production status

```bash
sleep $DEPLOY_WAIT_SECONDS
PLAYWRIGHT_BASE_URL=$PRODUCTION_URL $PACKAGE_MANAGER run $TEST_COMMAND
```

**Report:**
> "Committed. Deploying...
> Production verification: 8/8 passing
> Ready to close ticket."

---

### 4. POST-MIGRATION: After database migration succeeds
```
Trigger: Migration command exits 0 (if database configured)
```

**Agent thinks:**
> "Migration pushed. Schema changed. Let me verify APIs and E2E."

**Actions:**
1. Test affected APIs directly (if applicable)
2. Run related E2E tests

```bash
# Run E2E tests
$PACKAGE_MANAGER run $TEST_COMMAND
```

---

## Ticket Discovery (Automatic)

The agent discovers relevant tickets WITHOUT explicit mention:

### From Tasks
```
TaskList → find tasks with status=in_progress → extract issue refs (#XXX)
```

### From Wave Execution
```
Wave context → issues in current wave → journey contracts
```

### From Git Context
```
git log -1 --format=%s → extract #XXX from commit message
git diff --name-only HEAD~5 → map files to features → find journeys
```

### From Conversation
```
Scan recent messages for issue numbers, feature names, or journey refs
```

**Example automatic discovery:**
> "I see we're executing Wave 3 which includes #325, #326, #327.
> Let me check journey contracts for these...
> Found: J-USER-SIGNUP, J-USER-CHECKOUT
> Running baseline tests..."

---

## When NOT to Fire

The hook should NOT trigger on:
- Every bash command (too noisy)
- Every file read/write (irrelevant)
- Every message (annoying)
- Research/exploration commands (not build boundary)

**Only fire at these specific boundaries:**
- Build commands (`build`, `compile`, `bundle`)
- Commit commands (`git commit`)
- Migration commands (project-specific)

---

## Console Capture Pattern

Every E2E test run should capture errors:

```typescript
// In Playwright test setup (example)
page.on('console', msg => {
  if (msg.type() === 'error') {
    console.log(`[CONSOLE ERROR] ${msg.text()}`)
  }
})

page.on('response', response => {
  if (response.status() >= 400) {
    console.log(`[HTTP ${response.status()}] ${response.url()}`)
  }
})
```

---

## Report Format

After each BUILD BOUNDARY verification:

```
══════════════════════════════════════════════════════════════
JOURNEY VERIFICATION
══════════════════════════════════════════════════════════════

Context: Wave 3 (#325, #326, #327)
Journeys: J-USER-SIGNUP, J-USER-CHECKOUT
Test Files: tests/e2e/journey_*.spec.ts

PRE-BUILD BASELINE:
  - 12/20 tests passing

POST-BUILD:
  - 18/20 tests passing (+6)
  - Console errors: 0
  - HTTP errors: 0

POST-COMMIT:
  - Production: 20/20 passing
  - Deploy verified

STATUS: Wave 3 journeys verified
══════════════════════════════════════════════════════════════
```

---

## Integration with Claude Code

### settings.json hooks
These provide REMINDERS to the agent. Customize patterns for your project.

```json
{
  "hooks": {
    "post-tool-use": [
      {"tool": "Bash", "pattern": "git commit", "command": "echo '[HOOK] Run journey verification'"},
      {"tool": "Bash", "pattern": "build", "command": "echo '[HOOK] Run E2E tests'"}
    ]
  }
}
```

### CLAUDE.md instructions
Document your project-specific configuration in CLAUDE.md.

---

## Example: Wave Execution Flow

**User:** "Execute Wave 3"

**Claude:**
> "Starting Wave 3. Issues: #325, #326, #327
> Checking journey contracts...
> Found: J-USER-SIGNUP (CRITICAL), J-USER-CHECKOUT (IMPORTANT)
>
> PRE-BUILD baseline: Running tests..."

*[Runs baseline]*

> "Baseline: 12/20 tests passing.
> Implementing #325..."

*[Implements, then builds]*

> "Build passed. POST-BUILD verification..."

*[Runs tests]*

> "18/20 passing (+6 from baseline).
> Committing..."

*[Commits]*

> "Committed. Waiting for deploy...
> POST-COMMIT production verification..."

*[Runs prod tests]*

> "Production: 20/20 passing
> Wave 3 complete. All journeys verified."

---

## Example: Direct Build Command

**User:** "Build and deploy"

**Claude:**
> "About to build. Let me check current context...
> Active tasks: #158 (user fix)
> Journey: J-USER-SIGNUP
>
> PRE-BUILD baseline: 6/10 passing
> Building..."

*[Build succeeds]*

> "POST-BUILD: 10/10 passing (+4)
> Ready to commit."

*[Commits, waits, verifies]*

> "Production verified. 10/10 passing."

---

## Adapting to Your Stack

| Stack | Build Command | Test Command | Migration Command |
|-------|--------------|--------------|-------------------|
| Next.js + Vercel | `npm run build` | `npm run test:e2e` | N/A or Prisma |
| Vite + Supabase | `pnpm build` | `pnpm test:e2e` | `supabase db push` |
| Rails + Heroku | `rails assets:precompile` | `rails test:system` | `rails db:migrate` |
| Django + Railway | `python manage.py collectstatic` | `pytest` | `python manage.py migrate` |
| Go + Fly.io | `go build` | `go test ./...` | `goose up` |

Configure the patterns in `.claude/settings.json` to match your project.
