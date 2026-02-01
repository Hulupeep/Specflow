# Specflow Frontier Improvements - Timebreez Learnings

**Date:** 2026-02-01
**Source Project:** Timebreez (childcare scheduling platform)
**Status:** Production-tested across 30 waves, 280+ issues

---

## Overview

This document captures production-tested improvements to the Specflow methodology developed during the Timebreez project. These enhancements transform Specflow from a specification framework into a **complete platform engineering capability** with CI/CD integration, automated quality gates, and autonomous wave execution.

**Key Achievements:**
- ✅ 280+ GitHub issues executed via wave-based orchestration
- ✅ 0 critical E2E anti-patterns (down from 117)
- ✅ CI gate blocks PRs with test quality violations
- ✅ Autonomous wave controller orchestrates 8-phase execution
- ✅ 18 specialized agents for end-to-end delivery

---

## Table of Contents

1. [Quality Contract System](#1-quality-contract-system)
2. [Wave Execution Framework](#2-wave-execution-framework)
3. [Agent Orchestration Library](#3-agent-orchestration-library)
4. [CI/CD Integration Patterns](#4-cicd-integration-patterns)
5. [Project Configuration Enhancements](#5-project-configuration-enhancements)
6. [Extraction Checklist](#extraction-checklist)

---

## 1. Quality Contract System

### 1.1 E2E Test Quality Contract

**File:** `docs/contracts/quality_e2e_test_standards.yml`

**Purpose:** Enforce E2E test quality to prevent silent test passes when features break.

**Non-Negotiable Rules:**

#### QUALITY-001: No Silent Failures
```yaml
FORBIDDEN:
  - .catch(() => false)  # Masks broken features
  - isVisible().catch(() => false)  # Hides UI regressions
  - try { ... } catch { test.skip() }  # Defers indefinitely

REQUIRED:
  - await expect(element).toBeVisible()  # Fails loudly
  - Proper assertions with explicit timeouts
```

#### QUALITY-002: Explicit Test Skipping
```yaml
FORBIDDEN:
  - test.skip(true, 'Not implemented')  # Permanent skip

REQUIRED:
  - test.fixme('Blocked by #XXX - description')  # Trackable blocker
```

#### QUALITY-003: No Arbitrary Timeouts
```yaml
FORBIDDEN:
  - await page.waitForTimeout(5000)  # Flaky, hides issues

REQUIRED:
  - await expect(element).toBeVisible({ timeout: 5000 })
```

#### QUALITY-004: CI Gate Enforcement
```yaml
REQUIRED:
  - scripts/check-test-antipatterns.sh runs before E2E tests
  - Exit code 1 on critical patterns → PR blocked
```

**Impact:**
- Before: 117 anti-patterns causing silent passes
- After: 0 critical anti-patterns, tests fail loudly
- CI stays accurate: green = working, red = broken

### 1.2 Anti-Pattern Checker Script

**File:** `scripts/check-test-antipatterns.sh`

**Usage:**
```bash
bash scripts/check-test-antipatterns.sh
# Exit 0 = pass, Exit 1 = critical patterns found
```

**Pattern Detection:**
```bash
# Critical patterns
grep -r "\.catch(() => false)" tests/e2e/
grep -r "isVisible()\.catch" tests/e2e/
grep -r "test\.skip(true" tests/e2e/

# High severity
grep -r "waitForTimeout([0-9]" tests/e2e/

# Medium severity
grep -r "count() === 0.*test\.skip" tests/e2e/
```

**Output Format:**
```
=== SUMMARY ===
Critical anti-patterns: 0 ✅
High severity issues:   0 ✅
Medium severity issues: 0 ✅

✅ PASSED: No critical anti-patterns detected.
```

### 1.3 Implementation Guide

**File:** `docs/testing/E2E_ANTI_PATTERN_FIX_GUIDE.md`

**Fix Patterns:**

**Pattern A - Feature Implemented:**
```typescript
// Before (anti-pattern)
const isVisible = await element.isVisible({ timeout: 5000 }).catch(() => false)
if (!isVisible) {
  test.skip(true, 'Not implemented')
  return
}

// After (proper assertion)
await expect(element).toBeVisible({ timeout: 5000 })
```

**Pattern B - Feature Blocked:**
```typescript
// Before
if (!await btn.isVisible().catch(() => false)) {
  test.skip(true, 'Not implemented')
  return
}

// After
test.fixme('Blocked by #113 - UI not yet implemented')
```

**Pattern D - Browser API Limitation:**
```typescript
test.fixme('PWA install prompt requires beforeinstallprompt browser event - cannot trigger in Playwright')

// Alternative: Test UI components without browser event
test('PWA install UI components exist', async ({ page }) => {
  await page.evaluate(() => {
    window.dispatchEvent(new Event('show-pwa-prompt'))
  })
  await expect(page.getByTestId('pwa-prompt')).toBeVisible()
})
```

---

## 2. Wave Execution Framework

### 2.1 Wave Execution Protocol

**File:** `docs/WAVE_EXECUTION_PROTOCOL.md`

**Phases:**

```
Phase 1: DISCOVERY, PRIORITY & WAVE CALCULATION
  - Fetch ALL open GitHub issues
  - Parse dependencies ("Depends on #XXX", "Blocks #YYY")
  - Build dependency graph
  - Calculate waves (Wave 1 = 0 dependencies, Wave 2 = blocked by Wave 1, etc.)
  - Priority scoring:
    score = label_weight + (blocker_count * 2) + context_bonus + risk_factor

    Label weights:
      critical=10, priority-high=7, priority-medium=5, priority-low=3

    Context bonus:
      +5 if related to recent commits (shares files/features)

    Risk factor:
      +3 for DB migrations, +2 for edge functions

  - Sort each wave by priority score (high → low)
  - Output ASCII dependency graph + wave assignments
  - User approval before execution

Phase 2: CONTRACT GENERATION (per wave)
  - Spawn specflow-writer agents (parallel, one per issue)
  - Generate docs/contracts/feature_*.yml
  - Include: rules, Gherkin, data-testid, API contracts

Phase 3: CONTRACT AUDIT
  - Spawn contract-validator agents (parallel)
  - Run: npm test -- contracts
  - STOP if violations found

Phase 4: IMPLEMENTATION (parallel within wave, ordered by priority)
  - Spawn migration-builder (if DB changes)
  - Spawn edge-function-builder (if functions)
  - Implement frontend (components, hooks, repos)
  - If issue fails: pause that issue, continue others, move to next wave

Phase 5: PLAYWRIGHT GENERATION
  - Spawn playwright-from-specflow (parallel)
  - Generate tests/e2e/*.spec.ts
  - Spawn journey-tester (cross-feature flows)

Phase 6: TEST EXECUTION
  - Run: npm run build (STOP if fails)
  - Run: npm test -- contracts
  - Run: npm run test:e2e
  - Spawn journey-enforcer (coverage check)
  - If tests fail: fix and re-run Phase 6

Phase 7: ISSUE CLOSURE
  - Spawn ticket-closer (parallel)
  - Verify DOD checklist
  - Close with commit SHA + test results

Phase 8: WAVE COMPLETION REPORT
  - Generate ASCII report
  - List: issues closed, contracts, tests, commits
  - Output: journey coverage %
  - If more waves: GO TO Phase 2
```

**Parallel Execution Rules:**
- Phase 1: Sequential (builds graph)
- Phases 2, 3, 5, 7: All agents in ONE message (parallel within wave)
- Phase 4: Parallel within wave, priority-ordered
- Phases 6, 8: Sequential (testing, reporting)

**Stop Conditions:**
- Contract conflict → Fix first
- Build error → Fix first
- Contract test fail → Fix first
- E2E test fail → Fix first

### 2.2 Invocation Guide

**File:** `docs/promptright.md`

**Simple Invocation:**
```
Execute waves
```

That's it! The waves-controller agent:
- Reads WAVE_EXECUTION_PROTOCOL.md
- Analyzes all open issues
- Calculates dependency waves + priorities
- Spawns all subagents
- Executes all 8 phases
- Reports progress
- Closes issues

**Advanced Invocations:**
```
Execute waves for milestone "v1.0"
Execute waves for label "priority-high"
Execute waves (resumes from failure)
```

### 2.3 Waves Controller Agent

**File:** `scripts/agents/waves-controller.md`

**Capabilities:**
- Autonomous orchestration of complete wave execution
- Dependency graph calculation
- Priority scoring based on labels + context + blockers
- Parallel agent spawning (ONE message pattern)
- Error handling with wave re-assignment
- Progress reporting

**Trigger:** User says "Execute waves"

**Output:** ASCII dependency graph + wave-by-wave execution + final report

---

## 3. Agent Orchestration Library

### 3.1 Agent Registry (18 Agents)

**Source:** `scripts/agents/*.md`

| Agent | Purpose | Phase |
|-------|---------|-------|
| `waves-controller` | Orchestrates complete wave execution | Entry Point |
| `specflow-writer` | Generates feature contracts with Gherkin | Phase 2 |
| `contract-validator` | Verifies implementation matches spec | Phase 3 |
| `migration-builder` | Creates Supabase migrations | Phase 4 |
| `edge-function-builder` | Creates Supabase Edge Functions | Phase 4 |
| `playwright-from-specflow` | Generates E2E tests from Gherkin | Phase 5 |
| `journey-tester` | Creates cross-feature journey tests | Phase 5 |
| `journey-enforcer` | Verifies journey coverage, release readiness | Phase 6 |
| `e2e-test-auditor` | Audits E2E test quality | Phase 6 |
| `ticket-closer` | Updates and closes GitHub issues | Phase 7 |
| `contract-generator` | Generates YAML contracts | Utility |
| `contract-test-generator` | Generates contract enforcement tests | Utility |
| `board-auditor` | Analyzes GitHub project board | Utility |
| `dependency-mapper` | Maps issue dependencies | Utility |
| `frontend-builder` | Builds React components | Utility |
| `specflow-uplifter` | Upgrades old specs to new format | Utility |
| `sprint-executor` | Executes sprint planning | Utility |
| `README.md` | Agent library documentation | - |
| `WORKFLOW.md` | Agent workflow patterns | - |

### 3.2 Auto-Trigger Rules

**Source:** `CLAUDE.md` (Auto-trigger rule section)

```markdown
### Auto-Trigger Rules

**MUST use these agents automatically when the trigger matches:**

1. **User asks to implement a feature from a GitHub issue:**
   - Run `contract-validator` FIRST
   - Run `migration-builder` if DB changes needed
   - Run `edge-function-builder` if Edge Function needed
   - Run `test-runner` after implementation
   - Run `ticket-closer` AFTER implementation

2. **User asks to "write tests" or "create tests":**
   - Check if Specflow scenarios exist
   - If yes: run `playwright-from-specflow`
   - If journeys involved: run `journey-tester`

3. **User asks to "create tickets", "write stories":**
   - Run `specflow-writer` to generate Gherkin + create issues

4. **User asks to "close tickets", "update issues":**
   - Run `ticket-closer` to map commits to issues

5. **User asks to "validate" or "check implementation":**
   - Run `contract-validator` against GitHub issues

6. **User asks to "run tests", "check tests":**
   - Run `test-runner` to execute tests and report

7. **After ANY code changes (MANDATORY):**
   - Run `test-runner` to execute tests
   - Run `journey-enforcer` to verify coverage
   - Do NOT mark work complete if tests fail

8. **User asks to "execute waves", "run waves":**
   - Run `waves-controller` agent
   - Analyzes ALL open issues
   - Calculates waves with priority scoring
   - Spawns subagents, handles all 8 phases
```

### 3.3 Orchestration Pipeline

```
specflow-writer → (creates GitHub issues with Gherkin)
       ↓
migration-builder + edge-function-builder → (backend)
       ↓
[manual frontend implementation]
       ↓
contract-validator → (verifies spec compliance)
       ↓
playwright-from-specflow → (generates e2e tests)
       ↓
journey-tester → (cross-feature integration)
       ↓
test-runner → (executes tests, reports failures)
       ↓
journey-enforcer → (verifies coverage, release readiness)
       ↓
ticket-closer → (updates and closes GitHub issues)
```

### 3.4 Test Execution Gate

**Mandatory gate before marking work complete:**

```
implementation complete → test-runner → journey-enforcer → ticket-closer
                              ↓              ↓
                         if failures    if missing coverage
                              ↓              ↓
                         FIX FIRST      ADD JOURNEYS
```

**Work is NOT complete until:**
- [ ] `pnpm test -- contracts` passes
- [ ] `pnpm test:e2e` passes (or only non-critical journeys fail)
- [ ] `journey-enforcer` confirms coverage exists

---

## 4. CI/CD Integration Patterns

### 4.1 GitHub Actions E2E Quality Gate

**File:** `.github/workflows/ci.yml` (E2E tests job)

```yaml
e2e-tests:
  name: E2E Tests (Chromium)
  runs-on: ubuntu-latest
  timeout-minutes: 20

  env:
    VITE_SUPABASE_URL: ${{ secrets.VITE_SUPABASE_URL || 'https://test.supabase.co' }}
    VITE_SUPABASE_ANON_KEY: ${{ secrets.VITE_SUPABASE_ANON_KEY || 'test-anon-key' }}

  steps:
    - uses: actions/checkout@v4

    - uses: pnpm/action-setup@v3
      with:
        version: 9

    - uses: actions/setup-node@v4
      with:
        node-version: ${{ env.NODE_VERSION }}
        cache: 'pnpm'

    - name: Install dependencies
      run: pnpm install --frozen-lockfile

    - name: Install Playwright browsers
      run: pnpm exec playwright install --with-deps chromium

    # ⚡ CRITICAL GATE: Anti-pattern check BEFORE tests
    - name: Check for E2E test anti-patterns
      run: |
        echo "🔍 Checking for E2E test anti-patterns..."
        bash scripts/check-test-antipatterns.sh
        if [ $? -ne 0 ]; then
          echo "❌ FAILED: E2E anti-patterns detected"
          echo "📖 See fix guide: docs/testing/E2E_ANTI_PATTERN_FIX_GUIDE.md"
          echo "📋 Quality contract: docs/contracts/quality_e2e_test_standards.yml"
          exit 1
        fi
        echo "✅ PASSED: No critical anti-patterns detected"

    - name: Run Playwright tests
      run: pnpm test:e2e

    - name: Upload test results
      if: always()
      uses: actions/upload-artifact@v4
      with:
        name: playwright-report
        path: playwright-report/
        retention-days: 7

    - name: Upload test artifacts (traces/videos)
      if: failure()
      uses: actions/upload-artifact@v4
      with:
        name: playwright-artifacts
        path: test-results/
        retention-days: 7
```

**Key Pattern:**
1. Anti-pattern checker runs BEFORE E2E tests
2. If checker fails (exit 1) → CI fails → PR blocked
3. Clear error messages guide developer to fix guide
4. Only run expensive E2E tests if quality gate passes

### 4.2 Anti-Pattern Checker Script

**File:** `scripts/check-test-antipatterns.sh`

```bash
#!/bin/bash
# E2E Test Anti-Pattern Checker
# Purpose: Detect patterns that cause silent test passes
# Contract: docs/contracts/quality_e2e_test_standards.yml

set -e

TEST_DIR="tests/e2e"
CRITICAL_COUNT=0
HIGH_COUNT=0
MEDIUM_COUNT=0

echo "🔍 Scanning E2E tests for anti-patterns..."
echo ""

# ============================================================================
# CRITICAL PATTERNS (Block PR merge)
# ============================================================================

echo "=== CRITICAL ANTI-PATTERNS ==="
echo ""

# CRITICAL: .catch(() => false) - Masks broken features
echo "Checking for .catch(() => false) pattern..."
if grep -r "\.catch(() => false)" "$TEST_DIR" --include="*.spec.ts"; then
  CRITICAL_COUNT=$((CRITICAL_COUNT + $(grep -r "\.catch(() => false)" "$TEST_DIR" --include="*.spec.ts" | wc -l)))
  echo "❌ Found .catch(() => false) - FORBIDDEN (QUALITY-001)"
else
  echo "✅ No .catch(() => false) found"
fi
echo ""

# CRITICAL: isVisible().catch() - Hides UI regressions
echo "Checking for isVisible().catch() pattern..."
if grep -r "isVisible()\.catch" "$TEST_DIR" --include="*.spec.ts"; then
  CRITICAL_COUNT=$((CRITICAL_COUNT + $(grep -r "isVisible()\.catch" "$TEST_DIR" --include="*.spec.ts" | wc -l)))
  echo "❌ Found isVisible().catch() - FORBIDDEN (QUALITY-001)"
else
  echo "✅ No isVisible().catch() found"
fi
echo ""

# CRITICAL: test.skip(true, ...) - Permanent skip
echo "Checking for test.skip(true, ...) pattern..."
if grep -r "test\.skip(true" "$TEST_DIR" --include="*.spec.ts"; then
  CRITICAL_COUNT=$((CRITICAL_COUNT + $(grep -r "test\.skip(true" "$TEST_DIR" --include="*.spec.ts" | wc -l)))
  echo "❌ Found test.skip(true, ...) - Use test.fixme() instead (QUALITY-002)"
else
  echo "✅ No test.skip(true) found"
fi
echo ""

# ============================================================================
# HIGH SEVERITY PATTERNS (Warn but don't block)
# ============================================================================

echo "=== HIGH SEVERITY ISSUES ==="
echo ""

# HIGH: waitForTimeout() without comment
echo "Checking for waitForTimeout() without animation comment..."
if grep -r "waitForTimeout([0-9]" "$TEST_DIR" --include="*.spec.ts" | grep -v "animation" | grep -v "Wait for"; then
  HIGH_COUNT=$((HIGH_COUNT + $(grep -r "waitForTimeout([0-9]" "$TEST_DIR" --include="*.spec.ts" | grep -v "animation" | grep -v "Wait for" | wc -l || echo 0)))
  echo "⚠️  Found waitForTimeout() - Use expect().toBeVisible() instead (QUALITY-003)"
else
  echo "✅ No problematic waitForTimeout() found"
fi
echo ""

# ============================================================================
# SUMMARY
# ============================================================================

echo ""
echo "=== SUMMARY ==="
echo "Critical anti-patterns: $CRITICAL_COUNT"
echo "High severity issues:   $HIGH_COUNT"
echo "Medium severity issues: $MEDIUM_COUNT"
echo ""

if [ $CRITICAL_COUNT -gt 0 ]; then
  echo "❌ FAILED: $CRITICAL_COUNT critical anti-patterns detected."
  echo ""
  echo "📖 See fix guide: docs/testing/E2E_ANTI_PATTERN_FIX_GUIDE.md"
  echo "📋 Quality contract: docs/contracts/quality_e2e_test_standards.yml"
  echo ""
  exit 1
else
  echo "✅ PASSED: No critical anti-patterns detected."
  if [ $HIGH_COUNT -gt 0 ] || [ $MEDIUM_COUNT -gt 0 ]; then
    echo "⚠️  WARNING: $HIGH_COUNT high + $MEDIUM_COUNT medium severity issues found."
    echo "   Consider fixing these to improve test reliability."
  fi
  exit 0
fi
```

**Usage in CI:**
```yaml
- name: Check for E2E test anti-patterns
  run: bash scripts/check-test-antipatterns.sh
```

**Exit codes:**
- `0` = Pass (no critical patterns)
- `1` = Fail (critical patterns found, block PR)

---

## 5. Project Configuration Enhancements

### 5.1 CLAUDE.md Structure

**Key sections to add to any project's CLAUDE.md:**

```markdown
## Subagent Library

### How It Works

Reusable agent prompts live in `scripts/agents/*.md`. When spawning a subagent, **read the agent prompt file first**, then pass its content as context.

**Invocation pattern:**
\`\`\`
1. Read scripts/agents/{agent-name}.md
2. Task(description, "{agent prompt}\\n\\n---\\n\\nTASK: {what to do}", "general-purpose")
\`\`\`

### Agent Registry

| Agent | Prompt File | When to Use |
|-------|------------|-------------|
| `specflow-writer` | `scripts/agents/specflow-writer.md` | New feature needs acceptance criteria |
| `playwright-from-specflow` | `scripts/agents/playwright-from-specflow.md` | Specflow scenarios → Playwright tests |
| `ticket-closer` | `scripts/agents/ticket-closer.md` | Update and close GitHub issues |
| `migration-builder` | `scripts/agents/migration-builder.md` | Feature needs database changes |
| `journey-enforcer` | `scripts/agents/journey-enforcer.md` | Verify journey coverage |
| `waves-controller` | `scripts/agents/waves-controller.md` | **Orchestrate complete wave execution** |

### Auto-Trigger Rules

**MUST use these agents automatically when the trigger matches:**

1. **User asks to implement a feature from a GitHub issue:**
   - Run `contract-validator` FIRST
   - Run `migration-builder` if DB changes needed
   - Run `test-runner` after implementation
   - Run `ticket-closer` AFTER implementation

2. **User asks to "execute waves", "run waves":**
   - Run `waves-controller` agent
   - Analyzes ALL open issues, calculates waves, executes

### Test Execution Gate (MANDATORY)

**Claude MUST run tests before marking ANY work complete:**

\`\`\`
implementation → test-runner → journey-enforcer → ticket-closer
                      ↓              ↓
                 if failures    if missing coverage
                      ↓              ↓
                 FIX FIRST      ADD JOURNEYS
\`\`\`

**Work is NOT complete until:**
- [ ] Contract tests pass
- [ ] E2E tests pass (or only non-critical fail)
- [ ] journey-enforcer confirms coverage
\`\`\`

### 5.2 Quality Contract Template

**File to create:** `docs/contracts/quality_e2e_test_standards.yml`

```yaml
# Quality Contract: E2E Test Standards

contract_id: QUALITY-001
contract_type: quality
status: active
priority: P0-blocking
created: <date>
updated: <date>
author: waves-controller
version: 1.0

## Purpose
Enforce E2E test quality standards to prevent silent test passes.

## Scope
- All Playwright E2E tests in `tests/e2e/**/*.spec.ts`
- CI/CD pipeline gates
- PR merge requirements

## Non-Negotiable Rules

### QUALITY-001: No Silent Failures
**Rule:** E2E tests MUST fail when features are broken.

**Enforcement:**
- FORBIDDEN: `.catch(() => false)`
- FORBIDDEN: `isVisible().catch(() => false)`
- FORBIDDEN: `try { ... } catch { test.skip() }`
- REQUIRED: Proper `expect()` assertions with explicit timeouts

**Compliant Example:**
```typescript
await expect(element).toBeVisible({ timeout: 5000 })
```

### QUALITY-002: Explicit Test Skipping
**Rule:** Tests that cannot run MUST use `test.fixme()` with issue reference.

**Enforcement:**
- FORBIDDEN: `test.skip(true, 'Not implemented')`
- REQUIRED: `test.fixme('Blocked by #XXX - description')`

### QUALITY-003: No Arbitrary Timeouts
**Rule:** Tests MUST NOT use `waitForTimeout()` for synchronization.

**Enforcement:**
- FORBIDDEN: `await page.waitForTimeout(5000)`
- REQUIRED: `await expect(element).toBeVisible({ timeout: 5000 })`

### QUALITY-004: CI Gate Enforcement
**Rule:** PRs MUST NOT merge if anti-patterns are detected.

**Enforcement:**
- CI step: `bash scripts/check-test-antipatterns.sh`
- Exit code 1 if critical patterns found

## Gherkin Scenarios

### Scenario: Anti-Pattern Detection
```gherkin
Given E2E tests exist with anti-patterns
When I run "bash scripts/check-test-antipatterns.sh"
Then I see output: "Critical anti-patterns: X"
And exit code is 1
```

### Scenario: Test Fails When Feature Broken
```gherkin
Given an E2E test uses proper "expect().toBeVisible()" assertion
When the tested element is removed from the UI
And I run the E2E test suite
Then the test FAILS with error: "Element not found"
And I see a screenshot of the failure
And the CI build is RED
```

## Compliance Checklist

Before merging any E2E test changes:
- [ ] No `.catch(() => false)` patterns
- [ ] No `isVisible().catch(() => false)` patterns
- [ ] No permanent `test.skip(true, ...)`
- [ ] All skipped tests use `test.fixme()` with issue reference
- [ ] No `waitForTimeout()` except documented animations
- [ ] `bash scripts/check-test-antipatterns.sh` returns 0
- [ ] CI gate configured in `.github/workflows/`
```

---

## Extraction Checklist

### For Any New Project Using Specflow

**Core Files to Copy:**

#### 1. Quality Contract System
- [ ] `docs/contracts/quality_e2e_test_standards.yml`
- [ ] `docs/testing/E2E_ANTI_PATTERN_FIX_GUIDE.md`
- [ ] `scripts/check-test-antipatterns.sh`

#### 2. Wave Execution Framework
- [ ] `docs/WAVE_EXECUTION_PROTOCOL.md`
- [ ] `docs/promptright.md`
- [ ] `scripts/agents/waves-controller.md`

#### 3. Agent Library (Essential 10)
- [ ] `scripts/agents/README.md`
- [ ] `scripts/agents/WORKFLOW.md`
- [ ] `scripts/agents/specflow-writer.md`
- [ ] `scripts/agents/contract-validator.md`
- [ ] `scripts/agents/migration-builder.md`
- [ ] `scripts/agents/playwright-from-specflow.md`
- [ ] `scripts/agents/journey-tester.md`
- [ ] `scripts/agents/journey-enforcer.md`
- [ ] `scripts/agents/e2e-test-auditor.md`
- [ ] `scripts/agents/ticket-closer.md`

#### 4. CI/CD Integration
- [ ] `.github/workflows/ci.yml` (E2E quality gate step)
- [ ] `scripts/check-test-antipatterns.sh`

#### 5. Project Configuration
- [ ] `CLAUDE.md` sections:
  - [ ] Subagent Library section
  - [ ] Auto-Trigger Rules section
  - [ ] Test Execution Gate section
  - [ ] Agent Registry table

**Adaptation Steps:**

1. **Update agent prompts:**
   - Replace "Timebreez" with your project name
   - Replace "Supabase" references if using different backend
   - Update domain knowledge section with your entities

2. **Customize quality contract:**
   - Add project-specific anti-patterns
   - Update file paths for your test directory
   - Adjust CI gate to your CI/CD platform

3. **Configure wave execution:**
   - Update GitHub org/repo in waves-controller.md
   - Adjust priority scoring for your label scheme
   - Add project-specific risk factors

4. **Integrate CI gate:**
   - Add anti-pattern check to your CI pipeline
   - Adjust timeouts and retry logic
   - Configure artifact retention

5. **Update CLAUDE.md:**
   - Copy auto-trigger rules
   - Add agent registry table
   - Document test execution gate

---

## Success Metrics

**Projects using these improvements should achieve:**

- ✅ 0 critical E2E anti-patterns
- ✅ CI blocks PRs with test quality violations
- ✅ Autonomous wave execution (user says "Execute waves")
- ✅ Test failures accurately reflect broken features (no silent passes)
- ✅ Clear separation: green CI = working, red CI = broken
- ✅ Reduced manual oversight (agents orchestrate end-to-end)

---

## References

- **Source Project:** Timebreez (github.com/Hulupeep/timebreez)
- **Issue #277:** E2E Anti-Pattern Cleanup (117 → 0 patterns)
- **Wave Execution:** 30 waves, 280+ issues
- **Specflow Docs:** `Specflow/` folder in this repo

---

**Created:** 2026-02-01
**Author:** Waves Controller Agent
**Status:** Production-Tested

