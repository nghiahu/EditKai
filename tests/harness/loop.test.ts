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
    expect(result.costUsd).toBeGreaterThan(0);
    expect(result.turnLogs).toHaveLength(1);
  });

  it('executes tool calls in loop and records observability log', async () => {
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

    // Observability checks: each turn records tool, input, output, cost
    expect(result.turnLogs).toHaveLength(2);
    expect(result.turnLogs[0].toolExecutions).toHaveLength(1);
    expect(result.turnLogs[0].toolExecutions[0].name).toBe('patch_layer');
    expect(result.turnLogs[0].toolExecutions[0].isError).toBe(false);
    expect(result.turnLogs[0].costUsd).toBeGreaterThan(0);
    expect(result.costUsd).toBeGreaterThan(0);
  });

  it('at final turn: stops tools and forces model to answer with existing information', async () => {
    const plan = loadValidPlan();

    const provider = new MockLlmProvider([
      // Turn 1: tool call
      {
        message: {
          role: 'assistant',
          toolCalls: [{ id: '1', name: 'get_plan_summary', args: {} }],
        },
        usage: { inputTokens: 100, outputTokens: 20 },
      },
      // Turn 2 (final turn): model is forced to answer with text using information already gathered
      {
        message: {
          role: 'assistant',
          content: 'Dựa trên thông tin đã thu thập từ plan, video có 5 layer và thời lượng 30s.',
        },
        usage: { inputTokens: 150, outputTokens: 35 },
      },
    ]);

    const result = await runAgentLoop({
      userPrompt: 'Tóm tắt video',
      projectDir: tmpDir,
      plan,
      provider,
      maxTurns: 2,
    });

    expect(result.turnCount).toBe(2);
    // Verified: The model provided answer based on gathered info
    expect(result.reply).toBe('Dựa trên thông tin đã thu thập từ plan, video có 5 layer và thời lượng 30s.');

    // Verify tools were omitted on the final turn (provider.callHistory[1].tools was empty)
    expect(provider.callHistory[1].tools).toHaveLength(0);
  });

  it('detects cache hit from the second question onwards', async () => {
    const plan = loadValidPlan();
    const provider = new MockLlmProvider([
      {
        message: { role: 'assistant', content: 'Video dài 10 giây.' },
        usage: { inputTokens: 100, outputTokens: 15 },
      },
      {
        message: { role: 'assistant', content: 'Lớp đó có màu xanh lam.' },
        usage: { inputTokens: 180, outputTokens: 20 },
      },
    ]);

    // Question 1
    const res1 = await runAgentLoop({
      userPrompt: 'Video dài bao nhiêu?',
      projectDir: tmpDir,
      plan,
      provider,
    });
    expect(res1.totalUsage.cacheHit).toBeFalsy();

    // Question 2 (builds on Question 1 history)
    const res2 = await runAgentLoop({
      userPrompt: 'Lớp đầu tiên màu gì?',
      projectDir: tmpDir,
      plan,
      provider,
      conversationHistory: res1.history,
    });

    // Cache hit detected from question 2 onwards!
    expect(res2.totalUsage.cacheHit).toBe(true);
    expect(res2.totalUsage.cachedTokens).toBeGreaterThan(0);
  });
});
