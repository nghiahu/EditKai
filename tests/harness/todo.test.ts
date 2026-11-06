import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { existsSync, mkdirSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import {
  TODO_TOOLS,
  addTask,
  updateTask,
  deleteTask,
  listTasks,
  executeTodoTool,
  diffTaskStore,
} from '../../src/harness/todo/tools';
import { runTodoAgentLoop } from '../../src/harness/todo/loop';
import { demoTodoStage, initDefaultTaskStore } from '../../src/stages/demoTodo';
import { MockLlmProvider } from '../../src/harness/provider';
import type { TaskStore } from '../../src/harness/todo/types';

describe('Todo Harness Tools', () => {
  let store: TaskStore;

  beforeEach(() => {
    store = initDefaultTaskStore();
  });

  it('listTasks lọc chính xác theo status và priority', () => {
    const all = listTasks(store);
    expect(all).toHaveLength(3);

    const inProgress = listTasks(store, { status: 'in_progress' });
    expect(inProgress).toHaveLength(1);
    expect(inProgress[0].id).toBe('task-1');

    const highPrio = listTasks(store, { priority: 'high' });
    expect(highPrio).toHaveLength(1);
    expect(highPrio[0].title).toContain('báo cáo');

    const byKeyword = listTasks(store, { keyword: 'Clean Code' });
    expect(byKeyword).toHaveLength(1);
    expect(byKeyword[0].id).toBe('task-3');
  });

  it('addTask thêm công việc mới với id tăng dần và kiểm tra validation', () => {
    const err = addTask(store, { title: '   ' });
    expect(err.ok).toBe(false);
    expect(err.error).toContain('không được để trống');

    const res = addTask(store, {
      title: 'Chuẩn bị slide thuyết trình',
      priority: 'high',
      dueDate: 'Sáng mai 9h',
      tags: ['họp', 'thuyết trình'],
    });

    expect(res.ok).toBe(true);
    expect(res.task?.id).toBe('task-4');
    expect(res.task?.status).toBe('todo');
    expect(res.task?.priority).toBe('high');
    expect(store.tasks).toHaveLength(4);
  });

  it('updateTask cập nhật thuộc tính và báo lỗi khi id không tồn tại', () => {
    const notFound = updateTask(store, 'task-999', { status: 'done' });
    expect(notFound.ok).toBe(false);
    expect(notFound.error).toContain('Không tìm thấy');

    const updated = updateTask(store, 'task-1', {
      status: 'done',
      priority: 'low',
      dueDate: 'Đã hoàn thành',
    });

    expect(updated.ok).toBe(true);
    expect(updated.task?.status).toBe('done');
    expect(updated.task?.priority).toBe('low');
    expect(updated.task?.dueDate).toBe('Đã hoàn thành');
  });

  it('deleteTask xóa công việc theo id', () => {
    const notFound = deleteTask(store, 'task-999');
    expect(notFound.ok).toBe(false);

    const res = deleteTask(store, 'task-2');
    expect(res.ok).toBe(true);
    expect(res.deletedTask?.id).toBe('task-2');
    expect(store.tasks.some(t => t.id === 'task-2')).toBe(false);
    expect(store.tasks).toHaveLength(2);
  });

  it('diffTaskStore phát hiện đầy đủ thêm, sửa, xóa với mô tả thân thiện', () => {
    const original = JSON.parse(JSON.stringify(store));
    const current = JSON.parse(JSON.stringify(store));

    // Thêm task-4
    addTask(current, { title: 'Việc mới', priority: 'high', dueDate: 'Ngày mai' });
    // Sửa task-1
    updateTask(current, 'task-1', { status: 'done' });
    // Xóa task-3
    deleteTask(current, 'task-3');

    const diffRes = diffTaskStore(original, current);
    expect(diffRes.hasChanges).toBe(true);
    expect(diffRes.diff.added).toHaveLength(1);
    expect(diffRes.diff.updated).toHaveLength(1);
    expect(diffRes.diff.deleted).toHaveLength(1);

    expect(diffRes.description.some(d => d.includes('[Thêm mới]'))).toBe(true);
    expect(diffRes.description.some(d => d.includes('[Cập nhật]'))).toBe(true);
    expect(diffRes.description.some(d => d.includes('[Xóa]'))).toBe(true);
  });
});

describe('Todo Agent Loop & Observability', () => {
  const testDir = join(__dirname, '..', '..', 'test-todo-tmp');
  const logFile = join(testDir, 'tasks-log.jsonl');

  beforeEach(() => {
    mkdirSync(testDir, { recursive: true });
  });

  afterEach(() => {
    if (existsSync(testDir)) {
      rmSync(testDir, { recursive: true, force: true });
    }
  });

  it('chạy loop thêm task thành công và ghi log observability', async () => {
    const store = initDefaultTaskStore();
    const provider = new MockLlmProvider();

    const res = await runTodoAgentLoop({
      userPrompt: 'Thêm việc chuẩn bị tài liệu họp sáng mai độ ưu tiên cao',
      store,
      provider,
      logFile,
      verbose: false,
    });

    expect(res.hasChanges).toBe(true);
    expect(res.turnCount).toBe(2);
    expect(res.diff.added).toHaveLength(1);
    expect(res.diff.added[0].title).toBe('chuẩn bị tài liệu họp sáng mai độ ưu tiên cao');
    expect(res.diff.added[0].priority).toBe('high');
    expect(res.reply).toContain('Tôi đã thêm');
    expect(res.costUsd).toBeGreaterThan(0);

    // Kiểm tra file log JSONL
    expect(existsSync(logFile)).toBe(true);
    const logContent = readFileSync(logFile, 'utf8');
    expect(logContent).toContain('add_task');
    expect(logContent).toContain('costUsd');
  });

  it('demoTodoStage khởi tạo dữ liệu và áp dụng thay đổi khi có cờ apply', async () => {
    const provider = new MockLlmProvider();

    // Lần 1: Không apply
    const resNoApply = await demoTodoStage(testDir, {
      prompt: 'Thêm việc tập gym buổi chiều',
      provider,
      apply: false,
      verbose: false,
    });

    expect(resNoApply.hasChanges).toBe(true);
    expect(resNoApply.applied).toBe(false);

    const onDisk1 = JSON.parse(readFileSync(join(testDir, 'tasks.json'), 'utf8'));
    expect(onDisk1.tasks.some((t: any) => t.title.includes('tập gym'))).toBe(false);

    // Lần 2: Có apply
    const resApply = await demoTodoStage(testDir, {
      prompt: 'Thêm việc tập gym buổi chiều',
      provider,
      apply: true,
      verbose: false,
    });

    expect(resApply.hasChanges).toBe(true);
    expect(resApply.applied).toBe(true);

    const onDisk2 = JSON.parse(readFileSync(join(testDir, 'tasks.json'), 'utf8'));
    expect(onDisk2.tasks.some((t: any) => t.title.includes('tập gym'))).toBe(true);
  });
});
