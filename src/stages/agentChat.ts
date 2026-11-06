import { existsSync, readFileSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import * as readline from 'node:readline/promises';
import { stdin as input, stdout as output } from 'node:process';
import type { Plan } from '../plan/types';
import type { ChatMessage, LlmProvider, LlmUsage, TranscriptData, TurnLog } from '../harness/types';
import { createLlmProvider } from '../harness/provider';
import { runAgentLoop } from '../harness/loop';
import { validatePlanSchema } from '../plan/schema';
import { formatCost } from '../harness/observability';

export interface AgentChatStageOptions {
  prompt: string;
  apply?: boolean;
  provider?: LlmProvider;
  conversationHistory?: ChatMessage[];
  confirmFn?: (diffLines: string[]) => Promise<boolean>;
  verbose?: boolean;
}

export interface AgentChatStageResult {
  reply: string;
  hasChanges: boolean;
  applied: boolean;
  diffDescription: string[];
  draftPlan: Plan;
  costUsd: number;
  totalUsage: LlmUsage;
  turnLogs: TurnLog[];
  history: ChatMessage[];
}

export async function agentChatStage(
  projectDir: string,
  options: AgentChatStageOptions,
): Promise<AgentChatStageResult> {
  const planFile = join(projectDir, 'plan.json');
  if (!existsSync(planFile)) {
    throw new Error(`Chưa có plan.json trong ${projectDir}`);
  }

  const plan: Plan = JSON.parse(readFileSync(planFile, 'utf8'));

  let transcript: TranscriptData | undefined;
  const transcriptFile = join(projectDir, 'transcript.json');
  if (existsSync(transcriptFile)) {
    try {
      transcript = JSON.parse(readFileSync(transcriptFile, 'utf8'));
    } catch {
      // ignore
    }
  }

  const provider = options.provider ?? createLlmProvider();
  const loopResult = await runAgentLoop({
    userPrompt: options.prompt,
    projectDir,
    plan,
    transcript,
    provider,
    conversationHistory: options.conversationHistory,
    verbose: options.verbose ?? true,
  });

  let applied = false;
  if (loopResult.hasChanges) {
    let shouldApply = Boolean(options.apply);
    if (!shouldApply && options.confirmFn) {
      shouldApply = await options.confirmFn(loopResult.diffDescription);
    }

    if (shouldApply) {
      const check = validatePlanSchema(loopResult.draftPlan);
      if (!check.ok) {
        throw new Error(`Bản nháp không hợp lệ: ${check.issues.map(i => i.message).join('; ')}`);
      }
      writeFileSync(planFile, JSON.stringify(loopResult.draftPlan, null, 2));
      applied = true;
    }
  }

  return {
    reply: loopResult.reply,
    hasChanges: loopResult.hasChanges,
    applied,
    diffDescription: loopResult.diffDescription,
    draftPlan: loopResult.draftPlan,
    costUsd: loopResult.costUsd,
    totalUsage: loopResult.totalUsage,
    turnLogs: loopResult.turnLogs,
    history: loopResult.history,
  };
}

/** Interactive REPL chat session in terminal preserving conversation history across turns */
export async function agentChatInteractive(
  projectDir: string,
  options?: { provider?: LlmProvider },
): Promise<void> {
  const planFile = join(projectDir, 'plan.json');
  if (!existsSync(planFile)) {
    throw new Error(`Chưa có plan.json trong ${projectDir}`);
  }

  const rl = readline.createInterface({ input, output });
  const provider = options?.provider ?? createLlmProvider();
  let history: ChatMessage[] = [];
  let questionIndex = 0;

  console.log('\n======================================================');
  console.log('   EditKai AI Video Assistant (Chế độ tương tác)');
  console.log('   - Lưu lịch sử qua các câu hỏi');
  console.log('   - Quan sát từng lượt gọi tool & đo lường chi phí');
  console.log('   - Gõ "exit" hoặc "quit" để kết thúc');
  console.log('======================================================\n');

  try {
    while (true) {
      questionIndex++;
      const prompt = (await rl.question(`\n[Câu hỏi ${questionIndex}] > `)).trim();
      if (!prompt) continue;
      if (prompt.toLowerCase() === 'exit' || prompt.toLowerCase() === 'quit') {
        console.log('Đã kết thúc phiên trò chuyện.');
        break;
      }

      console.log('\nĐang xử lý...');
      const res = await agentChatStage(projectDir, {
        prompt,
        provider,
        conversationHistory: history,
        verbose: true,
        confirmFn: async diffLines => {
          console.log('\nĐề xuất thay đổi:');
          diffLines.forEach(d => console.log(`  ${d}`));
          const ans = (await rl.question('\nBạn có muốn áp dụng thay đổi này vào plan.json? (y/N): ')).trim().toLowerCase();
          return ans === 'y' || ans === 'yes';
        },
      });

      history = res.history;

      console.log(`\n[AI Trả lời]:\n${res.reply}`);
      if (res.hasChanges) {
        if (res.applied) {
          console.log('\n✓ Đã cập nhật thành công vào plan.json');
        } else {
          console.log('\n(Bỏ qua thay đổi đối với plan.json)');
        }
      }
      console.log(`[Thống kê]: Chi phí câu này: ${formatCost(res.costUsd)} | Tokens: ${res.totalUsage.inputTokens} in, ${res.totalUsage.outputTokens} out${res.totalUsage.cacheHit ? ` (Cache Hit: ${res.totalUsage.cachedTokens} tokens)` : ''}`);
    }
  } finally {
    rl.close();
  }
}
