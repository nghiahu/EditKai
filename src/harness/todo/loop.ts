import { appendFileSync, existsSync } from 'node:fs';
import { dirname } from 'node:path';
import type {
  ChatMessage,
  LlmProvider,
  LlmUsage,
  TurnLog,
  TurnToolExecution,
} from '../types';
import {
  calculateCostUsd,
  detectCacheHit,
  formatTurnObservability,
} from '../observability';
import { TODO_TOOLS, diffTaskStore, executeTodoTool } from './tools';
import { buildTodoSystemPrompt } from './prompt';
import type { TaskDiff, TaskStore } from './types';

export interface TodoRunOptions {
  userPrompt: string;
  store: TaskStore;
  provider: LlmProvider;
  conversationHistory?: ChatMessage[];
  maxTurns?: number;
  verbose?: boolean;
  logFile?: string;
  onTurn?: (log: TurnLog) => void;
}

export interface TodoRunResult {
  reply: string;
  hasChanges: boolean;
  diff: TaskDiff;
  diffDescription: string[];
  draftStore: TaskStore;
  totalUsage: LlmUsage;
  costUsd: number;
  turnCount: number;
  turnLogs: TurnLog[];
  history: ChatMessage[];
}

export async function runTodoAgentLoop(options: TodoRunOptions): Promise<TodoRunResult> {
  const {
    userPrompt,
    store,
    provider,
    conversationHistory = [],
    maxTurns = 5,
    verbose = false,
    logFile,
    onTurn,
  } = options;

  const draftStore: TaskStore = JSON.parse(JSON.stringify(store));

  const messages: ChatMessage[] = [];
  const hasSystem = conversationHistory.some(m => m.role === 'system');
  if (!hasSystem) {
    messages.push({
      role: 'system',
      content: buildTodoSystemPrompt(draftStore.owner),
    });
  }
  messages.push(...conversationHistory);
  messages.push({ role: 'user', content: userPrompt });

  const totalUsage: LlmUsage = { inputTokens: 0, outputTokens: 0, cachedTokens: 0 };
  const turnLogs: TurnLog[] = [];
  let turnCount = 0;
  let finalReply = '';

  for (let turn = 1; turn <= maxTurns; turn++) {
    turnCount = turn;
    const isFinalTurn = turn === maxTurns;

    // Lượt cuối: không truyền tool để ép mô hình trả lời bằng dữ liệu đã có
    const toolsForThisTurn = isFinalTurn ? [] : TODO_TOOLS;
    if (isFinalTurn && turn > 1) {
      messages.push({
        role: 'user',
        content:
          '[HỆ THỐNG]: Đã đến lượt cuối cùng. Không được gọi thêm công cụ nào nữa. Hãy sử dụng toàn bộ thông tin và kết quả từ các lượt trước để trả lời và tổng kết cho người dùng.',
      });
    }

    const response = await provider.chat(messages, toolsForThisTurn);

    totalUsage.inputTokens += response.usage.inputTokens;
    totalUsage.outputTokens += response.usage.outputTokens;
    if (response.usage.cachedTokens) {
      totalUsage.cachedTokens = (totalUsage.cachedTokens ?? 0) + response.usage.cachedTokens;
    }

    messages.push(response.message);

    const toolCalls = response.message.toolCalls;
    const toolExecutions: TurnToolExecution[] = [];

    if (toolCalls && toolCalls.length > 0 && !isFinalTurn) {
      for (const call of toolCalls) {
        try {
          const result = executeTodoTool(draftStore, call.name, call.args);
          toolExecutions.push({
            name: call.name,
            args: call.args,
            result,
            isError: false,
          });
          messages.push({
            role: 'tool',
            toolCallId: call.id,
            content: JSON.stringify(result),
          });
        } catch (err) {
          const errMsg = (err as Error).message;
          toolExecutions.push({
            name: call.name,
            args: call.args,
            result: { error: errMsg },
            isError: true,
          });
          messages.push({
            role: 'tool',
            toolCallId: call.id,
            content: JSON.stringify({ error: errMsg }),
          });
        }
      }
    }

    const turnLog: TurnLog = {
      turn,
      toolExecutions,
      responseText: response.message.content,
      usage: response.usage,
      costUsd: calculateCostUsd(response.usage),
    };

    turnLogs.push(turnLog);
    onTurn?.(turnLog);

    if (verbose) {
      formatTurnObservability(turnLog).forEach(line => console.log(line));
    }

    // Nếu mô hình trả về text mà không gọi thêm tool, hoặc đây là lượt cuối
    if (!toolCalls || toolCalls.length === 0 || isFinalTurn) {
      finalReply =
        response.message.content ||
        'Đã xử lý xong các thao tác công việc theo yêu cầu của bạn.';
      break;
    }
  }

  const { cacheHit, cachedTokens } = detectCacheHit(conversationHistory, totalUsage);
  if (cacheHit && !totalUsage.cachedTokens) {
    totalUsage.cachedTokens = cachedTokens;
  }
  const totalCostUsd = calculateCostUsd(totalUsage);

  const diffResult = diffTaskStore(store, draftStore);

  // Ghi log vào file nếu có đường dẫn
  if (logFile) {
    try {
      const logEntry = {
        timestamp: new Date().toISOString(),
        userPrompt,
        turnCount,
        cacheHit,
        totalUsage,
        costUsd: totalCostUsd,
        turns: turnLogs,
        hasChanges: diffResult.hasChanges,
        diffSummary: diffResult.description,
      };
      appendFileSync(logFile, JSON.stringify(logEntry) + '\n', 'utf8');
    } catch {
      // ignore log write errors
    }
  }

  return {
    reply: finalReply,
    hasChanges: diffResult.hasChanges,
    diff: diffResult.diff,
    diffDescription: diffResult.description,
    draftStore,
    totalUsage,
    costUsd: totalCostUsd,
    turnCount,
    turnLogs,
    history: messages.filter(m => m.role !== 'system'),
  };
}
