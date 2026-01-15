/**
 * TaskInput Component
 *
 * AISP Contract: TODO-001
 * - Accepts task title input
 * - Validates title before submission
 *
 * UI Contract: UI-001
 * - Input field for new task creation
 */

import { useState, type FormEvent } from 'react';

interface TaskInputProps {
  onAddTask: (title: string) => void;
}

export function TaskInput({ onAddTask }: TaskInputProps) {
  const [title, setTitle] = useState('');

  const handleSubmit = (e: FormEvent) => {
    e.preventDefault();
    const trimmed = title.trim();
    if (trimmed.length > 0) {
      onAddTask(trimmed);
      setTitle('');
    }
  };

  return (
    <form onSubmit={handleSubmit} className="task-input">
      <input
        type="text"
        value={title}
        onChange={(e) => setTitle(e.target.value)}
        placeholder="What needs to be done?"
        autoFocus
      />
      <button type="submit" disabled={title.trim().length === 0}>
        Add
      </button>
    </form>
  );
}
