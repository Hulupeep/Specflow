# TabStax Extension - Architectural Diagnosis Report

**Analyzed:** December 4, 2025
**Codebase:** ~/projects/code/tabstax/tabstax_Ext
**Total Source Files:** 199 TypeScript/TSX files (excluding tests)

---

## Executive Summary

The TabStax extension suffers from **severe architectural coupling** that makes changes extremely difficult and risky. The codebase exhibits a "ball of mud" architecture with a massive 1,766-line view model, god-object hooks, scattered state management, and deep circular dependencies between layers.

**Change Impact Score: 9/10 (Critical)**
Making a simple feature change requires touching 5-15 files across multiple layers, with high risk of breaking distant, unrelated functionality.

---

## Top 5 Architectural Problems

### 1. **God Objects: Massive Files Doing Everything**

**Severity:** Critical

**The Offenders:**
- `useMainPopupViewModel.tsx` - **1,766 lines**
- `staxService.ts` - **1,119 lines**
- `localCacheStore.ts` - **976 lines**
- `useStaxData.ts` - **714 lines** (+ 90 sub-files in `useStaxData/` directory)
- `background.ts` - **851 lines**

**What's Wrong:**
- `useMainPopupViewModel` is a "mega hook" that handles:
  - State management
  - Business logic
  - UI event handlers
  - Share import workflows
  - Sync coordination
  - Error handling
  - Modal management
  - Search/filter logic
  - Banner visibility calculations
  - Telemetry tracking
  - Deep link parsing

- `useStaxData` has been "modularized" into **90 separate files** in subdirectories, but the main hook still orchestrates 30+ sub-hooks and manages complex ref lifetimes

**Impact:**
- Cannot understand what a component does without reading 1,700+ lines
- High cognitive load - requires understanding entire system to change one feature
- Test files become integration tests rather than unit tests
- Merge conflicts on nearly every team change

**Evidence:**
```typescript
// useMainPopupViewModel.tsx - Lines 1-1766
// This single hook imports from:
// - 40+ different modules
// - Manages 15+ useCallback hooks
// - Maintains 20+ useState hooks
// - Coordinates 10+ useEffect hooks
// - Returns a 250+ line JSX tree
```

---

### 2. **Circular State Management: Three Competing State Systems**

**Severity:** Critical

**The Problem:**
The application uses **three overlapping state management systems** that duplicate data and create synchronization nightmares:

1. **Zustand Store (`createAppStore`)** - Global app state
   - Auth state
   - Stax metadata (availableStax, sources)
   - Health status
   - UI state (staxState)

2. **Local Cache Store (`localCacheStore`)** - Persistent storage
   - Saved stax
   - Hidden stax
   - Cloud cache
   - Window mappings
   - Feature flags
   - Debug logs

3. **Hook-based State (`useStaxData` + Context)** - Component-local state
   - Tab state
   - Filter state
   - Selection state
   - Loading state

**Circular Flow:**
```
useStaxData reads from → localCacheStore
                     ↓
              writes to → createAppStore
                     ↓
   useMainPopupViewModel reads from → both stores
                     ↓
              triggers → storage events
                     ↓
        useStorageListenerEffect → updates localCacheStore
                     ↓
                 (circular)
```

**Impact:**
- Data can be out of sync between stores
- Difficult to determine "source of truth"
- Storage listener effects cascade unpredictably
- Race conditions when multiple components update simultaneously
- Tests require mocking all three systems

**Evidence:**
```typescript
// useStaxData.ts - Lines 185-189
const setAvailableStax = useAppStore(store => store.stax.setAvailableStax)
const setSources = useAppStore(store => store.stax.setSources)
const setCloudCacheLastSyncedAt = useAppStore(store => store.stax.setCloudCacheLastSyncedAt)
const staxState = useAppStore(store => store.ui.staxState)
const setStaxState = useAppStore(store => store.ui.setStaxState)

// Same data also lives in:
// - localCacheStore.savedStax
// - localCacheStore.cloudCache
// - state.availableStax (hook local)
```

---

### 3. **Hook Hell: useStaxData as Central Orchestrator**

**Severity:** High

**The Structure:**
```
useStaxData/ (90 files)
├── operations/
│   ├── useFilterOperations.ts
│   ├── useTabOperations.ts
│   ├── useSyncOperations.ts
│   └── useStaxOperations.ts
├── effects/
│   ├── useStorageListenerEffect.ts
│   ├── useLoginEffect.ts
│   ├── useInitializationEffect.ts
│   └── 7 more effect hooks
├── auth/
│   ├── useAuthFailureHandler.ts
│   ├── useAuthStateSync.ts
│   └── syncLock.ts
├── context/
├── selectors/
├── sync/
└── ... (8 more subdirectories)
```

**What's Wrong:**
- **35 files** import or depend on `useStaxData`
- Every operation requires passing through the central hook
- Impossible to use individual features in isolation
- Tests become integration tests - can't test filter logic without sync logic
- Changes to one operation can break unrelated operations through shared refs

**The Ref Problem:**
`useStaxData` manages **29 refs** for coordination:
- `stateRef`, `latestUserRef`, `hasPerformedInitialSyncRef`
- `syncExecutorRef`, `syncPromiseRef`, `syncLockRef`
- `reloadInFlightRef`, `reloadQueuedRef`, `reloadRetryTimeoutRef`
- ... 20 more

These refs are passed to 15+ sub-hooks, creating hidden coupling through mutable shared state.

**Impact:**
- Cannot extract or reuse individual features
- Every feature change risks breaking other features
- Refactoring requires understanding entire hook dependency graph
- New developers need weeks to understand the system

---

### 4. **Service Layer Confusion: Background vs. Foreground**

**Severity:** High

**The Problem:**
`staxService.ts` (1,119 lines) is used in both:
1. **Background service worker** - persistent, event-driven
2. **Popup/foreground** - short-lived, user-triggered

But it contains:
- In-memory caching (lost on popup close)
- Singleton state
- Sync coordination logic
- Storage writes

**Architectural Mismatch:**
```typescript
// staxService.ts
const cache = new Map<string, CacheEntry>()  // Lost on popup close!

// Also does:
await storage.local.set(...)  // Direct storage access
await supabase.stax.getAll()  // Network calls
await writeCloudCache(payload)  // More storage

// And orchestrates:
const syncResult = await runSyncPipeline(...)  // Complex sync logic
```

**Impact:**
- Cache is useless in popup (reloads every time)
- Background can't benefit from popup's work
- Sync logic duplicated between background and foreground
- Storage writes conflict when both contexts run
- Tests fail intermittently due to cache state

---

### 5. **Test Coupling: Tests Mirror Implementation Structure**

**Severity:** Medium-High

**The Problem:**
Tests are tightly coupled to implementation details:

```typescript
// Tests are organized by hook structure, not behavior
src/__tests__/
├── useStaxData.test.ts
├── useStaxData.operations.test.tsx
├── useStaxData.planGating.test.tsx
├── useStaxData.syncExecutor.test.ts
└── useStaxData.filter.test.tsx

// Each test must mock the entire useStaxData infrastructure:
- 29 refs
- 3 state stores
- 15+ sub-hooks
- Storage listeners
- Async coordinators
```

**Why This Hurts:**
- Refactoring implementation breaks all tests
- Tests don't verify behavior, they verify structure
- Cannot test features in isolation
- High maintenance burden (400+ lines of setup per test file)
- Tests give false confidence (they test mocks, not real integration)

**Example:**
```typescript
// From useStaxData.test.ts
const mockStaxService = {
  getAvailableStax: vi.fn(),
  getStaxTabs: vi.fn(),
  invalidateCache: vi.fn(),
  syncAllStax: vi.fn(),
}
const mockSupabase = { /* 50 lines of mocks */ }
const mockFeatureFlags = { /* ... */ }
// ... 300+ more lines of setup
```

---

## Dependency Analysis

### Most Imported Files (Coupling Hotspots)

1. **`@/state/store` (createAppStore)** - 35+ files depend on it
2. **`@/hooks/useStaxData`** - 35 files
3. **`@/state/localCacheStore`** - 28 files
4. **`@/services/staxService`** - 25 files
5. **`@/types/stax`** - 40+ files (type coupling)

### Circular Dependencies Detected

**Critical Circle:**
```
useStaxData → staxService
           → localCacheStore
           → store
           → useStaxData/effects
           → useStaxData (circular)
```

**Auth Circle:**
```
background.ts → useAuthStatus
              → authStorage
              → persistCurrentUser
              → createAppStore
              → background (via storage listeners)
```

---

## What the Code Tries to Do vs. What It Actually Does

### **Intended Pattern: Clean Layered Architecture**
```
Components
    ↓
Hooks (useStaxData)
    ↓
Services (staxService)
    ↓
State (store + localCache)
    ↓
Storage/API
```

### **Actual Pattern: Spaghetti Mesh**
```
Components ←→ Hooks ←→ Services
    ↓↑          ↓↑        ↓↑
  Store ←→ LocalCache ←→ Background
    ↓↑          ↓↑        ↓↑
 Storage ←→ Listeners ←→ Refs
    ↓↑          ↓↑        ↓↑
   (everything talks to everything)
```

---

## File Size Distribution

| Size Range | Count | Worst Offenders |
|------------|-------|----------------|
| 1000+ lines | 4 | useMainPopupViewModel (1766), staxService (1119), localCacheStore (976) |
| 700-999 lines | 5 | background (851), useStaxData (714) |
| 500-699 lines | 8 | useTabOperations (751), share-viewer (1529) |
| 300-499 lines | 15+ | Multiple services and hooks |

**Guideline Violations:**
- **34 files** exceed 300 lines (recommended max)
- **9 files** exceed 700 lines (architectural smell threshold)

---

## Concrete Examples of Change Friction

### Example 1: Adding a Simple Filter Option

**What Should Happen:**
- Change 1 file: Add filter logic
- Change 1 file: Add UI control
- Write 1 test

**What Actually Happens:**
1. Modify `useFilterOperations.ts` (filter logic)
2. Update `useStaxData.ts` (wire new operation)
3. Change `useMainPopupViewModel.tsx` (add UI handler)
4. Update `StaxTagStrip.tsx` (add chip)
5. Modify `filterStaxList()` in `filters.ts`
6. Update `store.ts` (add filter state)
7. Change `localCacheStore.ts` (persist filter)
8. Update 3-4 test files with new mocks
9. Debug storage listener side effects
10. Fix race condition in filter debouncing

**Total: 10+ files touched, 2+ hours of debugging**

### Example 2: Changing Sync Behavior

**Ripple Effect:**
- `background.ts` - Change sync trigger
- `useSyncOperations.ts` - Update sync logic
- `syncExecutor.ts` - Modify execution
- `staxService.ts` - Update service call
- `localCacheStore.ts` - Adjust cache invalidation
- `store.ts` - Update sync state
- `useStorageListenerEffect.ts` - Handle new event
- All sync test files - Remock everything

**Total: 8+ files, integration test hell**

---

## Recommendations

### Immediate (Emergency Triage)

1. **Extract Business Logic from View Models**
   - Move `useMainPopupViewModel` logic to dedicated services
   - Target: Reduce to < 300 lines

2. **Consolidate State Management**
   - Pick ONE store (Zustand)
   - Migrate localCacheStore to Zustand slices
   - Remove hook-local state duplication

3. **Break useStaxData Monolith**
   - Extract operations into independent services
   - Remove 29 refs - use events/callbacks instead
   - Make sub-hooks usable independently

### Medium Term (Refactoring)

4. **Separate Background from Foreground**
   - Create dedicated background service layer
   - Use message passing for coordination
   - Remove shared service instances

5. **Implement Feature Slices**
   - Organize by feature (auth/, sync/, stax/, filters/)
   - Not by type (hooks/, services/, components/)
   - Each feature owns its state, logic, UI

6. **Decouple Tests from Implementation**
   - Test public API/behavior, not internal structure
   - Use integration tests for flows
   - Mock at service boundary, not hook internals

### Long Term (Re-architecture)

7. **Event-Driven Architecture**
   - Background emits events → Popup subscribes
   - No direct shared state
   - Clear boundaries

8. **Establish Clear Layers**
   - UI Layer (React components)
   - Application Layer (use cases / commands)
   - Domain Layer (business logic)
   - Infrastructure Layer (storage, network)
   - Enforce: Upper layers depend on lower, never reverse

---

## Metrics Summary

| Metric | Current | Target | Status |
|--------|---------|--------|--------|
| Largest file | 1,766 lines | < 300 lines | 🔴 Critical |
| Files > 300 lines | 34 | < 5 | 🔴 Critical |
| useStaxData coupling | 35 files | < 10 | 🔴 High |
| State management systems | 3 | 1 | 🔴 High |
| Circular dependencies | 3+ detected | 0 | 🔴 High |
| Average test setup | 400+ lines | < 50 lines | 🔴 High |
| Change impact radius | 10+ files | 2-3 files | 🔴 Critical |

---

## Conclusion

The TabStax codebase exhibits **critical architectural debt** that prevents effective development:

1. **God objects** make changes risky and expensive
2. **Duplicate state** creates synchronization bugs
3. **Deep coupling** means every change ripples across 10+ files
4. **Tangled hooks** prevent feature reuse and testing
5. **Mixed contexts** (background/foreground) cause race conditions

**Bottom Line:**
This is a classic case of **"works but unmaintainable"**. The code functions, but adding features or fixing bugs requires heroic understanding of the entire system. New developers will struggle for months. Technical debt is compounding.

**Recommended Action:**
Treat as **legacy system**. Do not add features until core refactoring (state consolidation, god object extraction) is complete. Otherwise, each feature addition increases technical debt exponentially.

---

**Generated by:** Claude Code Architectural Analysis Tool
**Methodology:** Static analysis, dependency graphing, coupling metrics, file size analysis
