# MindSplit Specification

**One-liner:** Turn chaotic meeting notes into cleanly separated workstreams using graph min-cut.

## The Problem

You have meeting notes, brainstorm dumps, or planning docs with everything mixed together:
- "We need to fix the auth bug AND redesign the dashboard AND plan the Q2 roadmap"
- Ideas are interleaved, contexts bleed into each other
- No clear separation of concerns

## The Solution

MindSplit:
1. Parses text into semantic chunks
2. Builds a similarity graph (nodes = chunks, edges = semantic similarity)
3. Uses **min-cut** to find natural breakpoints
4. Outputs cleanly separated workstreams with minimal shared context

## Why Min-Cut?

Min-cut finds the minimum edges to remove to split a graph into disconnected components.

Applied to ideas: it finds the **minimum shared context** needed to separate concepts into independent threads.

```
Before: One tangled mess of ideas
After:  3 clean workstreams, each self-contained
        (with min-cut telling you exactly what "bleeds" between them)
```

---

## Tech Stack

- TypeScript / Node.js
- ruvector for embeddings + memory
- Custom min-cut implementation (Stoer-Wagner or Karger's)
- CLI interface

---

## Architecture (What's Always True)

### ARCH-001 (MUST)
Graph operations must be pure functions.
No side effects in min-cut algorithm.
State lives in ruvector memory, not in graph functions.

### ARCH-002 (MUST)
All embeddings must be cached in ruvector.
Never compute the same embedding twice.
Cache key = hash of text content.

### ARCH-003 (MUST)
Min-cut results must be deterministic for same input.
Use seeded randomness if algorithm requires it.
Same input → same output, always.

### ARCH-004 (MUST)
Memory operations must be atomic.
Either all chunks are stored, or none are.
No partial state on failure.

---

## Features (What It Does)

### FEAT-001 (MUST)
Parse input text into semantic chunks.
Chunk boundaries: paragraphs, bullet points, or sentence groups.
Each chunk gets a unique ID.

### FEAT-002 (MUST)
Generate embeddings for each chunk using ruvector.
Store embeddings in memory with chunk ID as key.
Retrieve from cache if already computed.

### FEAT-003 (MUST)
Build similarity graph from embeddings.
Edge weight = cosine similarity between chunk embeddings.
Only create edges above similarity threshold (default: 0.3).

### FEAT-004 (MUST)
Implement min-cut algorithm to find optimal split points.
Support splitting into N workstreams (user-specified).
Return: workstreams + cut edges (the "shared context").

### FEAT-005 (MUST)
Output workstreams as structured data.
Each workstream: ID, chunks, and "bleeding edges" (connections to other streams).

### FEAT-006 (SHOULD)
Visualize the graph and cuts (optional ASCII or JSON for external tools).

---

## Journeys (What Users Accomplish)

### J-SPLIT-001: Split Meeting Notes (Critical)

**As a** user with chaotic meeting notes
**I want to** automatically separate them into workstreams
**So that** I can assign each stream to different people/projects

**Steps:**
1. User provides meeting notes as text file
2. System parses into chunks
3. System builds similarity graph
4. System runs min-cut for N workstreams
5. System outputs separated workstreams

**Expected:**
- Each workstream is coherent (related ideas grouped)
- Minimal "bleeding" between workstreams
- Original content preserved (no loss)

**Acceptance Criteria:**
- All input chunks appear in exactly one output workstream
- Cut edges are reported (shared context)
- Deterministic output for same input

### J-SPLIT-002: Incremental Add (Important)

**As a** user with ongoing notes
**I want to** add new content and re-split
**So that** I can evolve workstreams over time

**Steps:**
1. User adds new text to existing session
2. System computes embeddings (using cache for existing)
3. System rebuilds graph with new nodes
4. System re-runs min-cut
5. System shows diff from previous split

**Expected:**
- New chunks integrated into appropriate workstreams
- Cached embeddings reused (performance)
- Changes highlighted

### J-SPLIT-003: Explore Bleeding Edges (Important)

**As a** user reviewing workstreams
**I want to** see what concepts "bleed" between streams
**So that** I can decide if they need coordination

**Steps:**
1. User requests bleeding edge report
2. System shows cut edges with context
3. User sees which chunks bridge workstreams

**Expected:**
- Clear list of cross-stream dependencies
- Context for each bleeding edge
- Actionable output (assign coordination owner)

---

## Definition of Done

### Critical (MUST PASS)
- [ ] J-SPLIT-001: Split meeting notes end-to-end
- [ ] ARCH-001: Graph functions are pure
- [ ] ARCH-002: Embeddings cached in ruvector
- [ ] ARCH-003: Deterministic output

### Important (SHOULD PASS)
- [ ] J-SPLIT-002: Incremental add works
- [ ] J-SPLIT-003: Bleeding edges reported
- [ ] ARCH-004: Atomic memory operations

---

## Example

**Input:**
```
We need to fix the login bug by Friday.
The dashboard redesign mockups are ready for review.
Q2 roadmap planning meeting is next Tuesday.
Auth tokens are expiring too quickly - related to login bug.
Dashboard should use the new design system colors.
Roadmap should include the auth overhaul.
```

**Output (3 workstreams):**

```
Workstream 1: Auth/Login
- "We need to fix the login bug by Friday."
- "Auth tokens are expiring too quickly - related to login bug."

Workstream 2: Dashboard
- "The dashboard redesign mockups are ready for review."
- "Dashboard should use the new design system colors."

Workstream 3: Roadmap
- "Q2 roadmap planning meeting is next Tuesday."
- "Roadmap should include the auth overhaul."

Bleeding Edges (shared context):
- "Roadmap should include the auth overhaul"
  ↔ connects Workstream 3 to Workstream 1
  (coordination needed between roadmap and auth teams)
```

The min-cut found that "auth overhaul" is the minimum shared context between roadmap and auth work.
