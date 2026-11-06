import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { join, resolve } from 'node:path';
import * as readline from 'node:readline/promises';
import { stdin as input, stdout as output } from 'node:process';
import type { ChatMessage, LlmProvider, LlmUsage, TurnLog } from '../harness/types';
import { createLlmProvider } from '../harness/provider';
import { runTodoAgentLoop } from '../harness/todo/loop';
import type { TaskItem, TaskStore } from '../harness/todo/types';
import { formatCost } from '../harness/observability';

export interface DemoTodoOptions {
  prompt: string;
  apply?: boolean;
  provider?: LlmProvider;
  conversationHistory?: ChatMessage[];
  confirmFn?: (diffLines: string[]) => Promise<boolean>;
  verbose?: boolean;
}

export interface DemoTodoResult {
  reply: string;
  hasChanges: boolean;
  applied: boolean;
  diffDescription: string[];
  draftStore: TaskStore;
  costUsd: number;
  totalUsage: LlmUsage;
  turnLogs: TurnLog[];
  history: ChatMessage[];
}

export function initDefaultTaskStore(): TaskStore {
  const now = new Date().toISOString();
  return {
    owner: 'Bạn',
    updatedAt: now,
    tasks: [
      {
        id: 'task-1',
        title: 'Hoàn thiện báo cáo tuần gửi quản lý',
        status: 'in_progress',
        priority: 'high',
        dueDate: 'Hôm nay 17:00',
        tags: ['công việc', 'báo cáo'],
        createdAt: now,
      },
      {
        id: 'task-2',
        title: 'Mua bánh sinh nhật cho mẹ',
        status: 'todo',
        priority: 'medium',
        dueDate: 'Thứ 7 tuần này',
        tags: ['gia đình'],
        createdAt: now,
      },
      {
        id: 'task-3',
        title: 'Đọc 20 trang sách Clean Code',
        status: 'done',
        priority: 'low',
        tags: ['học tập'],
        createdAt: now,
      },
    ],
  };
}

export function loadOrCreateTaskStore(dataDir: string): { store: TaskStore; taskFile: string; logFile: string } {
  mkdirSync(dataDir, { recursive: true });
  const taskFile = join(dataDir, 'tasks.json');
  const logFile = join(dataDir, 'tasks-log.jsonl');

  let store: TaskStore;
  if (!existsSync(taskFile)) {
    store = initDefaultTaskStore();
    writeFileSync(taskFile, JSON.stringify(store, null, 2), 'utf8');
  } else {
    try {
      store = JSON.parse(readFileSync(taskFile, 'utf8'));
      if (!Array.isArray(store.tasks)) {
        store.tasks = [];
      }
    } catch {
      store = initDefaultTaskStore();
      writeFileSync(taskFile, JSON.stringify(store, null, 2), 'utf8');
    }
  }

  return { store, taskFile, logFile };
}

export function formatTaskList(tasks: TaskItem[]): string {
  if (tasks.length === 0) return '(Danh sách công việc đang trống)';
  const lines: string[] = [];
  for (const t of tasks) {
    const icon = t.status === 'done' ? '✓' : t.status === 'in_progress' ? '⏳' : '○';
    const tagStr = t.tags && t.tags.length > 0 ? ` [${t.tags.join(', ')}]` : '';
    const dueStr = t.dueDate ? ` · Hạn: ${t.dueDate}` : '';
    const prioStr = t.priority === 'high' ? '🔥 HIGH' : t.priority === 'low' ? 'low' : 'medium';
    lines.push(`  [${icon}] ${t.id.padEnd(7)} ${t.title} (${prioStr}${dueStr})${tagStr}`);
  }
  return lines.join('\n');
}

export async function demoTodoStage(
  dataDir: string,
  options: DemoTodoOptions,
): Promise<DemoTodoResult> {
  const { store, taskFile, logFile } = loadOrCreateTaskStore(dataDir);
  const provider = options.provider ?? createLlmProvider();

  const loopResult = await runTodoAgentLoop({
    userPrompt: options.prompt,
    store,
    provider,
    conversationHistory: options.conversationHistory,
    verbose: options.verbose ?? true,
    logFile,
  });

  let applied = false;
  if (loopResult.hasChanges) {
    let shouldApply = Boolean(options.apply);
    if (!shouldApply && options.confirmFn) {
      shouldApply = await options.confirmFn(loopResult.diffDescription);
    }

    if (shouldApply) {
      writeFileSync(taskFile, JSON.stringify(loopResult.draftStore, null, 2), 'utf8');
      applied = true;
    }
  }

  return {
    reply: loopResult.reply,
    hasChanges: loopResult.hasChanges,
    applied,
    diffDescription: loopResult.diffDescription,
    draftStore: loopResult.draftStore,
    costUsd: loopResult.costUsd,
    totalUsage: loopResult.totalUsage,
    turnLogs: loopResult.turnLogs,
    history: loopResult.history,
  };
}

export async function demoTodoInteractive(
  dataDir: string,
  options?: { provider?: LlmProvider },
): Promise<void> {
  const { store: initialStore, taskFile } = loadOrCreateTaskStore(dataDir);
  const provider = options?.provider ?? createLlmProvider();
  const rl = readline.createInterface({ input, output });

  console.log('\n================================================================');
  console.log('   TRỢ LÝ QUẢN LÝ CÔNG VIỆC CÁ NHÂN (AGENT HARNESS DEMO)');
  console.log('================================================================');
  console.log(`📁 File dữ liệu: ${taskFile} (${initialStore.tasks.length} công việc)`);
  console.log('💡 Gợi ý câu lệnh mẫu:');
  console.log('   - "Thêm việc chuẩn bị tài liệu họp sáng mai lúc 9h độ ưu tiên cao"');
  console.log('   - "Đánh dấu task-1 là đã hoàn thành"');
  console.log('   - "Liệt kê các việc có mức ưu tiên high"');
  console.log('   - "Xóa task-3"');
  console.log('Lệnh nhanh: "list" (xem danh sách), "exit" hoặc "quit" (thoát)\n');

  let conversationHistory: ChatMessage[] = [];

  try {
    while (true) {
      const line = await rl.question('\n[Bạn]: ');
      const trimmed = line.trim();
      if (!trimmed) continue;
      if (['exit', 'quit', 'q'].includes(trimmed.toLowerCase())) {
        console.log('Tạm biệt!');
        break;
      }

      if (['list', 'ls', 'danh sach', 'danh sách'].includes(trimmed.toLowerCase())) {
        const currentData: TaskStore = JSON.parse(readFileSync(taskFile, 'utf8'));
        console.log('\n--- DANH SÁCH CÔNG VIỆC HIỆN TẠI ---');
        console.log(formatTaskList(currentData.tasks));
        continue;
      }

      const res = await demoTodoStage(dataDir, {
        prompt: trimmed,
        provider,
        conversationHistory,
        verbose: true,
        confirmFn: async (diffLines: string[]) => {
          console.log('\nThay đổi đề xuất (Diff):');
          diffLines.forEach(d => console.log(`  ${d}`));
          const ans = await rl.question('\nÁp dụng thay đổi vào tasks.json? (y/n) [y]: ');
          return ans.trim().toLowerCase() === '' || ans.trim().toLowerCase() === 'y';
        },
      });

      conversationHistory = res.history;

      console.log(`\n[Trợ lý AI]: ${res.reply}`);

      if (res.hasChanges) {
        if (res.applied) {
          console.log('✓ Đã lưu thay đổi vào tasks.json');
        } else {
          console.log('(Đã hủy thay đổi, không ghi vào file)');
        }
      }
    }
  } finally {
    rl.close();
  }
}
