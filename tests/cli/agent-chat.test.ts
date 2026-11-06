import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { mkdtempSync, rmSync, readFileSync, writeFileSync, mkdirSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { agentChatStage } from '../../src/stages/agentChat';
import { MockLlmProvider } from '../../src/harness/provider';
import { runCli } from '../../src/cli';

let base: string, dir: string;
const fixture = () => readFileSync('tests/fixtures/plan.valid.json', 'utf8');

describe('agentChatStage', () => {
  beforeEach(() => {
    base = mkdtempSync(join(tmpdir(), 'editkai-chat-'));
    dir = join(base, 'dự án');
    mkdirSync(dir);
    writeFileSync(join(dir, 'plan.json'), fixture());
  });

  afterEach(() => {
    rmSync(base, { recursive: true, force: true });
  });

  it('runs agentChatStage without apply: leaves plan unchanged', async () => {
    const mockProvider = new MockLlmProvider([
      {
        message: {
          role: 'assistant',
          toolCalls: [
            {
              id: 'call_1',
              name: 'patch_layer',
              args: { id: 'l1', patch: { start: 0.2 } },
            },
          ],
        },
        usage: { inputTokens: 50, outputTokens: 10 },
      },
      {
        message: {
          role: 'assistant',
          content: 'Đã đề xuất đổi start thành 0.2s',
        },
        usage: { inputTokens: 60, outputTokens: 10 },
      },
    ]);

    const res = await agentChatStage(dir, {
      prompt: 'Sửa layer l1',
      apply: false,
      provider: mockProvider,
    });

    expect(res.hasChanges).toBe(true);
    expect(res.applied).toBe(false);
    expect(res.reply).toBe('Đã đề xuất đổi start thành 0.2s');

    // On disk, untouched
    const diskPlan = JSON.parse(readFileSync(join(dir, 'plan.json'), 'utf8'));
    expect(diskPlan.layers[0].start).not.toBe(0.2);
  });

  it('runs agentChatStage with apply: updates plan.json on disk', async () => {
    const mockProvider = new MockLlmProvider([
      {
        message: {
          role: 'assistant',
          toolCalls: [
            {
              id: 'call_1',
              name: 'patch_layer',
              args: { id: 'l1', patch: { start: 0.2 } },
            },
          ],
        },
        usage: { inputTokens: 50, outputTokens: 10 },
      },
      {
        message: {
          role: 'assistant',
          content: 'Đã sửa start thành 0.2s',
        },
        usage: { inputTokens: 60, outputTokens: 10 },
      },
    ]);

    const res = await agentChatStage(dir, {
      prompt: 'Sửa layer l1',
      apply: true,
      provider: mockProvider,
    });

    expect(res.hasChanges).toBe(true);
    expect(res.applied).toBe(true);

    // On disk, updated!
    const diskPlan = JSON.parse(readFileSync(join(dir, 'plan.json'), 'utf8'));
    expect(diskPlan.layers[0].start).toBe(0.2);
  });

  it('runCli chat prints reply and diff', async () => {
    const out: string[] = [];
    const err: string[] = [];

    // CLI invocation with missing --prompt
    const code = await runCli(['chat', dir], s => out.push(s), s => err.push(s));
    expect(code).toBe(2);
    expect(err[0]).toMatch(/--prompt/);
  });
});
