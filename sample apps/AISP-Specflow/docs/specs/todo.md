# Feature: To-Do Application

**Source:** `TODO-APP.aisp` (AISP Formal Specification)
**Version:** 1.0.0
**Date:** 2026-01-15

---

## Overview

A task management application where users can create, complete, and delete tasks with persistent storage.

---

## ARCHITECTURE

### ARCH-001 (MUST)
Service workers MUST NOT use localStorage or sessionStorage.

**Enforcement:**
- Files in `src/sw/**` and `src/background/**` must not contain `localStorage`
- Files in `src/sw/**` and `src/background/**` must not contain `sessionStorage`
- Use `indexedDB` or `chrome.storage.local` instead

**Rationale:**
- localStorage/sessionStorage not available in MV3 service workers
- Prevents runtime errors in service worker context

---

## REQS

### CRUD Operations

#### TODO-001 (MUST)
Creating a task MUST add it to the task list with a unique UUID, the provided title, completed=false, and a creation timestamp.

**Enforcement:**
- `createTask` function must return object with `id`, `title`, `completed`, `createdAt`
- `id` must be generated via `crypto.randomUUID()` or equivalent

#### TODO-002 (MUST)
Completing a task MUST set its `completed` status to true and record a `completedAt` timestamp.

**Enforcement:**
- `completeTask` function must set `completed: true`
- `completeTask` function must set `completedAt` to current timestamp

#### TODO-003 (MUST)
Deleting a task MUST remove it from the task list entirely.

**Enforcement:**
- After `deleteTask`, no task with the deleted ID should exist in the list
- Use immutable operations (filter, not splice)

### Persistence

#### TODO-004 (MUST)
Tasks MUST persist across browser sessions.

**Enforcement:**
- Tasks must be saved to storage on every mutation
- Tasks must be loaded from storage on app initialization

#### TODO-005 (MUST)
Task persistence MUST use approved storage mechanisms (indexedDB or chrome.storage.local).

**Enforcement:**
- Storage operations must use `indexedDB` API
- Must NOT use `localStorage` or `sessionStorage` for task data

### Security

#### SEC-001 (MUST)
Service worker files MUST NOT reference localStorage.

**Enforcement:**
- Pattern `/localStorage/` must not appear in `src/sw/**` or `src/background/**`

#### SEC-002 (MUST)
Service worker files MUST NOT reference sessionStorage.

**Enforcement:**
- Pattern `/sessionStorage/` must not appear in `src/sw/**` or `src/background/**`

### UI Invariants

#### UI-001 (MUST)
All tasks MUST be visible unless explicitly filtered.

**Enforcement:**
- Filter "all" shows all tasks
- Filter "active" shows only `completed: false`
- Filter "completed" shows only `completed: true`

#### UI-002 (SHOULD)
User actions SHOULD provide feedback within 300ms.

**Enforcement:**
- Optimistic UI updates
- Loading states for async operations

#### UI-003 (SHOULD)
Empty task list SHOULD show a helpful message.

**Enforcement:**
- When `tasks.length === 0`, display empty state component

### Data Integrity

#### DATA-001 (MUST)
Task IDs MUST be unique across the entire task list.

**Enforcement:**
- Use UUID v4 for task IDs
- Never reuse deleted task IDs

#### DATA-002 (MUST)
Completed tasks MUST have a completedAt timestamp.

**Enforcement:**
- If `task.completed === true`, then `task.completedAt` must be defined

---

## JOURNEYS

### J-TODO-CREATE

**Create a new task:**

1. User sees input field with placeholder "What needs to be done?"
2. User types task title (e.g., "Buy groceries")
3. User presses Enter or clicks Add button
4. Task appears at bottom of list with unchecked checkbox
5. Input field clears
6. Task count updates
7. Page refresh: task still present

### J-TODO-COMPLETE

**Complete an existing task:**

Preconditions:
- At least one incomplete task exists

Steps:
1. User sees task in list with empty checkbox
2. User clicks checkbox
3. Checkbox fills with checkmark
4. Task text shows strikethrough styling
5. Active count decrements
6. Page refresh: task still shows completed

### J-TODO-DELETE

**Delete a task:**

Preconditions:
- At least one task exists

Steps:
1. User hovers over task
2. Delete button (X) appears
3. User clicks delete button
4. Task removed from list (with animation)
5. Task count updates
6. Page refresh: task does not reappear

### J-TODO-FILTER

**Filter tasks by status:**

Preconditions:
- At least one completed and one incomplete task exist

Steps:
1. User sees filter buttons: All | Active | Completed
2. User clicks "Active"
3. Only incomplete tasks visible
4. User clicks "Completed"
5. Only completed tasks visible
6. User clicks "All"
7. All tasks visible again

### J-TODO-PERSIST

**Tasks persist across sessions:**

Steps:
1. User creates 3 tasks
2. User completes 1 task
3. User closes browser tab
4. User reopens app
5. All 3 tasks present with correct states

---

## DEFINITION OF DONE

### Critical (MUST PASS)
- J-TODO-CREATE
- J-TODO-COMPLETE
- J-TODO-DELETE
- J-TODO-PERSIST

### Important (SHOULD PASS)
- J-TODO-FILTER
- UI response time < 300ms

### Future (NOT BLOCKING)
- Drag-and-drop reordering
- Due dates
- Categories/tags

---

## Type Definitions

```typescript
interface Task {
  id: string;           // UUID v4
  title: string;        // 1-500 characters
  completed: boolean;
  createdAt: number;    // Unix timestamp ms
  completedAt?: number; // Unix timestamp ms (when completed)
}

type TaskList = Task[];

type FilterType = 'all' | 'active' | 'completed';

interface AppState {
  tasks: TaskList;
  filter: FilterType;
  loading: boolean;
}
```

---

## Changelog

### 2026-01-15 - v1.0.0
- Initial specification from AISP formal spec
- Defined TODO-001 through TODO-005 (CRUD + Persistence)
- Defined SEC-001, SEC-002 (Security)
- Defined UI-001 through UI-003 (UI Invariants)
- Defined DATA-001, DATA-002 (Data Integrity)
- Created 5 user journeys
