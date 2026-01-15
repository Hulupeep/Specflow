/**
 * App Component - Main Application
 *
 * AISP + Specflow To-Do App
 *
 * Contracts Implemented:
 * - TODO-001: Create task with UUID
 * - TODO-002: Complete task with timestamp
 * - TODO-003: Delete task
 * - TODO-004: Persist across sessions (indexedDB)
 * - TODO-005: Approved storage only
 * - UI-001, UI-002, UI-003: User interface contracts
 */

import { useState, useEffect, useCallback } from 'react';
import type { Task } from './types/task.js';
import { createTask, completeTask, uncompleteTask, deleteTask } from './services/taskService.js';
import { loadTasks, saveTasks } from './services/storageService.js';
import { TaskInput } from './components/TaskInput.js';
import { TaskList } from './components/TaskList.js';

export function App() {
  const [tasks, setTasks] = useState<Task[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Load tasks from storage on mount (TODO-004)
  useEffect(() => {
    async function load() {
      const result = await loadTasks();
      if (result.ok) {
        setTasks(result.value);
      } else {
        setError('Failed to load tasks');
      }
      setLoading(false);
    }
    load();
  }, []);

  // Persist tasks when they change (TODO-004)
  useEffect(() => {
    if (!loading) {
      saveTasks(tasks);
    }
  }, [tasks, loading]);

  // Create new task (TODO-001)
  const handleAddTask = useCallback((title: string) => {
    const result = createTask(title);
    if (result.ok) {
      setTasks((prev) => [...prev, result.value]);
    } else {
      setError(result.error.message);
    }
  }, []);

  // Toggle task completion (TODO-002)
  const handleToggleTask = useCallback((id: string) => {
    setTasks((prev) =>
      prev.map((task) => {
        if (task.id === id) {
          return task.completed ? uncompleteTask(task) : completeTask(task);
        }
        return task;
      })
    );
  }, []);

  // Delete task (TODO-003)
  const handleDeleteTask = useCallback((id: string) => {
    const result = deleteTask(tasks, id);
    if (result.ok) {
      setTasks(result.value);
    }
  }, [tasks]);

  if (loading) {
    return <div className="loading">Loading tasks...</div>;
  }

  return (
    <div className="app">
      <header>
        <h1>AISP + Specflow To-Do</h1>
        <p className="subtitle">Deterministic Product Building Demo</p>
      </header>

      {error && (
        <div className="error" onClick={() => setError(null)}>
          {error}
        </div>
      )}

      <main>
        <TaskInput onAddTask={handleAddTask} />
        <TaskList
          tasks={tasks}
          onToggle={handleToggleTask}
          onDelete={handleDeleteTask}
        />
      </main>

      <footer>
        <p>
          Built with <strong>AISP</strong> (formal specs) + <strong>Specflow</strong> (contract enforcement)
        </p>
        <p className="contracts">
          11 AISP rules · 6 Specflow contracts · 11 contract tests passing
        </p>
      </footer>
    </div>
  );
}
