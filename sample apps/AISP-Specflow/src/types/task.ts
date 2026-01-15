/**
 * Task Type Definitions
 *
 * AISP Source: docs/specs/TODO-APP.aisp ⟦Σ:Types⟧
 *
 * Contract Coverage:
 * - DATA-001: id: string (UUID, not number)
 * - DATA-002: completedAt?: number (timestamp when completed)
 */

/**
 * Core Task interface
 *
 * AISP Definition:
 * Task≜⟨
 *   id:UUID,
 *   title:TaskTitle,
 *   completed:𝔹,
 *   createdAt:Timestamp,
 *   completedAt:Option⟨Timestamp⟩
 * ⟩
 */
export interface Task {
  /** Unique identifier - UUID v4 format (DATA-001) */
  id: string;

  /** Task title - 1 to 500 characters */
  title: string;

  /** Completion status */
  completed: boolean;

  /** Creation timestamp in milliseconds */
  createdAt: number;

  /** Completion timestamp - required when completed=true (DATA-002) */
  completedAt?: number;
}

/**
 * Collection of tasks
 *
 * AISP Definition:
 * TaskList≜List⟨Task⟩
 */
export type TaskList = Task[];

/**
 * Filter options for displaying tasks
 *
 * AISP Definition:
 * FilterType≜{all,active,completed}
 */
export type FilterType = 'all' | 'active' | 'completed';

/**
 * Application state
 *
 * AISP Definition:
 * AppState≜⟨tasks:TaskList,filter:FilterType,loading:𝔹⟩
 */
export interface AppState {
  tasks: TaskList;
  filter: FilterType;
  loading: boolean;
}

/**
 * Result type for operations that can fail
 *
 * AISP Definition:
 * Result⟨T⟩≜Either⟨Error,T⟩
 */
export type Result<T> =
  | { ok: true; value: T }
  | { ok: false; error: TaskError };

/**
 * Error type for task operations
 *
 * AISP Definition:
 * Error≜⟨code:ℕ,message:𝕊⟩
 */
export interface TaskError {
  code: number;
  message: string;
}

/**
 * Error codes from AISP ⟦Χ:Errors⟧
 */
export const ErrorCodes = {
  // Storage errors
  STORAGE_ACCESS: 1001,
  SERIALIZE_FAILED: 1002,
  DESERIALIZE_FAILED: 1003,

  // Validation errors
  EMPTY_TITLE: 2001,
  TITLE_TOO_LONG: 2002,
  INVALID_ID: 2003,

  // Not found errors
  TASK_NOT_FOUND: 3001,
} as const;
