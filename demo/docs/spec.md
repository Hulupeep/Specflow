# Feature: Authentication

## REQS

### AUTH-001 (MUST)
Session storage MUST use Redis with TTL, not browser localStorage.

**Rationale:**
- localStorage can be disabled by user/admin policies (enterprise environments)
- localStorage doesn't expire automatically (manual cleanup required, security risk)
- localStorage isn't available in service workers (Chrome MV3 extensions crash)

**Compliance:**
- ✅ Use in-memory storage with TTL (simulating Redis for demo)
- ❌ Do NOT use `localStorage.setItem()`
- ❌ Do NOT use `sessionStorage.setItem()`

**Test Strategy:**
Source code scan: Forbid `/localStorage\.(get|set)Item/` in `src/auth.js`

---

## Context

This requirement emerged from a real TabStax production incident where an LLM
"optimized" authentication by switching from chrome.storage to localStorage,
breaking the extension in enterprise environments with localStorage disabled.

The LLM's reasoning was sound ("localStorage is faster"), the unit tests passed,
but the spec requirement was violated, causing production crashes.
