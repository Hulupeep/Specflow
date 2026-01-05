# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

Specflow is a methodology and template library for turning specs into enforceable architectural contracts. It provides:
- A constrained spec format with requirement IDs (AUTH-001, EMAIL-042)
- YAML contracts that map requirements to forbidden/required code patterns
- Automated tests that scan source code for contract violations
- LLM prompts that enforce contracts during development

**Core loop:** Write spec with IDs → Generate contracts → Auto-create tests → Violations = Build fails

## Repository Structure

This is primarily a **documentation and template repository**, not a runtime library:
- Root `.md` files: Core methodology docs and templates
- `demo/`: Working example showing contracts catching violations that unit tests miss
- `sample_spec/`: Example specifications
- `backlog/`: Development planning docs

## Commands

### Demo (in demo/ directory)
```bash
cd demo
npm install
npm run demo           # Full automated demo
npm run demo:working   # Show working state
npm run demo:broken    # Show LLM "optimization" that breaks contracts
npm run demo:compare   # Run tests comparing unit vs contract tests
npm test               # Run all tests
npm run test:unit      # Run unit tests only
npm run test:contracts # Run contract tests only
```

## Core Documentation

When working with this repo, understand these docs in order:

1. **CONTRACTS-README.md** - System overview, core loop, where things live
2. **SPEC-FORMAT.md** - How to write specs (REQ IDs like `AUTH-001 (MUST)`, journey IDs like `J-AUTH-REGISTER`)
3. **CONTRACT-SCHEMA.md** - YAML contract format (maps REQ IDs → rules → tests)
4. **LLM-MASTER-PROMPT.md** - Reusable prompt for LLMs working with contracts

## Key Concepts

### Requirement IDs
- Format: `[FEATURE]-[NUMBER]` (e.g., `AUTH-001`, `EMAIL-042`)
- Tags: `(MUST)` = non-negotiable, `(SHOULD)` = guideline
- Each REQ maps to exactly one contract rule

### Contract Types
- **Feature contracts**: `docs/contracts/feature_<name>.yml` - Pattern-based rules
- **Journey contracts**: `docs/contracts/journey_<name>.yml` - E2E flow testing

### Contract Rules
- `rules.non_negotiable`: MUST requirements - build fails if violated
- `rules.soft`: SHOULD requirements - guidelines, not enforced
- `forbidden_patterns`: Regex patterns that must NOT appear in code
- `required_patterns`: Regex patterns that MUST appear in code

## LLM Behavior Rules

When modifying this repo or using its methodology:

1. **Do NOT modify protected code without checking contracts first**
2. **Do NOT change `non_negotiable` rules unless user says `override_contract: <id>`**
3. **Always work incrementally:** spec → contract → test → code → verify
4. **Contract tests must output:** `CONTRACT VIOLATION: <REQ-ID>` with file, line, and message

## Demo Architecture

The `demo/` directory demonstrates the methodology:
- `states/safe.js`: Compliant code using store with TTL
- `states/trap.js`: Violation using localStorage (simulates bad LLM suggestion)
- `src/__tests__/contracts.test.js`: Contract test that catches violations unit tests miss
- `docs/contract.yml`: Example contract for AUTH-001
