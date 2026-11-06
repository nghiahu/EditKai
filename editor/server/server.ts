import { createServer, type IncomingMessage, type ServerResponse } from 'node:http';
import { createHash } from 'node:crypto';
import { existsSync, readFileSync, watch, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import type { AddressInfo } from 'node:net';
import { serveFile } from '../../src/media/serve';
import { checkProject } from '../../src/stages/qa';
import { validatePlanSchema } from '../../src/plan/schema';
import { loadTheme } from '../../src/style/theme';
import type { Plan } from '../../src/plan/types';
import type { LlmProvider, ChatMessage, TranscriptData } from '../../src/harness/types';
import { createLlmProvider } from '../../src/harness/provider';
import { runAgentLoop } from '../../src/harness/loop';

const root = join(dirname(fileURLToPath(import.meta.url)), '..', '..');
const hash = (s: string) => createHash('sha1').update(s).digest('hex');

export function createEditorHandler(
  projectDir: string,
  allowedOrigin = 'http://127.0.0.1:5187',
  options?: {
    llmProvider?: LlmProvider;
    pendingPlans?: Map<string, Plan>;
    onPlanSaved?: (hash: string) => void;
    clients?: Set<ServerResponse>;
  },
): (req: IncomingMessage, res: ServerResponse) => void {
  const planFile = join(projectDir, 'plan.json');
  const transcriptFile = join(projectDir, 'transcript.json');
  const pendingPlans = options?.pendingPlans ?? new Map<string, Plan>();
  const clients = options?.clients ?? new Set<ServerResponse>();

  const json = (res: ServerResponse, status: number, body: unknown) =>
    res.writeHead(status, { 'Content-Type': 'application/json' }).end(JSON.stringify(body));

  return (req, res) => {
    const origin = req.headers.origin;
    if (origin === allowedOrigin) {
      res.setHeader('Access-Control-Allow-Origin', allowedOrigin);
      res.setHeader('Vary', 'Origin');
      res.setHeader('Access-Control-Allow-Methods', 'GET, PUT, POST, OPTIONS');
      res.setHeader('Access-Control-Allow-Headers', 'content-type');
    }
    const url = req.url ?? '/';
    if (origin && origin !== allowedOrigin && (req.method === 'PUT' || req.method === 'POST')) {
      json(res, 403, { error: 'Origin không được phép' });
      return;
    }
    if (req.method === 'OPTIONS') {
      res.writeHead(204).end();
      return;
    }

    if (url.startsWith('/media/')) {
      serveFile(projectDir, url.slice('/media/'.length), req, res);
      return;
    }
    if (url === '/api/events') {
      res.writeHead(200, {
        'Content-Type': 'text/event-stream',
        'Cache-Control': 'no-cache',
        Connection: 'keep-alive',
      });
      res.write(': connected\n\n');
      clients.add(res);
      req.on('close', () => clients.delete(res));
      return;
    }
    if (url === '/api/plan' && req.method === 'GET') {
      if (!existsSync(planFile)) return json(res, 404, { error: 'Chưa có plan.json' });
      res.writeHead(200, { 'Content-Type': 'application/json' }).end(readFileSync(planFile, 'utf8'));
      return;
    }
    if (url === '/api/theme' && req.method === 'GET') {
      try {
        const plan = JSON.parse(readFileSync(planFile, 'utf8'));
        return json(res, 200, loadTheme(join(root, 'styles', plan.meta.style)));
      } catch (e) {
        return json(res, 404, { error: (e as Error).message });
      }
    }
    if (url === '/api/plan' && req.method === 'PUT') {
      let body = '';
      req.on('data', d => (body += d));
      req.on('end', () => {
        let plan: unknown;
        try {
          plan = JSON.parse(body);
        } catch {
          return json(res, 400, { error: 'Nội dung không phải JSON' });
        }
        const check = validatePlanSchema(plan);
        if (!check.ok) return json(res, 422, { issues: check.issues });
        const text = JSON.stringify(plan, null, 2);
        const h = hash(text);
        writeFileSync(planFile, text);
        options?.onPlanSaved?.(h);
        res.writeHead(204).end();
      });
      return;
    }
    if (url === '/api/validate' && req.method === 'GET') {
      checkProject(projectDir).then(
        issues => json(res, 200, { issues }),
        e => json(res, 404, { error: (e as Error).message }),
      );
      return;
    }
    if (url === '/api/render' && req.method === 'POST') {
      import('../../src/stages/render')
        .then(m => m.renderStage(projectDir))
        .then(out => json(res, 200, { out }))
        .catch(e => json(res, 500, { error: (e as Error).message }));
      return;
    }

    // --- AGENT HARNESS ENDPOINTS ---
    if (url === '/api/agent/chat' && req.method === 'POST') {
      let body = '';
      req.on('data', d => (body += d));
      req.on('end', async () => {
        let payload: { message?: string; history?: ChatMessage[] } = {};
        try {
          payload = JSON.parse(body || '{}');
        } catch {
          return json(res, 400, { error: 'Nội dung không phải JSON' });
        }

        if (!payload.message || typeof payload.message !== 'string') {
          return json(res, 400, { error: 'message là chuỗi bắt buộc' });
        }

        if (!existsSync(planFile)) {
          return json(res, 404, { error: 'Chưa có plan.json' });
        }

        let plan: Plan;
        try {
          plan = JSON.parse(readFileSync(planFile, 'utf8'));
        } catch (e) {
          return json(res, 500, { error: `Lỗi đọc plan.json: ${(e as Error).message}` });
        }

        let transcript: TranscriptData | undefined;
        if (existsSync(transcriptFile)) {
          try {
            transcript = JSON.parse(readFileSync(transcriptFile, 'utf8'));
          } catch {
            // ignore
          }
        }

        const provider = options?.llmProvider ?? createLlmProvider();
        try {
          const result = await runAgentLoop({
            userPrompt: payload.message,
            projectDir,
            plan,
            transcript,
            provider,
            conversationHistory: payload.history,
          });

          const pendingId = createHash('sha1')
            .update(`${Date.now()}-${Math.random()}`)
            .digest('hex')
            .slice(0, 12);

          pendingPlans.set(pendingId, result.draftPlan);

          return json(res, 200, {
            reply: result.reply,
            hasChanges: result.hasChanges,
            diff: result.diff,
            diffDescription: result.diffDescription,
            draftPlan: result.draftPlan,
            pendingId,
            turnCount: result.turnCount,
            totalUsage: result.totalUsage,
            costUsd: result.costUsd,
            turnLogs: result.turnLogs,
          });
        } catch (e) {
          return json(res, 500, { error: (e as Error).message });
        }
      });
      return;
    }

    if (url === '/api/agent/apply' && req.method === 'POST') {
      let body = '';
      req.on('data', d => (body += d));
      req.on('end', () => {
        let payload: { pendingId?: string; plan?: Plan } = {};
        try {
          payload = JSON.parse(body || '{}');
        } catch {
          return json(res, 400, { error: 'Nội dung không phải JSON' });
        }

        let planToSave: Plan | undefined = payload.plan;
        if (payload.pendingId) {
          planToSave = pendingPlans.get(payload.pendingId);
          if (!planToSave) {
            return json(res, 404, { error: `Không tìm thấy bản nháp với pendingId: ${payload.pendingId}` });
          }
        }

        if (!planToSave) {
          return json(res, 400, { error: 'Cần có pendingId hoặc plan để áp dụng' });
        }

        const check = validatePlanSchema(planToSave);
        if (!check.ok) return json(res, 422, { issues: check.issues });

        const text = JSON.stringify(planToSave, null, 2);
        const h = hash(text);
        writeFileSync(planFile, text);
        options?.onPlanSaved?.(h);
        if (payload.pendingId) pendingPlans.delete(payload.pendingId);

        return json(res, 200, { ok: true });
      });
      return;
    }

    res.writeHead(404).end();
  };
}

/** Only `allowedOrigin` (the Vite editor page) may call this API from a browser; other origins cannot read it or change anything. */
export async function startEditorServer(
  projectDir: string,
  port = 5186,
  allowedOrigin = 'http://127.0.0.1:5187',
  llmProvider?: LlmProvider,
): Promise<{ url: string; close(): Promise<void> }> {
  const planFile = join(projectDir, 'plan.json');
  const clients = new Set<ServerResponse>();
  let lastWritten = existsSync(planFile) ? hash(readFileSync(planFile, 'utf8')) : '';
  let timer: NodeJS.Timeout | undefined;

  // fs.watch fires several events per write; debounce, then ignore content this server wrote itself.
  const watcher = watch(projectDir, (_e, name) => {
    if (name !== 'plan.json') return;
    clearTimeout(timer);
    timer = setTimeout(() => {
      if (!existsSync(planFile)) return;
      const h = hash(readFileSync(planFile, 'utf8'));
      if (h === lastWritten) return;
      lastWritten = h;
      for (const c of clients) c.write('event: plan-changed\ndata: {}\n\n');
    }, 150);
  });

  const handler = createEditorHandler(projectDir, allowedOrigin, {
    llmProvider,
    clients,
    onPlanSaved: h => {
      lastWritten = h;
    },
  });

  const server = createServer(handler);

  await new Promise<void>(r => server.listen(port, '127.0.0.1', r));
  const addr = server.address() as AddressInfo;
  return {
    url: `http://127.0.0.1:${addr.port}`,
    close: () =>
      new Promise(r => {
        watcher.close();
        clearTimeout(timer);
        for (const c of clients) c.end();
        server.closeAllConnections?.();
        server.close(() => r());
      }),
  };
}
