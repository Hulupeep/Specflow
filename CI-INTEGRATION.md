# Specflow CI/CD Integration Guide

> Integrate contract verification into your CI/CD pipeline

## Overview

This guide shows how to integrate Specflow contract tests into your CI/CD pipeline, ensuring that contract violations block merges and deployments.

---

## Prerequisites

- Contract tests created in `src/__tests__/contracts/`
- `npm test` runs contract tests
- CI/CD platform configured (GitHub Actions, GitLab CI, etc.)

---

## Integration Patterns

### Pattern 1: Include in Existing Test Suite

**Simplest approach** - Contract tests run as part of regular test suite.

**No changes needed if:**
- Your CI already runs `npm test`
- Contract tests are in `src/__tests__/contracts/`
- Test runner discovers them automatically

**Verify:**
```bash
# Check if contract tests are included
npm test -- --listTests 2>/dev/null | grep contracts
```

### Pattern 2: Separate Contract Check Step

**Recommended for visibility** - Explicit contract verification step in CI.

**Advantages:**
- Clear visibility when contracts fail
- Can run contracts before other tests (fail fast)
- Separate pass/fail status in CI dashboard

---

## GitHub Actions

### Basic Integration

```yaml
# .github/workflows/ci.yml
name: CI

on: [push, pull_request]

jobs:
  test:
    runs-on: ubuntu-latest

    steps:
      - uses: actions/checkout@v3

      - name: Setup Node.js
        uses: actions/setup-node@v3
        with:
          node-version: '18'

      - name: Install dependencies
        run: npm ci

      - name: Run tests
        run: npm test
        # This includes contract tests
```

### Explicit Contract Verification

```yaml
# .github/workflows/ci.yml
name: CI

on: [push, pull_request]

jobs:
  contracts:
    name: Verify Architectural Contracts
    runs-on: ubuntu-latest

    steps:
      - uses: actions/checkout@v3

      - name: Setup Node.js
        uses: actions/setup-node@v3
        with:
          node-version: '18'

      - name: Install dependencies
        run: npm ci

      - name: Check contract compliance
        run: node scripts/check-contracts.js

      - name: Run contract tests
        run: npm test -- src/__tests__/contracts/

  test:
    name: Run Full Test Suite
    runs-on: ubuntu-latest
    needs: contracts  # Only run if contracts pass

    steps:
      - uses: actions/checkout@v3

      - name: Setup Node.js
        uses: actions/setup-node@v3
        with:
          node-version: '18'

      - name: Install dependencies
        run: npm ci

      - name: Run all tests
        run: npm test

  build:
    name: Build Project
    runs-on: ubuntu-latest
    needs: [contracts, test]  # Only build if contracts and tests pass

    steps:
      - uses: actions/checkout@v3

      - name: Setup Node.js
        uses: actions/setup-node@v3
        with:
          node-version: '18'

      - name: Install dependencies
        run: npm ci

      - name: Build
        run: npm run build
```

### With Annotations

```yaml
- name: Run contract tests
  run: |
    npm test -- src/__tests__/contracts/ 2>&1 | tee contract-results.txt
    exit ${PIPESTATUS[0]}

- name: Annotate contract violations
  if: failure()
  run: |
    if grep -q "CONTRACT VIOLATION" contract-results.txt; then
      echo "::error::Contract violations found - see test output"
    fi
```

---

## GitLab CI

### Basic Integration

```yaml
# .gitlab-ci.yml
stages:
  - test
  - build

test:
  stage: test
  image: node:18
  script:
    - npm ci
    - npm test
  # Contract tests included in npm test
```

### Explicit Contract Verification

```yaml
# .gitlab-ci.yml
stages:
  - verify-contracts
  - test
  - build

verify-contracts:
  stage: verify-contracts
  image: node:18
  script:
    - npm ci
    - echo "Checking contract compliance..."
    - node scripts/check-contracts.js
    - echo "Running contract tests..."
    - npm test -- src/__tests__/contracts/
  rules:
    - if: '$CI_PIPELINE_SOURCE == "merge_request_event"'
    - if: '$CI_COMMIT_BRANCH == $CI_DEFAULT_BRANCH'

test:
  stage: test
  image: node:18
  needs: [verify-contracts]
  script:
    - npm ci
    - npm test

build:
  stage: build
  image: node:18
  needs: [test]
  script:
    - npm ci
    - npm run build
  artifacts:
    paths:
      - dist/
```

---

## Azure Pipelines

```yaml
# azure-pipelines.yml
trigger:
  - main
  - develop

pool:
  vmImage: 'ubuntu-latest'

stages:
  - stage: VerifyContracts
    displayName: 'Verify Architectural Contracts'
    jobs:
      - job: ContractCheck
        displayName: 'Run Contract Verification'
        steps:
          - task: NodeTool@0
            inputs:
              versionSpec: '18.x'
            displayName: 'Install Node.js'

          - script: npm ci
            displayName: 'Install dependencies'

          - script: node scripts/check-contracts.js
            displayName: 'Check contract compliance'

          - script: npm test -- src/__tests__/contracts/
            displayName: 'Run contract tests'

  - stage: Test
    displayName: 'Run Tests'
    dependsOn: VerifyContracts
    jobs:
      - job: UnitTests
        steps:
          - task: NodeTool@0
            inputs:
              versionSpec: '18.x'

          - script: npm ci
            displayName: 'Install dependencies'

          - script: npm test
            displayName: 'Run all tests'

  - stage: Build
    displayName: 'Build Application'
    dependsOn: Test
    jobs:
      - job: BuildJob
        steps:
          - task: NodeTool@0
            inputs:
              versionSpec: '18.x'

          - script: npm ci
            displayName: 'Install dependencies'

          - script: npm run build
            displayName: 'Build project'
```

---

## CircleCI

```yaml
# .circleci/config.yml
version: 2.1

jobs:
  verify-contracts:
    docker:
      - image: cimg/node:18.0
    steps:
      - checkout
      - restore_cache:
          keys:
            - v1-dependencies-{{ checksum "package-lock.json" }}
      - run:
          name: Install dependencies
          command: npm ci
      - save_cache:
          paths:
            - node_modules
          key: v1-dependencies-{{ checksum "package-lock.json" }}
      - run:
          name: Check contract compliance
          command: node scripts/check-contracts.js
      - run:
          name: Run contract tests
          command: npm test -- src/__tests__/contracts/

  test:
    docker:
      - image: cimg/node:18.0
    steps:
      - checkout
      - restore_cache:
          keys:
            - v1-dependencies-{{ checksum "package-lock.json" }}
      - run:
          name: Run tests
          command: npm test

  build:
    docker:
      - image: cimg/node:18.0
    steps:
      - checkout
      - restore_cache:
          keys:
            - v1-dependencies-{{ checksum "package-lock.json" }}
      - run:
          name: Build
          command: npm run build

workflows:
  version: 2
  test-and-build:
    jobs:
      - verify-contracts
      - test:
          requires:
            - verify-contracts
      - build:
          requires:
            - test
```

---

## Branch Protection Rules

### GitHub Branch Protection

```
Settings → Branches → Branch protection rules → main

Required:
✅ Require status checks to pass before merging
  ✅ verify-contracts (or your job name)
  ✅ test
✅ Require branches to be up to date before merging
```

### GitLab Protected Branches

```
Settings → Repository → Protected Branches → main

Allowed to merge:
- Developers + Maintainers
- Require approval: Yes
- Pipeline must succeed: Yes
```

---

## npm Scripts Integration

### Update package.json

```json
{
  "scripts": {
    "test": "jest",
    "test:contracts": "jest src/__tests__/contracts/",
    "check:contracts": "node scripts/check-contracts.js",
    "verify:contracts": "npm run check:contracts && npm run test:contracts",
    "pretest": "npm run check:contracts",
    "ci:verify": "npm run verify:contracts && npm run build"
  }
}
```

### CI uses npm scripts

```yaml
# Any CI platform
script:
  - npm ci
  - npm run ci:verify  # Runs contract check, tests, and build
```

**Advantage:** Changes to verification logic only need package.json update, not CI config.

---

## Caching Strategies

### Cache node_modules

**GitHub Actions:**
```yaml
- name: Cache dependencies
  uses: actions/cache@v3
  with:
    path: node_modules
    key: ${{ runner.os }}-node-${{ hashFiles('package-lock.json') }}
```

**GitLab CI:**
```yaml
cache:
  paths:
    - node_modules/
  key:
    files:
      - package-lock.json
```

### Don't Cache Contract Results

Contract tests MUST run on every commit - never cache test results.

---

## Parallel Execution

### Run contracts and tests in parallel

**GitHub Actions:**
```yaml
jobs:
  verify:
    strategy:
      matrix:
        check: [contracts, unit, integration]
    steps:
      - run: npm test -- ${{ matrix.check }}
```

**GitLab CI:**
```yaml
test:
  parallel:
    matrix:
      - TEST_SUITE: contracts
      - TEST_SUITE: unit
      - TEST_SUITE: integration
  script:
    - npm test -- $TEST_SUITE
```

---

## Failure Handling

### Contract Failure = Block Merge

```yaml
- name: Verify contracts
  run: npm run test:contracts
  # If this fails, workflow stops and PR is blocked
```

### Continue on Failure (for reporting only)

```yaml
- name: Verify contracts
  run: npm run test:contracts
  continue-on-error: false  # Default behavior
```

### Notify on Failure

**Slack notification:**
```yaml
- name: Notify Slack on contract failure
  if: failure()
  uses: slackapi/slack-github-action@v1
  with:
    payload: |
      {
        "text": "🚨 Contract violation in ${{ github.repository }}"
      }
```

---

## Performance Optimization

### Early Exit on Contract Failure

```yaml
jobs:
  contracts:
    runs-on: ubuntu-latest
    steps:
      - run: npm run test:contracts
    # If contracts fail, stop immediately

  expensive-tests:
    needs: contracts  # Only run if contracts pass
    runs-on: ubuntu-latest
    timeout-minutes: 30
    steps:
      - run: npm run test:integration
```

**Saves CI minutes** by not running expensive tests if contracts fail.

---

## Testing CI Configuration Locally

### GitHub Actions

```bash
# Install act
brew install act  # macOS
# or: curl https://raw.githubusercontent.com/nektos/act/master/install.sh | sudo bash

# Run workflows locally
act -j verify-contracts
```

### GitLab CI

```bash
# Install gitlab-runner
gitlab-runner exec docker verify-contracts
```

---

## Troubleshooting

### Issue: Contract tests not found

**Solution:**
```bash
# Verify test files exist
ls -la src/__tests__/contracts/

# Check test pattern
npm test -- --listTests | grep contracts
```

### Issue: Checker script fails in CI

**Solution:**
```yaml
# Add debugging
- run: |
    ls -la scripts/
    cat scripts/check-contracts.js
    node scripts/check-contracts.js
```

### Issue: Different results locally vs CI

**Solution:**
- Ensure same Node version
- Use `npm ci` not `npm install`
- Check for hardcoded paths

---

## Complete Example: Full CI Pipeline

```yaml
# .github/workflows/comprehensive-ci.yml
name: Comprehensive CI with Contracts

on:
  push:
    branches: [main, develop]
  pull_request:
    branches: [main, develop]

jobs:
  verify-contracts:
    name: 🔒 Verify Architectural Contracts
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v3

      - name: Setup Node.js
        uses: actions/setup-node@v3
        with:
          node-version: '18'
          cache: 'npm'

      - name: Install dependencies
        run: npm ci

      - name: Check contract compliance
        run: |
          echo "Checking if protected files comply with contracts..."
          node scripts/check-contracts.js

      - name: Run contract verification tests
        run: |
          echo "Running contract tests..."
          npm test -- src/__tests__/contracts/ --coverage

      - name: Upload contract test results
        if: always()
        uses: actions/upload-artifact@v3
        with:
          name: contract-test-results
          path: coverage/

  lint:
    name: 🎨 Lint
    runs-on: ubuntu-latest
    needs: verify-contracts
    steps:
      - uses: actions/checkout@v3
      - uses: actions/setup-node@v3
        with:
          node-version: '18'
          cache: 'npm'
      - run: npm ci
      - run: npm run lint

  test:
    name: 🧪 Test
    runs-on: ubuntu-latest
    needs: verify-contracts
    steps:
      - uses: actions/checkout@v3
      - uses: actions/setup-node@v3
        with:
          node-version: '18'
          cache: 'npm'
      - run: npm ci
      - run: npm test

  build:
    name: 🏗️  Build
    runs-on: ubuntu-latest
    needs: [verify-contracts, lint, test]
    steps:
      - uses: actions/checkout@v3
      - uses: actions/setup-node@v3
        with:
          node-version: '18'
          cache: 'npm'
      - run: npm ci
      - run: npm run build

      - name: Upload build artifacts
        uses: actions/upload-artifact@v3
        with:
          name: build
          path: dist/
```

---

## Summary

**Minimum Integration:**
```yaml
- run: npm test  # Includes contract tests
```

**Recommended Integration:**
```yaml
- run: node scripts/check-contracts.js
- run: npm test -- src/__tests__/contracts/
- run: npm test  # Full test suite
- run: npm run build
```

**Advanced Integration:**
- Separate contract verification job
- Parallel execution
- Early exit on failure
- Slack/email notifications
- Branch protection rules

**Key Principle:** Contract violations must BLOCK merges, not just warn.
