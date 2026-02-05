# Hook: Journey Verification Agent

## Purpose

Automatically verify journey contracts at BUILD BOUNDARIES. Prevents "build passed but production broken" scenarios by running Playwright tests at the right moments.

## Key Principle

**Triggers fire at boundaries, NOT on every activity:**
- PRE-BUILD: Before `pnpm build` runs
- POST-BUILD: After `pnpm build` succeeds
- POST-COMMIT: After `git commit` succeeds
- POST-MIGRATION: After `supabase db push` succeeds

**Ticket discovery is AUTOMATIC:**
- From active tasks (TaskList)
- From wave execution context
- From recent git commits
- From conversation context

You do NOT need to mention a ticket number explicitly.

---

## Trigger Points

### 1. PRE-BUILD: Before running build
```
Trigger: User says "build", "pnpm build", "let's build", or agent is about to run build
```

**Agent thinks:**
> "About to build. Let me first check what journeys are affected by the current work."

**Actions:**
1. Check TaskList for in-progress tasks
2. If executing a wave, get issues from wave context
3. Look up journey contracts from those issues
4. Run baseline Playwright tests BEFORE building

```bash
# Discover current ticket from tasks or git
gh issue view $(git log -1 --format=%s | grep -oE '#[0-9]+' | head -1 | tr -d '#') 2>/dev/null

# Or from task context - agent reads TaskList and extracts issue refs

# Run baseline tests
pnpm test:e2e tests/e2e/journey_*.spec.ts 2>&1 | tee /tmp/pre-build-baseline.log
```

**Report:**
> "Current work touches J-DEMO-SIGNUP. Baseline: 5/8 tests passing.
> Proceeding with build..."

---

### 2. POST-BUILD: After build succeeds
```
Trigger: Bash command contains "build" and exits 0
```

**Agent thinks:**
> "Build passed. TypeScript compiles. Now let me verify the actual user journeys work."

**Actions:**
1. Get journey contracts from current context (tasks, waves, recent commits)
2. Run Playwright tests with console capture
3. Compare against pre-build baseline

```bash
# Run with console capture
pnpm test:e2e tests/e2e/auth/signup-with-demo.spec.ts 2>&1 | tee /tmp/post-build-tests.log

# Check for errors
grep -E "(column.*does not exist|permission denied|404|500|RPC)" /tmp/post-build-tests.log
```

**If errors found:**
> "Build passed but Playwright caught issues:
> - RPC 400 error in signup flow
> - Baseline was 5/8, now 4/8 (REGRESSION)
>
> Let me investigate before commit."

**If improved:**
> "Build passed. Journey tests: 7/8 (up from 5/8 baseline). Ready for commit."

---

### 3. POST-COMMIT: After commit succeeds
```
Trigger: Bash command is "git commit" and exits 0
```

**Agent thinks:**
> "Committed. This will deploy. Let me verify production after deploy."

**Actions:**
1. Wait 90 seconds for deploy
2. Run Playwright against production URL
3. Report production status

```bash
sleep 90
PLAYWRIGHT_BASE_URL=https://www.yourapp.com pnpm test:e2e tests/e2e/auth/signup-with-demo.spec.ts
```

**Report:**
> "Committed. Vercel deploying...
> Production verification: 8/8 passing
> Ready to close ticket."

---

### 4. POST-MIGRATION: After db push succeeds
```
Trigger: Bash command contains "supabase db push" and exits 0
```

**Agent thinks:**
> "Migration pushed. Schema changed. Let me verify RPCs and E2E."

**Actions:**
1. Test affected RPCs directly
2. Run related Playwright tests

```bash
# Test RPC
curl -s "$SUPABASE_URL/rest/v1/rpc/provision_demo_org" \
  -H "apikey: $ANON_KEY" \
  -H "Content-Type: application/json" \
  -d '{"p_job_id": "test"}' | head -1

# Run E2E
pnpm test:e2e tests/e2e/auth/signup-with-demo.spec.ts
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
> Found: J-WHATSAPP-NO-SHOW, J-WHATSAPP-COVERAGE
> Running baseline tests..."

---

## When NOT to Fire

The hook should NOT trigger on:
- Every bash command (too noisy)
- Every file read/write (irrelevant)
- Every message (annoying)
- Research/exploration commands (not build boundary)

**Only fire at these specific commands:**
- `pnpm build` / `npm run build`
- `git commit`
- `supabase db push`

---

## Console Capture Pattern

Every Playwright run should capture errors:

```typescript
// In test setup
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
Journeys: J-WHATSAPP-NO-SHOW, J-WHATSAPP-COVERAGE
Test Files: tests/e2e/whatsapp/*.spec.ts

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
These provide REMINDERS to the agent. The actual test execution is agent behavior.

```json
{
  "hooks": {
    "post-tool-use": [
      {"tool": "Bash", "pattern": "git commit", "command": "echo '[HOOK] Run journey verification'"},
      {"tool": "Bash", "pattern": "supabase db push", "command": "echo '[HOOK] Test RPCs and E2E'"},
      {"tool": "Bash", "pattern": "pnpm build", "command": "echo '[HOOK] Run Playwright tests'"}
    ]
  }
}
```

### CLAUDE.md instructions
The CLAUDE.md file instructs the agent on the expected behavior at each trigger.

---

## Example: Wave Execution Flow

**User:** "Execute Wave 3"

**Claude:**
> "Starting Wave 3. Issues: #325, #326, #327
> Checking journey contracts...
> Found: J-WHATSAPP-NO-SHOW (CRITICAL), J-WHATSAPP-COVERAGE (IMPORTANT)
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

> "Committed. Waiting for Vercel (90s)...
> POST-COMMIT production verification..."

*[Runs prod tests]*

> "Production: 20/20 passing
> Wave 3 complete. All journeys verified."

---

## Example: Direct Build Command

**User:** "Build and deploy"

**Claude:**
> "About to build. Let me check current context...
> Active tasks: #158 (signup fix)
> Journey: J-DEMO-SIGNUP
>
> PRE-BUILD baseline: 6/10 passing
> Building..."

*[Build succeeds]*

> "POST-BUILD: 10/10 passing (+4)
> Ready to commit."

*[Commits, waits, verifies]*

> "Production verified. 10/10 passing."
