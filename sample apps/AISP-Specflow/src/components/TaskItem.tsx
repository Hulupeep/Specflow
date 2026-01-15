/**
 * TaskItem Component
 *
 * AISP Contracts:
 * - TODO-002: Toggle completed state
 * - TODO-003: Delete task
 * - DATA-002: Show completedAt when completed
 *
 * UI Contract: UI-002
 * - Display task with completion toggle
 * - Show delete button
 */

import type { Task } from '../types/task.js';

interface TaskItemProps {
  task: Task;
  onToggle: (id: string) => void;
  onDelete: (id: string) => void;
}

export function TaskItem({ task, onToggle, onDelete }: TaskItemProps) {
  const formatDate = (timestamp: number) => {
    return new Date(timestamp).toLocaleString();
  };

  return (
    <li className={`task-item ${task.completed ? 'completed' : ''}`}>
      <label className="task-checkbox">
        <input
          type="checkbox"
          checked={task.completed}
          onChange={() => onToggle(task.id)}
        />
        <span className="checkmark"></span>
      </label>

      <div className="task-content">
        <span className="task-title">{task.title}</span>
        <span className="task-meta">
          Created: {formatDate(task.createdAt)}
          {task.completedAt && (
            <> · Completed: {formatDate(task.completedAt)}</>
          )}
        </span>
      </div>

      <button
        className="delete-btn"
        onClick={() => onDelete(task.id)}
        aria-label="Delete task"
      >
        ×
      </button>
    </li>
  );
}
