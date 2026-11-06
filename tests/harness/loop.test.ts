import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { readFileSync, rmSync, existsSync } from 'node:fs';
import { join } from 'node:path';
import type { Plan } from '../../src/plan/types';
import { runAgentLoop } from '../../src/harness/loop';
import { MockLlmProvider } from '../../src/harness/provider';

const loadValidPlan = (): Plan => JSON.parse(readFileSync('tests/fixtures/plan.valid.json', 'utf8'));
const tmpDir = 'tests/fixtures/tmp-loop-test';

describe('harness agent loop', () => {
  beforeEach(() => {
    rmSync(tmpDir, { recursive: true, force: true });
  });

  afterEach(() => {
    rmSync(tmpDir, { recursive: true, force: true });
  });

  it('runs conversation without tool calls and returns assistant reply', async () => {
    const plan = loadValidPlan();
    const provider = new MockLlmProvider([
      {
        message: {
          role: 'assistant',
          content: 'Kế hoạch hiện tại đã rất ổn, không cần chỉnh sửa gì.',
        },
        usage: { inputTokens: 120, outputTokens: 25 },
      },
    ]);

    const result = await runAgentLoop({
      userPrompt: 'Video này ổn chưa?',
      projectDir: tmpDir,
      plan,
      provider,
    });

    expect(result.reply).toBe('Kế hoạch hiện tại đã rất ổn, không cần chỉnh sửa gì.');
    expect(result.hasChanges).toBe(false);
    expect(result.turnCount).toBe(1);
    expect(result.totalUsage.inputTokens).toBe(120);
    expect(result.totalUsage.outputTokens).toBe(25);
  });

  it('executes tool calls in loop and computes diff', async () => {
    const plan = loadValidPlan();
    const targetLayerId = plan.layers[0].id;

    const provider = new MockLlmProvider([
      // Turn 1: tool call to patch layer
      {
        message: {
          role: 'assistant',
          toolCalls: [
            {
              id: 'call_patch',
              name: 'patch_layer',
              args: {
                id: targetLayerId,
                patch: { start: 0.1, props: { text: 'Nội dung cập nhật' } },
              },
            },
          ],
        },
        usage: { inputTokens: 200, outputTokens: 40 },
      },
      // Turn 2: final reply
      {
        message: {
          role: 'assistant',
          content: 'Tôi đã cập nhật nội dung và thời gian của layer đầu tiên.',
        },
        usage: { inputTokens: 250, outputTokens: 30 },
      },
    ]);

    const result = await runAgentLoop({
      userPrompt: 'Đổi chữ layer đầu',
      projectDir: tmpDir,
      plan,
      provider,
    });

    expect(result.turnCount).toBe(2);
    expect(result.hasChanges).toBe(true);
    expect(result.diff.updated).toHaveLength(1);
    expect(result.diff.updated[0].id).toBe(targetLayerId);
    expect(result.diffDescription.some(d => d.includes(targetLayerId))).toBe(true);
    expect(result.totalUsage.inputTokens).toBe(450);
  });

  it('stops at maxTurns and logs token usage', async () => {
    const plan = loadValidPlan();

    // Infinite tool calling loop
    const provider = new MockLlmProvider([
      {
        message: {
          role: 'assistant',
          toolCalls: [{ id: '1', name: 'get_plan_summary', args: {} }],
        },
        usage: { inputTokens: 100, outputTokens: 20 },
      },
      {
        message: {
          role: 'assistant',
          toolCalls: [{ id: '2', name: 'get_plan_summary', args: {} }],
        },
        usage: { inputTokens: 100, outputTokens: 20 },
      },
      {
        message: {
          role: 'assistant',
          toolCalls: [{ id: '3', name: 'get_plan_summary', args: {} }],
        },
        usage: { inputTokens: 100, outputTokens: 20 },
      },
    ]);

    const result = await runAgentLoop({
      userPrompt: 'Lặp lại',
      projectDir: tmpDir,
      plan,
      provider,
      maxTurns: 2,
    });

    expect(result.turnCount).toBe(2);
    expect(result.reply).toMatch(/giới hạn lượt/i);
  });
});
