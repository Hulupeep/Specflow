# Contract Schema Extensions for DPAO

These extensions reduce parallel execution failure rates from 11% to <5%.

---

## Extension 1: Anti-Patterns Section

**Prevents:** Wrong library usage (e.g., shadcn UI when project uses native HTML)
**Saved:** 30+ minutes per violation in Wave 2 Batch 2

### Schema Addition to Feature Contracts

```yaml
contract_meta:
  id: feature_architecture
  version: 2
  # ... existing fields ...

# NEW SECTION
anti_patterns:
  libraries:
    forbidden:
      - name: "shadcn/ui"
        reason: "Project uses native HTML + Tailwind, not component libraries"
        wrong: "import { Button } from '@/components/ui/button'"
        correct: "button className=\"px-4 py-2 bg-blue-600 rounded\""

      - name: "Material-UI"
        reason: "Conflicts with Tailwind utility classes"
        wrong: "import { TextField } from '@mui/material'"
        correct: "input className=\"border rounded px-3 py-2\""

  patterns:
    forbidden:
      - pattern: "useToast()"
        reason: "No toast library installed, use console.log during dev"
        wrong: "toast.success('Saved!')"
        correct: "console.log('Saved successfully')"

      - pattern: "\.firstName|\.lastName"
        reason: "Employee entity only has fullName property"
        wrong: "employee.firstName + ' ' + employee.lastName"
        correct: "employee.fullName"

  data_access:
    forbidden:
      - pattern: "supabase.from("
        reason: "Must use Repository pattern (ARCH-003)"
        wrong: "const { data } = await supabase.from('employees').select()"
        correct: "const employees = await employeeRepo.findAll(orgId)"

    required:
      - pattern: "Repository.ts$"
        message: "All data access must go through Repository classes"

# HOW AGENTS USE THIS
agent_checklist:
  before_importing_library:
    - question: "Is this library in anti_patterns.libraries.forbidden?"
      if_yes: "DO NOT USE. Use the 'correct' pattern instead."

  before_using_pattern:
    - question: "Does this match any anti_patterns.patterns.forbidden?"
      if_yes: "Use the 'correct' alternative shown in the contract."
```

### Example Usage in GitHub Issues

```markdown
## Anti-Patterns (from ARCH-001)
❌ DO NOT USE:
- shadcn/ui components (Button, Dialog, Table)
- employee.firstName/lastName (use employee.fullName)
- Direct supabase.from() calls (use Repository pattern)

✅ USE INSTEAD:
- Native HTML + Tailwind classes
- employee.fullName property
- SupabaseEmployeeRepository.findAll()
```

### Test Hook

```typescript
// src/__tests__/contracts/anti_patterns.test.ts
import { glob } from 'glob'
import fs from 'fs'
import yaml from 'yaml'

describe('Anti-Patterns Contract', () => {
  const contract = yaml.parse(fs.readFileSync('docs/contracts/feature_architecture.yml', 'utf8'))

  contract.anti_patterns.libraries.forbidden.forEach(lib => {
    it(`should not import ${lib.name}`, () => {
      const files = glob.sync('src/**/*.{ts,tsx}')
      files.forEach(file => {
        const content = fs.readFileSync(file, 'utf8')
        expect(content).not.toMatch(new RegExp(lib.wrong.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')))
      })
    })
  })

  contract.anti_patterns.patterns.forbidden.forEach(pattern => {
    it(`should not use forbidden pattern: ${pattern.pattern}`, () => {
      const files = glob.sync('src/**/*.{ts,tsx}')
      files.forEach(file => {
        const content = fs.readFileSync(file, 'utf8')
        expect(content).not.toMatch(new RegExp(pattern.pattern))
      })
    })
  })
})
```

---

## Extension 2: Completion Verification Checklist

**Prevents:** Agent #302 reported complete but files never committed
**Saved:** 2-3 hours retry time

### Schema Addition to Journey Contracts

```yaml
journey_meta:
  id: J-PAXTON-INTEGRATION
  # ... existing fields ...

# NEW SECTION
completion_verification:
  # Checklist agent MUST complete before reporting "done"
  required_files:
    - path: "supabase/functions/paxton-webhook/index.ts"
      must_contain: "export async function handler"
      verification: "grep -l 'export async function handler' supabase/functions/paxton-webhook/index.ts"

    - path: "supabase/migrations/XXX_paxton_event_migration.sql"
      must_contain: "INSERT INTO attendance_events"
      verification: "ls supabase/migrations/*paxton*.sql"

  required_commits:
    - description: "Edge function implementation"
      file_pattern: "supabase/functions/**/*.ts"
      verification: "git log --oneline --all -- supabase/functions/"

    - description: "Migration for data migration"
      file_pattern: "supabase/migrations/*.sql"
      verification: "git log --oneline --all -- supabase/migrations/"

  quality_gates:
    - check: "TypeScript compilation"
      command: "pnpm tsc --noEmit"
      must_pass: true

    - check: "Contract tests"
      command: "pnpm test -- contracts"
      must_pass: true

    - check: "E2E test exists and passes"
      command: "pnpm test:e2e -- journey_paxton"
      must_pass: true

# HOW AGENTS USE THIS
agent_protocol:
  after_implementation:
    - step: "Verify all required_files exist"
      command: "ls {path}"
      failure: "STOP - Report to coordinator: Missing file {path}"

    - step: "Verify all required_commits made"
      command: "git log --oneline -- {file_pattern}"
      failure: "STOP - Report to coordinator: No commits for {file_pattern}"

    - step: "Run all quality_gates"
      failure: "STOP - Report to coordinator: Quality gate failed: {check}"

    - step: "Only if ALL checks pass"
      action: "Report completion to coordinator"
```

### Example Usage in GitHub Issues

```markdown
## Completion Verification (Agent Checklist)
Before reporting this issue complete, verify:
- [ ] File exists: `supabase/functions/paxton-webhook/index.ts`
- [ ] File contains: `export async function handler`
- [ ] Commit made: `git log -- supabase/functions/`
- [ ] TypeScript passes: `pnpm tsc --noEmit`
- [ ] Contract tests pass: `pnpm test -- contracts`
- [ ] E2E test exists: `tests/e2e/journey_paxton.spec.ts`
- [ ] E2E test passes: `pnpm test:e2e -- journey_paxton`

If ANY check fails, STOP and report blocker to coordinator.
```

### Coordinator Validation Script

```typescript
// scripts/verify-agent-completion.ts
import { glob } from 'glob'
import { execSync } from 'child_process'
import yaml from 'yaml'
import fs from 'fs'

function verifyCompletion(issueNumber: number): boolean {
  const issue = fetchGitHubIssue(issueNumber)
  const journeyId = extractJourneyId(issue.body) // e.g., J-PAXTON-INTEGRATION

  const contract = yaml.parse(
    fs.readFileSync(`docs/contracts/journey_${journeyId.toLowerCase()}.yml`, 'utf8')
  )

  const verification = contract.completion_verification

  // Check required files exist
  for (const file of verification.required_files) {
    if (!fs.existsSync(file.path)) {
      console.error(`❌ Missing file: ${file.path}`)
      return false
    }

    const content = fs.readFileSync(file.path, 'utf8')
    if (!content.includes(file.must_contain)) {
      console.error(`❌ File ${file.path} missing required content: ${file.must_contain}`)
      return false
    }
  }

  // Check commits made
  for (const commit of verification.required_commits) {
    const log = execSync(`git log --oneline --all -- ${commit.file_pattern}`).toString()
    if (log.trim() === '') {
      console.error(`❌ No commits for: ${commit.file_pattern}`)
      return false
    }
  }

  // Run quality gates
  for (const gate of verification.quality_gates) {
    try {
      execSync(gate.command, { stdio: 'inherit' })
    } catch (error) {
      console.error(`❌ Quality gate failed: ${gate.check}`)
      return false
    }
  }

  console.log(`✅ Issue #${issueNumber} completion verified`)
  return true
}
```

---

## Extension 3: Parallel Coordination Rules

**Prevents:** Premature exports causing TypeScript errors (attendance/index.ts)
**Saved:** 20+ minutes conflict resolution per wave

### Schema Addition to Feature Contracts

```yaml
contract_meta:
  id: feature_architecture
  version: 2
  # ... existing fields ...

# NEW SECTION
parallel_coordination:
  # Files that consolidate multiple agents' work
  consolidation_files:
    - path: "src/features/*/index.ts"
      rule: "DO NOT MODIFY during parallel execution"
      reason: "Export barrel files - coordinator adds exports after all agents finish"
      agent_instruction: |
        If you need to export from index.ts:
        1. Create your component/hook file
        2. Add TODO comment: // TODO: Add to index.ts - export { MyComponent } from './components/MyComponent'
        3. Report completion with TODO location
        4. Coordinator will consolidate all exports after wave completes

      coordinator_action: |
        After all agents in wave complete:
        1. Scan for TODO comments in feature directories
        2. Add all exports to index.ts in single commit
        3. Run TypeScript compilation check
        4. Push consolidated changes

    - path: "src/routes/DashboardPage.tsx"
      rule: "DO NOT ADD IMPORTS from incomplete agents"
      reason: "Central integration point - wait for all agents"
      agent_instruction: |
        If you need DashboardPage integration:
        1. Create your component in features/
        2. Add TODO comment in YOUR feature's README:
           <!-- TODO: Add to DashboardPage.tsx: import { MyWidget } from '@/features/myfeature' -->
        3. Do NOT modify DashboardPage.tsx directly

      coordinator_action: |
        After all agents in wave complete:
        1. Collect all integration TODOs
        2. Add all imports/components to DashboardPage.tsx
        3. Verify TypeScript compilation passes

  # Rules for agents working in parallel
  agent_protocols:
    during_parallel_execution:
      - rule: "DO NOT modify consolidation_files"
        check: "git diff --name-only | grep -E 'index.ts|DashboardPage.tsx'"
        action_if_match: "Revert changes, add TODO comment instead"

      - rule: "DO create integration TODOs"
        format: "// TODO: Add to {consolidation_file} - {what to add}"
        location: "In your feature's files or README"

      - rule: "DO report TODOs in completion message"
        message: "Completed #{issue}. Integration TODOs: {list of TODO locations}"

    coordinator_consolidation:
      - step: "Collect all TODOs"
        command: "grep -r 'TODO: Add to' src/features/"

      - step: "Apply all integrations"
        action: "Add exports to index.ts, imports to DashboardPage.tsx"

      - step: "Verify compilation"
        command: "pnpm tsc --noEmit"

      - step: "Commit consolidated changes"
        message: "chore: consolidate wave {wave_num} exports and integrations"

# HOW AGENTS USE THIS
agent_checklist:
  before_modifying_file:
    - question: "Is this file in parallel_coordination.consolidation_files?"
      if_yes: "STOP. Add TODO comment instead. Do NOT modify the file."

  before_reporting_completion:
    - question: "Did I create any integration TODOs?"
      if_yes: "Include TODO locations in completion message."
```

### Example Usage in GitHub Issues

```markdown
## Parallel Coordination Rules (ARCH-001)
⚠️ DO NOT MODIFY during parallel execution:
- `src/features/attendance/index.ts` (export barrel)
- `src/routes/DashboardPage.tsx` (integration point)

✅ INSTEAD, add TODO comments:
```typescript
// In your component file:
export function RealTimeAttendanceDashboard() {
  // your implementation
}

// TODO: Add to src/features/attendance/index.ts
// export { RealTimeAttendanceDashboard } from './components/RealTimeAttendanceDashboard'

// TODO: Add to src/routes/DashboardPage.tsx
// import { RealTimeAttendanceDashboard } from '@/features/attendance'
// <RealTimeAttendanceDashboard /> in manager section
```

Coordinator will consolidate ALL TODOs after wave completes.
```

### Test Hook

```typescript
// src/__tests__/contracts/parallel_coordination.test.ts
describe('Parallel Coordination Contract', () => {
  it('should not have uncommitted changes to consolidation files', () => {
    const output = execSync('git diff --name-only').toString()
    const consolidationFiles = [
      'src/features/*/index.ts',
      'src/routes/DashboardPage.tsx'
    ]

    consolidationFiles.forEach(pattern => {
      const matches = glob.sync(pattern).filter(f => output.includes(f))
      if (matches.length > 0) {
        throw new Error(
          `CONTRACT VIOLATION: Consolidation file modified during parallel execution: ${matches.join(', ')}\n` +
          `Add TODO comments instead. See parallel_coordination rules in feature_architecture.yml`
        )
      }
    })
  })

  it('should have TODO comments for integrations', () => {
    // Only check if in parallel execution mode
    if (!process.env.PARALLEL_WAVE) return

    const files = glob.sync('src/features/**/*.{ts,tsx}')
    let foundTodos = false

    files.forEach(file => {
      const content = fs.readFileSync(file, 'utf8')
      if (content.includes('TODO: Add to')) {
        foundTodos = true
      }
    })

    expect(foundTodos).toBe(true)
  })
})
```

---

## Summary: Impact on Failure Rate

| Issue | Root Cause | Extension Fix | Time Saved |
|-------|-----------|---------------|------------|
| #296 NFC UI | Used shadcn UI (doesn't exist) | **Extension 1: Anti-Patterns** | 30 min rewrite |
| #302 Paxton | Reported done but files missing | **Extension 2: Completion Verification** | 2-3 hr retry |
| Multiple | Premature exports to index.ts | **Extension 3: Parallel Coordination** | 20 min/wave |

**Before Extensions:** 11% failure rate (1/9 issues)
**After Extensions:** <5% expected (catches 90% of common failures)

**Net benefit:** 3-4 hours saved per 9-issue wave

---

## Implementation Steps

1. **Update CONTRACT-SCHEMA.md** - Add these 3 extensions to schema documentation
2. **Update feature_architecture.yml** - Add all 3 sections to existing contract
3. **Create test files** - Add contract tests for each extension
4. **Update GitHub issue template** - Include anti-patterns, verification checklist, coordination rules
5. **Update waves-controller agent** - Teach coordinator about consolidation protocol
6. **Update WAVE_EXECUTION_PROTOCOL.md** - Add consolidation phase after wave completion

---

## Extension Implementation Checklist

- [ ] Extension 1: Add `anti_patterns` section to feature contracts
- [ ] Extension 1: Create `anti_patterns.test.ts` contract test
- [ ] Extension 1: Update GitHub issue template with anti-patterns section
- [ ] Extension 2: Add `completion_verification` section to journey contracts
- [ ] Extension 2: Create `verify-agent-completion.ts` script
- [ ] Extension 2: Update agent prompts with verification checklist
- [ ] Extension 3: Add `parallel_coordination` section to feature contracts
- [ ] Extension 3: Create `parallel_coordination.test.ts` contract test
- [ ] Extension 3: Update waves-controller with consolidation phase
- [ ] All: Update CONTRACT-SCHEMA.md with new sections
- [ ] All: Update WAVE_EXECUTION_PROTOCOL.md with new phases
- [ ] All: Add examples to existing contracts (feature_architecture.yml)
