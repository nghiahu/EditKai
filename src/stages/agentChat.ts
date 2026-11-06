import { existsSync, readFileSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import type { Plan } from '../plan/types';
import type { LlmProvider, TranscriptData } from '../harness/types';
import { createLlmProvider } from '../harness/provider';
import { runAgentLoop } from '../harness/loop';
import { validatePlanSchema } from '../plan/schema';

export interface AgentChatStageOptions {
  prompt: string;
  apply?: boolean;
  provider?: LlmProvider;
  confirmFn?: (diffLines: string[]) => Promise<boolean>;
}

export interface AgentChatStageResult {
  reply: string;
  hasChanges: boolean;
  applied: boolean;
  diffDescription: string[];
  draftPlan: Plan;
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
  };
}
