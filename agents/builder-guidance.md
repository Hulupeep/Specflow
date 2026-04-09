# Builder Guidance

Decision frameworks for builder-style agents (sprint-executor, migration-builder, frontend-builder, edge-function-builder, etc.) during active implementation work.

These aren't rules that can be mechanically enforced. They're defaults the builder should reach for when a specific trigger fires. The goal is to prevent reflex decisions from becoming entangling patches.

---

## Harness-Issue Triage

**Trigger:** a test you just wrote (or modified) fails for harness reasons — ESM import crashes, missing module transforms, fake logger shapes, module resolution errors, etc. The product code is fine; the test environment is the problem.

**The default LLM reflex is to stub.** Stubbing is the cheapest local fix. It is also the most entangling choice, because every future test in this area will need the same stub, and the stubs hide real import coupling that the runtime path doesn't hide.

**Before reaching for `jest.mock()` or `vi.mock()`, consider the options:**

### Option A — Stub the dependency at the test boundary

*The reflex. Cheapest upfront, most entangling long-term.*

- Fast: add `jest.mock('pino-http', ...)` and move on
- Cost: every future test that imports the same dependency needs the same stub
- Cost: the stub hides real coupling from the test surface
- **Use when:** the dependency is trivially fake-able (a logger, a telemetry sender) and you can document the stub pattern for future tests to reuse

### Option B — Use an existing factory/helper that avoids the problematic import

*If the workspace already has a `createApp()`, `buildServer()`, or similar, use it.*

- The factory was probably created to isolate problematic imports in the first place
- Free: no new code
- **Use when:** a factory exists. Search the workspace before stubbing.

### Option C — Refactor the product code to make it test-friendly

*Introduce an app-factory, extract a handler, or move the transitive-import source behind an interface.*

- Slower upfront: requires changing product code, not just test code
- Correct long-term: the test surface and the runtime surface stay aligned
- **Use when:** multiple tests will hit the same import problem, or when stubbing would hide an important coupling

### Option D — Move the test to a different boundary

*An integration test that hits real Express mount may belong at a different level than a unit test that exercises a handler.*

- If the test was trying to unit-test something that only makes sense at integration level, move it up
- If the test was trying to integration-test something that could be unit-tested, move it down
- **Use when:** the test's intent and its boundary don't match

### Option E — Add a shared test helper so future tests don't repeat this work

*If you end up stubbing, at least write the stub once in a shared location.*

- `tests/helpers/mock-logger.ts` is better than `jest.mock('pino-http')` in every file
- **Use when:** you chose Option A but want to prevent the entanglement from spreading

---

### The 60-second rule

Before reaching for a stub, stop for 60 seconds and answer three questions:

1. **Does a factory already exist in this workspace?** If yes, use it (Option B).
2. **Will this stub be needed in 3+ other tests?** If yes, refactor product code (Option C) or add a shared helper (Option E).
3. **Is the test at the right boundary?** If no, move it (Option D).

If the answer to all three is no, stub it (Option A) — but document the stub pattern and link it from the next similar test.

**Record the decision.** In the pre-flight Q7 reconnaissance answer, note the harness quirks you found and the pattern you chose. Future builders will read this and reuse your pattern instead of re-inventing one.

---

## Why This Matters

Two of the three builder updates in a recent real session were reflexive stubbing. The third was the correct choice (app-factory refactor) — but it was reached only after two rounds of stubbing first. A 60-second triage step would have produced the correct choice on the first round.

The LLM's default isn't wrong — it's just unconsidered. Writing down the options makes the consideration explicit.
