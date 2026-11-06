import { appendFileSync, existsSync, mkdirSync } from 'node:fs';
import { join } from 'node:path';
import type { Plan } from '../plan/types';
import type {
  ChatMessage,
  HarnessContext,
  LlmProvider,
  LlmUsage,
  TranscriptData,
} from './types';
import { buildSystemPrompt } from './prompt';
import { HARNESS_TOOLS, executeHarnessTool } from './tools';
import { diffPlan, describePlanDiff, type PlanDiff } from './diff';

export interface AgentRunOptions {
  userPrompt: string;
  projectDir: string;
  plan: Plan;
  transcript?: TranscriptData;
  provider: LlmProvider;
  conversationHistory?: ChatMessage[];
  maxTurns?: number;
}

export interface AgentRunResult {
  reply: string;
  hasChanges: boolean;
  diff: PlanDiff;
  diffDescription: string[];
  draftPlan: Plan;
  totalUsage: LlmUsage;
  turnCount: number;
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
  let turnCount = 0;
  let finalReply = '';
  let hitTurnLimit = false;

  for (let turn = 1; turn <= maxTurns; turn++) {
    turnCount = turn;
    const response = await provider.chat(messages, HARNESS_TOOLS);

    totalUsage.inputTokens += response.usage.inputTokens;
    totalUsage.outputTokens += response.usage.outputTokens;
    if (response.usage.cachedTokens) {
      totalUsage.cachedTokens = (totalUsage.cachedTokens ?? 0) + response.usage.cachedTokens;
    }

    messages.push(response.message);

    const toolCalls = response.message.toolCalls;
    if (!toolCalls || toolCalls.length === 0) {
      finalReply = response.message.content ?? 'Đã hoàn tất yêu cầu.';
      break;
    }

    // Execute each tool call
    for (const call of toolCalls) {
      try {
        const result = await executeHarnessTool(ctx, call.name, call.args);
        messages.push({
          role: 'tool',
          toolCallId: call.id,
          content: JSON.stringify(result),
        });
      } catch (err) {
        messages.push({
          role: 'tool',
          toolCallId: call.id,
          content: JSON.stringify({ error: (err as Error).message }),
        });
      }
    }

    if (turn === maxTurns) {
      hitTurnLimit = true;
    }
  }

  if (hitTurnLimit && !finalReply) {
    finalReply = `Đã đạt giới hạn lượt xử lý (${maxTurns} lượt). Vui lòng kiểm tra thay đổi đề xuất hoặc hướng dẫn tiếp theo.`;
  }

  const diff = diffPlan(plan, draftPlan);
  const diffDescription = describePlanDiff(diff);

  // Write log to agent-log.jsonl if projectDir exists
  try {
    if (existsSync(projectDir)) {
      const logEntry = {
        timestamp: new Date().toISOString(),
        userPrompt,
        turnCount,
        inputTokens: totalUsage.inputTokens,
        outputTokens: totalUsage.outputTokens,
        cachedTokens: totalUsage.cachedTokens,
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
    turnCount,
    history: messages,
  };
}
