import type { ToolDefinition } from '../types';
import type { TaskDiff, TaskItem, TaskPriority, TaskStatus, TaskStore } from './types';

export const TODO_TOOLS: ToolDefinition[] = [
  {
    name: 'list_tasks',
    description: 'Liệt kê danh sách công việc cá nhân. Hỗ trợ lọc theo trạng thái (todo, in_progress, done), mức độ ưu tiên (high, medium, low), hoặc từ khóa trong tiêu đề.',
    parameters: {
      type: 'object',
      properties: {
        status: {
          type: 'string',
          enum: ['todo', 'in_progress', 'done'],
          description: 'Lọc theo trạng thái công việc (để trống nếu muốn xem tất cả)',
        },
        priority: {
          type: 'string',
          enum: ['high', 'medium', 'low'],
          description: 'Lọc theo mức độ ưu tiên',
        },
        keyword: {
          type: 'string',
          description: 'Từ khóa tìm kiếm trong tiêu đề',
        },
      },
    },
  },
  {
    name: 'add_task',
    description: 'Thêm một công việc mới vào danh sách việc cần làm.',
    parameters: {
      type: 'object',
      properties: {
        title: {
          type: 'string',
          description: 'Tiêu đề hoặc nội dung việc cần làm',
        },
        priority: {
          type: 'string',
          enum: ['high', 'medium', 'low'],
          description: 'Mức độ ưu tiên (mặc định: medium)',
        },
        dueDate: {
          type: 'string',
          description: 'Hạn chót hoặc thời gian thực hiện (ví dụ: "Hôm nay 17h", "Sáng mai 9h", "2026-11-07")',
        },
        tags: {
          type: 'array',
          items: { type: 'string' },
          description: 'Danh sách nhãn phân loại (ví dụ: ["họp", "công việc", "cá nhân"])',
        },
      },
      required: ['title'],
    },
  },
  {
    name: 'update_task',
    description: 'Cập nhật thông tin công việc theo id (đổi tiêu đề, đổi trạng thái sang "done" hoặc "in_progress", đổi hạn chót, đổi độ ưu tiên).',
    parameters: {
      type: 'object',
      properties: {
        id: {
          type: 'string',
          description: 'ID của công việc cần cập nhật (ví dụ: "task-1")',
        },
        title: {
          type: 'string',
          description: 'Tiêu đề mới',
        },
        status: {
          type: 'string',
          enum: ['todo', 'in_progress', 'done'],
          description: 'Trạng thái mới của công việc',
        },
        priority: {
          type: 'string',
          enum: ['high', 'medium', 'low'],
          description: 'Mức độ ưu tiên mới',
        },
        dueDate: {
          type: 'string',
          description: 'Hạn chót mới',
        },
        tags: {
          type: 'array',
          items: { type: 'string' },
          description: 'Danh sách nhãn phân loại mới',
        },
      },
      required: ['id'],
    },
  },
  {
    name: 'delete_task',
    description: 'Xóa một công việc khỏi danh sách theo ID.',
    parameters: {
      type: 'object',
      properties: {
        id: {
          type: 'string',
          description: 'ID của công việc cần xóa (ví dụ: "task-1")',
        },
      },
      required: ['id'],
    },
  },
];

export function listTasks(
  store: TaskStore,
  filters?: { status?: TaskStatus; priority?: TaskPriority; keyword?: string },
): TaskItem[] {
  let result = [...store.tasks];
  if (filters?.status) {
    result = result.filter(t => t.status === filters.status);
  }
  if (filters?.priority) {
    result = result.filter(t => t.priority === filters.priority);
  }
  if (filters?.keyword) {
    const kw = filters.keyword.toLowerCase();
    result = result.filter(t => t.title.toLowerCase().includes(kw));
  }
  return result;
}

export function addTask(
  store: TaskStore,
  params: {
    title: string;
    priority?: TaskPriority;
    dueDate?: string;
    tags?: string[];
  },
): { ok: boolean; task?: TaskItem; error?: string } {
  const title = (params.title ?? '').trim();
  if (!title) {
    return { ok: false, error: 'Tiêu đề công việc không được để trống' };
  }

  // Generate friendly sequential id: task-1, task-2,...
  const existingNums = store.tasks
    .map(t => {
      const match = t.id.match(/^task-(\d+)$/);
      return match ? parseInt(match[1], 10) : 0;
    })
    .filter(n => !isNaN(n));
  const nextNum = (existingNums.length > 0 ? Math.max(...existingNums) : 0) + 1;
  const id = `task-${nextNum}`;

  const now = new Date().toISOString();
  const newTask: TaskItem = {
    id,
    title,
    status: 'todo',
    priority: params.priority ?? 'medium',
    ...(params.dueDate ? { dueDate: params.dueDate } : {}),
    ...(params.tags && params.tags.length > 0 ? { tags: params.tags } : {}),
    createdAt: now,
  };

  store.tasks.push(newTask);
  store.updatedAt = now;
  return { ok: true, task: newTask };
}

export function updateTask(
  store: TaskStore,
  id: string,
  patch: {
    title?: string;
    status?: TaskStatus;
    priority?: TaskPriority;
    dueDate?: string;
    tags?: string[];
  },
): { ok: boolean; task?: TaskItem; error?: string } {
  const target = store.tasks.find(t => t.id === id);
  if (!target) {
    return { ok: false, error: `Không tìm thấy công việc với ID: "${id}"` };
  }

  if (patch.title !== undefined) {
    const t = patch.title.trim();
    if (!t) return { ok: false, error: 'Tiêu đề công việc không được để trống' };
    target.title = t;
  }
  if (patch.status !== undefined) target.status = patch.status;
  if (patch.priority !== undefined) target.priority = patch.priority;
  if (patch.dueDate !== undefined) target.dueDate = patch.dueDate;
  if (patch.tags !== undefined) target.tags = patch.tags;

  const now = new Date().toISOString();
  target.updatedAt = now;
  store.updatedAt = now;

  return { ok: true, task: target };
}

export function deleteTask(
  store: TaskStore,
  id: string,
): { ok: boolean; deletedTask?: TaskItem; error?: string } {
  const idx = store.tasks.findIndex(t => t.id === id);
  if (idx === -1) {
    return { ok: false, error: `Không tìm thấy công việc với ID: "${id}" để xóa` };
  }

  const [deleted] = store.tasks.splice(idx, 1);
  store.updatedAt = new Date().toISOString();
  return { ok: true, deletedTask: deleted };
}

export function executeTodoTool(
  store: TaskStore,
  name: string,
  args: Record<string, unknown>,
): unknown {
  switch (name) {
    case 'list_tasks':
      return listTasks(store, {
        status: args.status as TaskStatus | undefined,
        priority: args.priority as TaskPriority | undefined,
        keyword: args.keyword ? String(args.keyword) : undefined,
      });
    case 'add_task':
      return addTask(store, {
        title: String(args.title ?? ''),
        priority: args.priority as TaskPriority | undefined,
        dueDate: args.dueDate ? String(args.dueDate) : undefined,
        tags: Array.isArray(args.tags) ? (args.tags as string[]) : undefined,
      });
    case 'update_task':
      return updateTask(store, String(args.id ?? ''), {
        title: args.title ? String(args.title) : undefined,
        status: args.status as TaskStatus | undefined,
        priority: args.priority as TaskPriority | undefined,
        dueDate: args.dueDate ? String(args.dueDate) : undefined,
        tags: Array.isArray(args.tags) ? (args.tags as string[]) : undefined,
      });
    case 'delete_task':
      return deleteTask(store, String(args.id ?? ''));
    default:
      throw new Error(`Không tìm thấy tool "${name}" trong Todo Harness`);
  }
}

export function diffTaskStore(
  original: TaskStore,
  current: TaskStore,
): { hasChanges: boolean; diff: TaskDiff; description: string[] } {
  const origMap = new Map(original.tasks.map(t => [t.id, t]));
  const currMap = new Map(current.tasks.map(t => [t.id, t]));

  const added: TaskItem[] = [];
  const updated: TaskDiff['updated'] = [];
  const deleted: TaskItem[] = [];
  const description: string[] = [];

  // Check added & updated
  for (const curr of current.tasks) {
    const orig = origMap.get(curr.id);
    if (!orig) {
      added.push(curr);
      const details: string[] = [];
      if (curr.priority && curr.priority !== 'medium') details.push(`Ưu tiên: ${curr.priority}`);
      if (curr.dueDate) details.push(`Hạn: ${curr.dueDate}`);
      const detailStr = details.length > 0 ? ` (${details.join(' | ')})` : '';
      description.push(`+ [Thêm mới] ${curr.id}: "${curr.title}"${detailStr}`);
    } else {
      const changes: Record<string, { from: unknown; to: unknown }> = {};
      const fields: Array<keyof TaskItem> = ['title', 'status', 'priority', 'dueDate'];
      for (const f of fields) {
        if (orig[f] !== curr[f]) {
          changes[f] = { from: orig[f], to: curr[f] };
        }
      }
      if (Object.keys(changes).length > 0) {
        updated.push({ id: curr.id, title: curr.title, changes });
        const changeDesc = Object.entries(changes)
          .map(([k, v]) => `${k}: ${String(v.from ?? 'chưa có')} ➔ ${String(v.to)}`)
          .join(', ');
        description.push(`~ [Cập nhật] ${curr.id} ("${curr.title}"): ${changeDesc}`);
      }
    }
  }

  // Check deleted
  for (const orig of original.tasks) {
    if (!currMap.has(orig.id)) {
      deleted.push(orig);
      description.push(`- [Xóa] ${orig.id}: "${orig.title}"`);
    }
  }

  const hasChanges = added.length > 0 || updated.length > 0 || deleted.length > 0;
  if (!hasChanges) {
    description.push('Không có thay đổi nào đối với danh sách công việc');
  }

  return {
    hasChanges,
    diff: { added, updated, deleted },
    description,
  };
}

