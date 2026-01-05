# chat2repo - Development Guide

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## CRITICAL: Architectural Contracts - READ THIS FIRST

### MANDATORY: Check Contracts Before ANY Code Changes

This project uses **architectural contracts** (YAML files in `contracts/`) that define **non-negotiable rules**. These contracts are enforced by automated tests.

**BEFORE modifying ANY protected file, you MUST:**
1. Read the relevant contract in `contracts/`
2. Run the contract verification tests
3. Check the compliance checklist in the contract
4. Only proceed if the change is allowed

### Files Protected by Contracts

| Files | Contract |
|-------|----------|
| `packages/core/**/*.ts` | `contracts/feature_architecture.yml` (ARCH-001) |
| `packages/extension/src/content/**/*` | `contracts/feature_architecture.yml` (ARCH-002) |
| `packages/extension/src/popup/**/*` | `contracts/feature_architecture.yml` (ARCH-002) |
| `packages/extension/src/background/**/*` | `contracts/feature_security.yml` (SEC-001), `contracts/feature_mv3.yml` |
| `packages/extension/manifest.json` | `contracts/feature_security.yml` (SEC-003), `contracts/feature_mv3.yml` |
| `packages/core/src/markdownBuilder.ts` | `contracts/feature_markdown.yml` |
| `packages/extension/src/content/chatgpt*.ts` | `contracts/feature_ux.yml` (UX-003, ERR-002) |

### How to Check Contracts

```bash
# Run all contract tests
npm test

# Run contract tests only
npm run test:contracts

# Read a specific contract
cat contracts/feature_architecture.yml
```

### Contract Violation Example

If you try to add `chrome.storage` to `packages/core/`:
```
CONTRACT VIOLATION: ARCH-001
File: packages/core/src/storage.ts:15
Issue: Browser API not allowed in core package
Pattern: chrome.storage

See: contracts/feature_architecture.yml
```

The build will FAIL and the PR will be BLOCKED.

### Overriding Contracts

**Only the human user can override non-negotiable rules.**

To override, user must explicitly say:
```
override_contract: feature_architecture
```

Then you may proceed, but should:
1. Explain why this violates the contract
2. Warn about potential consequences
3. Ask if contract should be updated permanently

---

## Active Contracts

### 1. `feature_architecture.yml`
**Protects:** Package boundaries, layering, module size
**Rules:** 3 non-negotiable rules
**Key rules:**
- `ARCH-001`: Core package must be pure TypeScript (no browser APIs)
- `ARCH-002`: GitHub API calls only from background service worker
- `ARCH-003`: Files < 200 lines, functions < 80 lines

### 2. `feature_security.yml`
**Protects:** PAT storage, secret handling, permissions
**Rules:** 3 non-negotiable rules
**Key rules:**
- `SEC-001`: PAT stored in chrome.storage.local, background only
- `SEC-002`: PAT never logged, never sent to content scripts
- `SEC-003`: host_permissions limited to specific domains

### 3. `feature_mv3.yml`
**Protects:** MV3 compatibility
**Rules:** 2 non-negotiable rules
**Key rules:**
- `MV3-001`: Background must be service worker, not persistent
- `MV3-002`: No setInterval or global mutable state in background

### 4. `feature_markdown.yml`
**Protects:** Front-matter schema stability
**Rules:** 3 non-negotiable rules
**Key rules:**
- `MD-001`: Required fields: source, captured_at, tags
- `MD-002`: Schema is additive only, no breaking changes
- `MD-003`: tags field always present as array

### 5. `feature_ux.yml`
**Protects:** User flows, error handling
**Rules:** 5 non-negotiable rules
**Key rules:**
- `UX-001`: Unconfigured state shows toast, not modal
- `UX-002`: Quick send has no modal, only toast
- `UX-003`: Buttons only on assistant messages
- `ERR-001`: GitHub errors are user-friendly, no PAT exposure
- `ERR-002`: Empty content triggers fallback, no API call

---

## Project Overview

Chrome extension (MV3) to send selected text or ChatGPT messages to a GitHub repo as Markdown notes with YAML front-matter.

### Architecture

```
packages/
├── core/           # Pure TypeScript (NO browser APIs)
│   ├── types.ts
│   ├── pathUtils.ts
│   ├── markdownBuilder.ts
│   ├── githubClient.ts
│   └── captureOrchestrator.ts
│
└── extension/      # Chrome MV3 extension
    ├── manifest.json
    ├── background/     # Service worker - ONLY place for GitHub API calls
    ├── content/        # ChatGPT integration - NO direct API calls
    ├── popup/          # Extension popup - NO direct API calls
    └── options/        # Settings page
```

### Key Invariants

1. **Core is pure** - No `chrome.*`, `browser.*`, or WebExtension APIs in `packages/core/`
2. **Background owns secrets** - PAT never leaves background service worker
3. **Content scripts delegate** - Use `chrome.runtime.sendMessage` for all actions
4. **Schema is stable** - Front-matter fields cannot be removed or change type

---

## Commands

```bash
# Install dependencies
npm install

# Run all tests
npm test

# Run contract tests only
npm run test:contracts

# Build extension
npm run build

# Development mode
npm run dev
```

---

## LLM Workflow

### Before ANY code change:

1. **Check:** Is file protected by a contract?
   ```bash
   # Look for file path in contracts
   grep -r "packages/core" contracts/
   ```

2. **Read:** The relevant contract YAML
   ```bash
   cat contracts/feature_architecture.yml
   ```

3. **Check:** Compliance checklist in contract

4. **Implement:** Following contract rules

5. **Verify:** Run contract tests
   ```bash
   npm run test:contracts
   ```

### When implementing features:

```
Spec → Contract → Test → Code → Verify
```

### When refactoring:

```
Baseline tests → Change → Test → Fix if broken
```

---

## Documentation

- **Core Docs (Specflow):**
  - `../CONTRACTS-README.md` - System overview
  - `../SPEC-FORMAT.md` - How to write specs
  - `../CONTRACT-SCHEMA.md` - YAML format
  - `../LLM-MASTER-PROMPT.md` - LLM workflow

- **Project Docs:**
  - `spec.md` - Normalized requirements with REQ IDs
  - `chat2repo-spec.md` - Original prose spec
  - `journeys.md` - User journey definitions
