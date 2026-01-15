/**
 * Storage Service - Persistence Layer
 *
 * AISP Source: docs/specs/TODO-APP.aisp ⟦Λ:Functions⟧
 *
 * Contract Coverage:
 * - TODO-004: Tasks persist across sessions
 * - TODO-005: Uses indexedDB (approved storage)
 * - SEC-001/SEC-002: Does NOT use localStorage/sessionStorage
 */

import { openDB, type IDBPDatabase } from 'idb';
import type { Task, TaskList, Result } from '../types/task.js';
import { ErrorCodes } from '../types/task.js';

const DB_NAME = 'aisp-specflow-todo';
const DB_VERSION = 1;
const STORE_NAME = 'tasks';

/**
 * Initialize IndexedDB database
 *
 * Contract: TODO-005
 * - Uses indexedDB for persistence (approved storage)
 * - Does NOT use localStorage or sessionStorage
 */
async function getDB(): Promise<IDBPDatabase> {
  return openDB(DB_NAME, DB_VERSION, {
    upgrade(db) {
      if (!db.objectStoreNames.contains(STORE_NAME)) {
        db.createObjectStore(STORE_NAME, { keyPath: 'id' });
      }
    },
  });
}

/**
 * Save all tasks to storage
 *
 * AISP Definition:
 * persistTasks:TaskList→IO⟨Result⟨⟩⟩
 * persistTasks≜λlist.indexedDB.put("tasks",serialize(list))
 *
 * Contract: TODO-004, TODO-005
 * - Persists tasks across sessions
 * - Uses indexedDB (approved storage mechanism)
 */
export async function saveTasks(tasks: TaskList): Promise<Result<void>> {
  try {
    const db = await getDB();
    const tx = db.transaction(STORE_NAME, 'readwrite');
    const store = tx.objectStore(STORE_NAME);

    // Clear existing and add all tasks
    await store.clear();
    for (const task of tasks) {
      await store.put(task);
    }
    await tx.done;

    return { ok: true, value: undefined };
  } catch (error) {
    console.error('Failed to save tasks:', error);
    return {
      ok: false,
      error: {
        code: ErrorCodes.STORAGE_ACCESS,
        message: 'Failed to save tasks to storage',
      },
    };
  }
}

/**
 * Load all tasks from storage
 *
 * AISP Definition:
 * loadTasks:⟨⟩→IO⟨Result⟨TaskList⟩⟩
 * loadTasks≜λ_.indexedDB.get("tasks").map(deserialize)
 *
 * Contract: TODO-004, TODO-005
 * - Loads persisted tasks from indexedDB
 * - Returns empty list if no tasks stored
 */
export async function loadTasks(): Promise<Result<TaskList>> {
  try {
    const db = await getDB();
    const tasks = await db.getAll(STORE_NAME);

    // Validate loaded tasks have correct structure
    const validTasks = tasks.filter(isValidTask);

    return { ok: true, value: validTasks };
  } catch (error) {
    console.error('Failed to load tasks:', error);
    // Return empty list on error (graceful degradation)
    // AISP: ρ_deserialize≜λe.return(empty_list)
    return { ok: true, value: [] };
  }
}

/**
 * Save a single task
 */
export async function saveTask(task: Task): Promise<Result<void>> {
  try {
    const db = await getDB();
    await db.put(STORE_NAME, task);
    return { ok: true, value: undefined };
  } catch (error) {
    console.error('Failed to save task:', error);
    return {
      ok: false,
      error: {
        code: ErrorCodes.STORAGE_ACCESS,
        message: 'Failed to save task to storage',
      },
    };
  }
}

/**
 * Delete a single task from storage
 */
export async function deleteTaskFromStorage(taskId: string): Promise<Result<void>> {
  try {
    const db = await getDB();
    await db.delete(STORE_NAME, taskId);
    return { ok: true, value: undefined };
  } catch (error) {
    console.error('Failed to delete task:', error);
    return {
      ok: false,
      error: {
        code: ErrorCodes.STORAGE_ACCESS,
        message: 'Failed to delete task from storage',
      },
    };
  }
}

/**
 * Clear all tasks from storage
 */
export async function clearAllTasks(): Promise<Result<void>> {
  try {
    const db = await getDB();
    await db.clear(STORE_NAME);
    return { ok: true, value: undefined };
  } catch (error) {
    console.error('Failed to clear tasks:', error);
    return {
      ok: false,
      error: {
        code: ErrorCodes.STORAGE_ACCESS,
        message: 'Failed to clear tasks from storage',
      },
    };
  }
}

/**
 * Validate task structure
 *
 * Ensures loaded data matches Task interface
 */
function isValidTask(obj: unknown): obj is Task {
  if (!obj || typeof obj !== 'object') return false;

  const task = obj as Record<string, unknown>;

  return (
    typeof task.id === 'string' &&
    typeof task.title === 'string' &&
    typeof task.completed === 'boolean' &&
    typeof task.createdAt === 'number' &&
    (task.completedAt === undefined || typeof task.completedAt === 'number')
  );
}
