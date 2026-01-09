# MindSplit

**Turn chaotic meeting notes into cleanly separated workstreams using graph min-cut.**

Built with Specflow methodology - contracts enforce architecture, tests verify journeys.

## The Idea

You have meeting notes with everything mixed together:
```
Fix login bug. Review dashboard mockups. Plan Q2 roadmap.
Auth tokens expiring - related to login. Dashboard needs new colors.
Roadmap should include auth overhaul.
```

MindSplit uses **graph min-cut** to find the minimum shared context needed to separate these into independent workstreams:

```
Workstream 1: Auth/Login
  • Fix login bug
  • Auth tokens expiring

Workstream 2: Dashboard
  • Review dashboard mockups
  • Dashboard needs new colors

Workstream 3: Roadmap
  • Plan Q2 roadmap
  • Roadmap should include auth overhaul
    ↔ Bleeding edge to Auth (needs coordination)
```

## How It Works

```
Text → Chunks → Embeddings → Similarity Graph → Min-Cut → Workstreams
                    ↓
              (cached in ruvector)
```

1. **Parse** text into semantic chunks (paragraphs/bullets)
2. **Embed** each chunk (with caching for performance)
3. **Build graph** where edge weight = semantic similarity
4. **Min-cut** to find optimal split with minimum "bleeding edges"
5. **Output** workstreams with cross-stream dependencies

## Quick Start

```bash
npm install
npm run demo
```

## Specflow Compliance

This app is built following Specflow methodology:

### Architecture Contracts (ARCH-xxx)
- **ARCH-001**: Graph functions are pure - no side effects
- **ARCH-002**: All embeddings cached in ruvector
- **ARCH-003**: Deterministic output (seeded randomness)
- **ARCH-004**: Atomic memory operations

### Feature Contracts (FEAT-xxx)
- **FEAT-001**: Parse input into chunks with unique IDs
- **FEAT-002**: Generate/cache embeddings
- **FEAT-003**: Build weighted similarity graph
- **FEAT-004**: Min-cut algorithm for N-way split
- **FEAT-005**: Output workstreams with bleeding edges

### Journey Contracts (J-xxx)
- **J-SPLIT-001**: Split meeting notes (critical)
- **J-SPLIT-002**: Incremental add and re-split
- **J-SPLIT-003**: Explore bleeding edges

## Run Tests

```bash
# Contract tests (architecture enforcement)
npm run test:contracts

# Journey tests (user flow verification)
npm run test:journey

# All tests
npm test
```

## Build

```bash
# Runs contract tests FIRST, then compiles
npm run build
```

If contracts fail → build blocked. This is Specflow.

## API

```typescript
import { MindSplit } from 'mindsplit'

const ms = new MindSplit()

// Split into 3 workstreams
const result = await ms.split(meetingNotes, 3)

// result.workstreams - the separated streams
// result.cutResult.cutEdges - what "bleeds" between streams
// result.stats - chunk/edge counts

// Add more content later
const updated = await ms.addAndResplit(result.sessionId, newNotes, 3)

// See what connects workstreams
const report = await ms.getBleedingReport(result.sessionId)
```

## Why Min-Cut?

Traditional clustering groups similar things together.

Min-cut does the opposite: it finds the **minimum connections to sever** to create independent groups. This means:

- Each workstream is maximally self-contained
- You know exactly what "bleeds" between streams
- Coordination needs are explicit, not implicit

## Files

```
mindsplit/
├── SPEC.md                          # Product specification
├── docs/contracts/
│   ├── feature_architecture.yml     # ARCH-001 through ARCH-004
│   ├── feature_mincut.yml           # FEAT-001 through FEAT-005
│   └── journey_split.yml            # J-SPLIT-001 through J-SPLIT-003
├── src/
│   ├── lib/
│   │   ├── types.ts                 # Core types
│   │   ├── parser.ts                # Text chunking (FEAT-001)
│   │   ├── embeddings.ts            # Embedding with cache (FEAT-002)
│   │   ├── graph.ts                 # Graph operations (FEAT-003)
│   │   ├── mincut.ts                # Stoer-Wagner/Karger (FEAT-004)
│   │   ├── memory.ts                # Ruvector integration (ARCH-002, ARCH-004)
│   │   ├── random.ts                # Seeded RNG (ARCH-003)
│   │   └── mindsplit.ts             # Main orchestrator
│   ├── __tests__/contracts/
│   │   ├── architecture.test.ts     # Scans for ARCH violations
│   │   └── journey.test.ts          # E2E journey tests
│   └── demo.ts                      # Interactive demo
└── package.json
```

## The Mind-Blowing Part

The min-cut algorithm finds the **mathematically optimal** way to separate your chaotic thoughts into independent threads with **minimum shared context**.

It's not just "group similar things" - it's "find the minimum bridges between concepts."

Those bridges (bleeding edges) are your coordination points. Cut them = independent teams. Keep them = explicit handoffs needed.

**Graph theory applied to human cognition.**
