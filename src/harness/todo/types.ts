import type { ToolDefinition } from '../types';

export type TaskStatus = 'todo' | 'in_progress' | 'done';
export type TaskPriority = 'high' | 'medium' | 'low';

export interface TaskItem {
  id: string;
  title: string;
  status: TaskStatus;
  priority: TaskPriority;
  dueDate?: string;
  tags?: string[];
  createdAt: string;
  updatedAt?: string;
}

export interface TaskStore {
  owner: string;
  updatedAt: string;
  tasks: TaskItem[];
}

export interface TaskChange {
  from: unknown;
  to: unknown;
}

export interface TaskDiff {
  added: TaskItem[];
  updated: Array<{
    id: string;
    title: string;
    changes: Record<string, TaskChange>;
  }>;
  deleted: TaskItem[];
}

