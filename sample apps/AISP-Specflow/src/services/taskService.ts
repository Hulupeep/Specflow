/**
 * Task Service - Core CRUD Operations
 *
 * AISP Source: docs/specs/TODO-APP.aisp ⟦Λ:Functions⟧
 *
 * Contract Coverage:
 * - TODO-001: createTask uses crypto.randomUUID()
 * - TODO-002: completeTask sets completed: true and completedAt
 * - TODO-003: deleteTask removes task from list
 */

import type { Task, TaskList, FilterType, Result, TaskError } from '../types/task.js';
import { ErrorCodes } from '../types/task.js';

/**
 * Create a new task
 *
 * AISP Definition:
 * createTask:TaskTitle→Task
 * createTask≜λtitle.⟨id:generateUUID(),title:title,completed:⊥,createdAt:now(),completedAt:None⟩
 *
 * Contract: TODO-001
 * - Must use crypto.randomUUID() for ID generation
 * - Must set completed: false initially
 * - Must set createdAt to current timestamp
 */
export function createTask(title: string): Result<Task> {
  // Validate title (AISP: TaskTitle≜𝕊:len∈[1,500])
  const trimmedTitle = title.trim();

  if (trimmedTitle.length === 0) {
    return {
      ok: false,
      error: { code: ErrorCodes.EMPTY_TITLE, message: 'Task title cannot be empty' },
    };
  }

  if (trimmedTitle.length > 500) {
    return {
      ok: false,
      error: { code: ErrorCodes.TITLE_TOO_LONG, message: 'Task title exceeds 500 characters' },
    };
  }

  // Create task with UUID (TODO-001: must use crypto.randomUUID)
  const task: Task = {
    id: crypto.randomUUID(),
    title: trimmedTitle,
    completed: false,
    createdAt: Date.now(),
    completedAt: undefined,
  };

  return { ok: true, value: task };
}

/**
 * Mark a task as complete
 *
 * AISP Definition:
 * completeTask:Task→Task
 * completeTask≜λt.t[completed↦⊤,completedAt↦Some(now())]
 *
 * Contract: TODO-002
 * - Must set completed: true
 * - Must set completedAt to current timestamp (DATA-002)
 */
export function completeTask(task: Task): Task {
  return {
    ...task,
    completed: true,
    completedAt: Date.now(),
  };
}

/**
 * Mark a task as incomplete
 *
 * AISP Definition:
 * uncompleteTask:Task→Task
 * uncompleteTask≜λt.t[completed↦⊥,completedAt↦None]
 */
export function uncompleteTask(task: Task): Task {
  return {
    ...task,
    completed: false,
    completedAt: undefined,
  };
}

/**
 * Toggle task completion status
 *
 * AISP Definition:
 * toggleTask:Task→Task
 * toggleTask≜λt.t.completed?uncompleteTask(t):completeTask(t)
 */
export function toggleTask(task: Task): Task {
  return task.completed ? uncompleteTask(task) : completeTask(task);
}

/**
 * Delete a task from the list
 *
 * AISP Definition:
 * deleteTask:TaskList×UUID→TaskList
 * deleteTask≜λ(list,id).filter(list,λt.t.id≢id)
 *
 * Contract: TODO-003
 * - Task with given ID must not exist in returned list
 * - Uses immutable filter operation
 */
export function deleteTask(tasks: TaskList, taskId: string): TaskList {
  return tasks.filter((t) => t.id !== taskId);
}

/**
 * Add a task to the list
 *
 * Returns new list with task appended
 */
export function addTask(tasks: TaskList, task: Task): TaskList {
  return [...tasks, task];
}

/**
 * Update a task in the list
 *
 * Returns new list with updated task
 */
export function updateTask(tasks: TaskList, updatedTask: Task): TaskList {
  return tasks.map((t) => (t.id === updatedTask.id ? updatedTask : t));
}

/**
 * Find a task by ID
 */
export function findTask(tasks: TaskList, taskId: string): Task | undefined {
  return tasks.find((t) => t.id === taskId);
}

/**
 * Apply filter to task list
 *
 * AISP Definition:
 * applyFilter:TaskList×FilterType→TaskList
 * applyFilter≜λ(list,filter).case filter of
 *   all→list
 *   active→filter(list,λt.¬t.completed)
 *   completed→filter(list,λt.t.completed)
 *
 * Contract: UI-001
 */
export function applyFilter(tasks: TaskList, filter: FilterType): TaskList {
  switch (filter) {
    case 'all':
      return tasks;
    case 'active':
      return tasks.filter((t) => !t.completed);
    case 'completed':
      return tasks.filter((t) => t.completed);
    default:
      return tasks;
  }
}

/**
 * Count active (incomplete) tasks
 *
 * AISP Definition:
 * countActive:TaskList→ℕ
 * countActive≜λlist.|filter(list,λt.¬t.completed)|
 */
export function countActive(tasks: TaskList): number {
  return tasks.filter((t) => !t.completed).length;
}

/**
 * Count completed tasks
 *
 * AISP Definition:
 * countCompleted:TaskList→ℕ
 * countCompleted≜λlist.|filter(list,λt.t.completed)|
 */
export function countCompleted(tasks: TaskList): number {
  return tasks.filter((t) => t.completed).length;
}

/**
 * Clear all completed tasks
 */
export function clearCompleted(tasks: TaskList): TaskList {
  return tasks.filter((t) => !t.completed);
}
