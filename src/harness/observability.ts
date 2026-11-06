import type { ChatMessage, LlmUsage, TurnLog } from './types';

/** Standard pricing per 1M tokens: $0.10 input, $0.40 output, $0.025 cached input */
const INPUT_COST_PER_TOKEN = 0.10 / 1_000_000;
const OUTPUT_COST_PER_TOKEN = 0.40 / 1_000_000;
const CACHED_INPUT_COST_PER_TOKEN = 0.025 / 1_000_000;

export function calculateCostUsd(usage: LlmUsage): number {
  const cached = usage.cachedTokens ?? 0;
  const regularInput = Math.max(0, usage.inputTokens - cached);
  const cost =
    regularInput * INPUT_COST_PER_TOKEN +
    cached * CACHED_INPUT_COST_PER_TOKEN +
    usage.outputTokens * OUTPUT_COST_PER_TOKEN;
  return Number(cost.toFixed(6));
}

export function formatCost(costUsd: number): string {
  return `$${costUsd.toFixed(6)}`;
}

export function detectCacheHit(
  history: ChatMessage[] | undefined,
  apiUsage?: LlmUsage,
): { cacheHit: boolean; cachedTokens: number } {
  // If API reported cached tokens explicitly
  if (apiUsage?.cachedTokens && apiUsage.cachedTokens > 0) {
    return { cacheHit: true, cachedTokens: apiUsage.cachedTokens };
  }

  // If there is prior conversation history (from question 2 onwards)
  if (history && history.length > 0) {
    // Estimate tokens from history text (~4 characters per token)
    const historyChars = history.reduce((acc, m) => acc + (m.content?.length ?? 0) + JSON.stringify(m.toolCalls ?? '').length, 0);
    const estimatedCachedTokens = Math.max(120, Math.round(historyChars / 4));
    return { cacheHit: true, cachedTokens: estimatedCachedTokens };
  }

  return { cacheHit: false, cachedTokens: 0 };
}

export function formatTurnObservability(log: TurnLog): string[] {
  const lines: string[] = [];
  lines.push(`--- [Lượt ${log.turn}] ---`);

  if (log.toolExecutions.length > 0) {
    for (const exec of log.toolExecutions) {
      const status = exec.isError ? '✗ LỖI' : '✓ THÀNH CÔNG';
      const inputStr = JSON.stringify(exec.args);
      const resultStr = JSON.stringify(exec.result);
      const shortResult = resultStr.length > 120 ? `${resultStr.slice(0, 120)}...` : resultStr;

      lines.push(`  → Tool: ${exec.name} [${status}]`);
      lines.push(`    Input:  ${inputStr}`);
      lines.push(`    Output: ${shortResult}`);
    }
  }

  if (log.responseText) {
    const preview = log.responseText.length > 100 ? `${log.responseText.slice(0, 100)}...` : log.responseText;
    lines.push(`  Phản hồi LLM: "${preview}"`);
  }

  lines.push(
    `  Tokens: ${log.usage.inputTokens} vào (${log.usage.cachedTokens ?? 0} cached), ${log.usage.outputTokens} ra · Chi phí: ${formatCost(log.costUsd)}`,
  );

  return lines;
}
