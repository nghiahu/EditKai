import { appendFileSync, existsSync } from 'node:fs';
import { join } from 'node:path';
import type { Plan } from '../plan/types';
import type {
  ChatMessage,
  HarnessContext,
  LlmProvider,
  LlmUsage,
  TranscriptData,
  TurnLog,
  TurnToolExecution,
} from './types';
import { buildSystemPrompt } from './prompt';
import { HARNESS_TOOLS, executeHarnessTool } from './tools';
import { diffPlan, describePlanDiff, type PlanDiff } from './diff';
import {
  calculateCostUsd,
  detectCacheHit,
  formatCost,
  formatTurnObservability,
} from './observability';

export interface AgentRunOptions {
  userPrompt: string;
  projectDir: string;
  plan: Plan;
  transcript?: TranscriptData;
  provider: LlmProvider;
  conversationHistory?: ChatMessage[];
  maxTurns?: number;
  verbose?: boolean;
  onTurn?: (log: TurnLog) => void;
}

export interface AgentRunResult {
  reply: string;
  hasChanges: boolean;
  diff: PlanDiff;
  diffDescription: string[];
  draftPlan: Plan;
  totalUsage: LlmUsage;
  costUsd: number;
  turnCount: number;
  turnLogs: TurnLog[];
  history: ChatMessage[];
}

export async function runAgentLoop(options: AgentRunOptions): Promise<AgentRunResult> {
  const {
    userPrompt,
    projectDir,
    plan,
    transcript,
    provider,
    conversationHistory = [],
    maxTurns = 5,
    verbose = false,
    onTurn,
  } = options;

  const draftPlan: Plan = JSON.parse(JSON.stringify(plan));
  const ctx: HarnessContext = {
    draftPlan,
    projectDir,
    transcript,
  };

  const messages: ChatMessage[] = [];
  const hasSystem = conversationHistory.some(m => m.role === 'system');
  if (!hasSystem) {
    messages.push({
      role: 'system',
      content: buildSystemPrompt(draftPlan.meta.style),
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

    // Ở lượt cuối: không truyền tool, ép mô hình phải trả lời bằng thông tin đã có
    const toolsForThisTurn = isFinalTurn ? [] : HARNESS_TOOLS;
    if (isFinalTurn && turn > 1) {
      messages.push({
        role: 'user',
        content:
          '[HỆ THỐNG]: Đã đến lượt cuối cùng. Không được gọi thêm công cụ nào nữa. Hãy sử dụng toàn bộ thông tin và kết quả bạn đã thu thập được từ các lượt trước để trả lời và giải thích cho người dùng.',
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

    // Nếu có tool calls và chưa phải lượt cuối
    if (toolCalls && toolCalls.length > 0 && !isFinalTurn) {
      for (const call of toolCalls) {
        try {
          const result = await executeHarnessTool(ctx, call.name, call.args);
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

    // Nếu mô hình trả về text mà không gọi thêm tool nào, hoặc đây là lượt cuối
    if (!toolCalls || toolCalls.length === 0 || isFinalTurn) {
      finalReply = response.message.content ?? 'Đã hoàn tất yêu cầu.';
      break;
    }
  }

  // Phát hiện và ghi nhận cache hit từ câu hỏi thứ 2 trở đi
  const cacheInfo = detectCacheHit(conversationHistory, totalUsage);
  if (cacheInfo.cacheHit) {
    totalUsage.cacheHit = true;
    totalUsage.cachedTokens = Math.max(totalUsage.cachedTokens ?? 0, cacheInfo.cachedTokens);
  }

  const costUsd = calculateCostUsd(totalUsage);
  const diff = diffPlan(plan, draftPlan);
  const diffDescription = describePlanDiff(diff);

  if (verbose) {
    if (totalUsage.cacheHit) {
      console.log(`[CACHE HIT] Tái sử dụng ngữ cảnh từ câu hỏi trước: ${totalUsage.cachedTokens} tokens (tiết kiệm chi phí & giảm độ trễ)!`);
    }
    console.log(`[Observability] Tổng chi phí: ${formatCost(costUsd)} (${totalUsage.inputTokens} in, ${totalUsage.outputTokens} out, ${totalUsage.cachedTokens ?? 0} cached)`);
  }

  // Ghi log chi tiết từng lượt vào agent-log.jsonl
  try {
    if (existsSync(projectDir)) {
      const logEntry = {
        timestamp: new Date().toISOString(),
        userPrompt,
        turnCount,
        cacheHit: Boolean(totalUsage.cacheHit),
        totalUsage,
        costUsd,
        turns: turnLogs,
        hasChanges: diff.hasChanges,
        diffSummary: diffDescription,
      };
      appendFileSync(join(projectDir, 'agent-log.jsonl'), JSON.stringify(logEntry) + '\n');
    }
  } catch {
    // Non-fatal logging failure
  }

  return {
    reply: finalReply,
    hasChanges: diff.hasChanges,
    diff,
    diffDescription,
    draftPlan,
    totalUsage,
    costUsd,
    turnCount,
    turnLogs,
    history: messages,
  };
}
