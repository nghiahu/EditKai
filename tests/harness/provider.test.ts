import { describe, it, expect } from 'vitest';
import { MockLlmProvider, createLlmProvider } from '../../src/harness/provider';
import { buildSystemPrompt } from '../../src/harness/prompt';
import type { ChatMessage, ToolDefinition } from '../../src/harness/types';

describe('harness system prompt', () => {
  it('builds system prompt containing style and core rules', () => {
    const prompt = buildSystemPrompt('s1');
    expect(prompt).toContain('s1');
    expect(prompt).toContain('plan.json');
    expect(prompt).toContain('validate_plan');
  });
});

describe('harness provider', () => {
  it('MockLlmProvider returns scripted responses and records history', async () => {
    const mock = new MockLlmProvider([
      {
        message: {
          role: 'assistant',
          toolCalls: [
            {
              id: 'call_1',
              name: 'get_plan_summary',
              args: {},
            },
          ],
        },
        usage: { inputTokens: 100, outputTokens: 20 },
      },
      {
        message: {
          role: 'assistant',
          content: 'Đã hoàn tất chỉnh sửa.',
        },
        usage: { inputTokens: 150, outputTokens: 30 },
      },
    ]);

    const messages: ChatMessage[] = [{ role: 'user', content: 'Xem plan' }];
    const tools: ToolDefinition[] = [];

    const res1 = await mock.chat(messages, tools);
    expect(res1.message.toolCalls).toHaveLength(1);
    expect(res1.message.toolCalls![0].name).toBe('get_plan_summary');
    expect(res1.usage.inputTokens).toBe(100);

    const res2 = await mock.chat(messages, tools);
    expect(res2.message.content).toBe('Đã hoàn tất chỉnh sửa.');
  });

  it('createLlmProvider defaults to mock if no keys or specified', () => {
    const provider = createLlmProvider({ provider: 'mock' });
    expect(provider).toBeInstanceOf(MockLlmProvider);
  });
});
