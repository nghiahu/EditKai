import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { mkdtempSync, mkdirSync, rmSync, writeFileSync, readFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { Readable } from 'node:stream';
import { EventEmitter } from 'node:events';
import { createEditorHandler } from '../../editor/server/server';
import { MockLlmProvider } from '../../src/harness/provider';
import type { Plan } from '../../src/plan/types';

let base: string, dir: string;
const fixture = () => readFileSync('tests/fixtures/plan.valid.json', 'utf8');

interface MockResponse {
  statusCode: number;
  headers: Record<string, string>;
  body: string;
  writeHead(status: number, headers?: Record<string, string>): MockResponse;
  setHeader(name: string, value: string): void;
  write(chunk: string): void;
  end(chunk?: string): void;
}

function createMockResponse(): { res: MockResponse; done: Promise<{ status: number; body: string; json: () => unknown }> } {
  let resolveDone: (val: { status: number; body: string; json: () => unknown }) => void;
  const done = new Promise<{ status: number; body: string; json: () => unknown }>(r => (resolveDone = r));

  const res: MockResponse = {
    statusCode: 200,
    headers: {},
    body: '',
    writeHead(status, headers = {}) {
      this.statusCode = status;
      Object.assign(this.headers, headers);
      return this;
    },
    setHeader(name, value) {
      this.headers[name.toLowerCase()] = value;
    },
    write(chunk) {
      this.body += chunk;
    },
    end(chunk = '') {
      this.body += chunk;
      resolveDone({
        status: this.statusCode,
        body: this.body,
        json: () => JSON.parse(this.body),
      });
    },
  };

  return { res, done };
}

function dispatch(
  handler: (req: any, res: any) => void,
  method: string,
  url: string,
  body?: unknown,
): Promise<{ status: number; body: string; json: () => any }> {
  const payload = body !== undefined ? JSON.stringify(body) : '';
  const req = new Readable({
    read() {
      if (payload) this.push(payload);
      this.push(null);
    },
  }) as any;

  req.method = method;
  req.url = url;
  req.headers = {
    origin: 'http://127.0.0.1:5187',
    'content-type': 'application/json',
  };

  const { res, done } = createMockResponse();
  handler(req, res);
  return done;
}

describe('editor agent api', () => {
  beforeEach(() => {
    base = mkdtempSync(join(tmpdir(), 'editkai-agent-'));
    dir = join(base, 'dự án');
    mkdirSync(dir);
    writeFileSync(join(dir, 'plan.json'), fixture());
  });

  afterEach(() => {
    rmSync(base, { recursive: true, force: true });
  });

  it('POST /api/agent/chat rejects empty message with 400', async () => {
    const handler = createEditorHandler(dir);
    const res = await dispatch(handler, 'POST', '/api/agent/chat', {});
    expect(res.status).toBe(400);
  });

  it('POST /api/agent/chat runs harness and returns pending diff, then applies on confirmation', async () => {
    const mockProvider = new MockLlmProvider([
      {
        message: {
          role: 'assistant',
          toolCalls: [
            {
              id: 'call_1',
              name: 'patch_layer',
              args: { id: 'l1', patch: { start: 0.1 } },
            },
          ],
        },
        usage: { inputTokens: 50, outputTokens: 10 },
      },
      {
        message: {
          role: 'assistant',
          content: 'Đã đổi thời gian layer l1 sang 0.1s.',
        },
        usage: { inputTokens: 60, outputTokens: 10 },
      },
    ]);

    const pendingPlans = new Map<string, Plan>();
    const handler = createEditorHandler(dir, 'http://127.0.0.1:5187', {
      llmProvider: mockProvider,
      pendingPlans,
    });

    const res = await dispatch(handler, 'POST', '/api/agent/chat', { message: 'Sửa layer l1' });

    expect(res.status).toBe(200);
    const data = res.json();
    expect(data.hasChanges).toBe(true);
    expect(data.reply).toBe('Đã đổi thời gian layer l1 sang 0.1s.');
    expect(data.pendingId).toBeDefined();
    expect(data.diffDescription.some((d: string) => d.includes('l1'))).toBe(true);

    // Plan on disk must NOT have changed yet!
    const diskPlanBefore = JSON.parse(readFileSync(join(dir, 'plan.json'), 'utf8'));
    expect(diskPlanBefore.layers.find((l: { id: string }) => l.id === 'l1').start).not.toBe(0.1);

    // Now apply
    const applyRes = await dispatch(handler, 'POST', '/api/agent/apply', { pendingId: data.pendingId });
    expect(applyRes.status).toBe(200);

    // Disk plan must now be updated
    const diskPlanAfter = JSON.parse(readFileSync(join(dir, 'plan.json'), 'utf8'));
    expect(diskPlanAfter.layers.find((l: { id: string }) => l.id === 'l1').start).toBe(0.1);
  });
});
