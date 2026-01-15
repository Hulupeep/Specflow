# AISP + Specflow To-Do App Example

A complete demonstration of combining **AISP (AI Symbolic Protocol)** with **Specflow** for deterministic product building.

## What This Demonstrates

| Tool | Role | Contribution |
|------|------|--------------|
| **AISP** | Specification Layer | Formal rules with <2% ambiguity |
| **Specflow** | Enforcement Layer | YAML contracts + pattern-scanning tests |

## Project Structure

```
AISP-Specflow/
├── docs/
│   ├── specs/TODO-APP.aisp          # AISP formal specification
│   ├── contracts/                    # Specflow YAML contracts
│   ├── blog/BUILD-NARRATIVE.md      # Build narrative documenting process
│   └── AISP-SPECFLOW-COMPARISON.md  # Tool comparison
├── src/
│   ├── types/task.ts                # Type definitions
│   ├── services/                    # Business logic
│   └── components/                  # React UI
└── tests/contracts/                  # Contract enforcement tests
```

## Quick Start

```bash
# Install dependencies
npm install

# Run contract tests
npm run test:contracts

# Start dev server
npm run dev
```

## Results

| Metric | Value |
|--------|-------|
| AISP Rules | 11 |
| Specflow Contracts | 6 |
| Contract Tests | 11 |
| Tests Passed | **11/11 (100%)** |

## The Pipeline

```
Human Requirements
       ↓
AISP Formal Spec (<2% ambiguity)
       ↓
Specflow Contracts (YAML patterns)
       ↓
Contract Tests (pattern scanning)
       ↓
Implementation (guided by contracts)
       ↓
Validation (CI-blocking tests)
```

## Key Insight

**AISP constrains the specification** (what we're building)
**Specflow constrains the implementation** (what we built)

Together they create a deterministic pipeline where:
1. Requirements can't be misinterpreted (AISP: <2% ambiguity)
2. Code can't drift from requirements (Specflow: CI blocking)

## Documentation

- [Build Narrative](docs/blog/BUILD-NARRATIVE.md) - Complete step-by-step build log
- [AISP Specification](docs/specs/TODO-APP.aisp) - Formal specification
- [Tool Comparison](docs/AISP-SPECFLOW-COMPARISON.md) - AISP vs Specflow analysis

## License

MIT
