import { createServer, type ServerResponse } from 'node:http';
import { createHash } from 'node:crypto';
import { existsSync, readFileSync, watch, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import type { AddressInfo } from 'node:net';
import { serveFile } from '../../src/media/serve';
import { validatePlanSchema } from '../../src/plan/schema';
import { loadTheme } from '../../src/style/theme';

const root = join(dirname(fileURLToPath(import.meta.url)), '..', '..');
const hash = (s: string) => createHash('sha1').update(s).digest('hex');

export async function startEditorServer(projectDir: string, port = 5186): Promise<{ url: string; close(): Promise<void> }> {
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

  const json = (res: ServerResponse, status: number, body: unknown) =>
    res.writeHead(status, { 'Content-Type': 'application/json' }).end(JSON.stringify(body));

  const server = createServer((req, res) => {
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Access-Control-Allow-Methods', 'GET, PUT, OPTIONS');
    res.setHeader('Access-Control-Allow-Headers', 'content-type');
    const url = req.url ?? '/';
    if (req.method === 'OPTIONS') { res.writeHead(204).end(); return; }

    if (url.startsWith('/media/')) { serveFile(projectDir, url.slice('/media/'.length), req, res); return; }
    if (url === '/api/events') {
      res.writeHead(200, { 'Content-Type': 'text/event-stream', 'Cache-Control': 'no-cache', Connection: 'keep-alive' });
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
      } catch (e) { return json(res, 404, { error: (e as Error).message }); }
    }
    if (url === '/api/plan' && req.method === 'PUT') {
      let body = '';
      req.on('data', d => (body += d));
      req.on('end', () => {
        let plan: unknown;
        try { plan = JSON.parse(body); } catch { return json(res, 400, { error: 'Nội dung không phải JSON' }); }
        const check = validatePlanSchema(plan);
        if (!check.ok) return json(res, 422, { issues: check.issues });
        const text = JSON.stringify(plan, null, 2);
        lastWritten = hash(text);
        writeFileSync(planFile, text);
        res.writeHead(204).end();
      });
      return;
    }
    res.writeHead(404).end();
  });

  await new Promise<void>(r => server.listen(port, '127.0.0.1', r));
  const addr = server.address() as AddressInfo;
  return {
    url: `http://127.0.0.1:${addr.port}`,
    close: () => new Promise(r => { watcher.close(); clearTimeout(timer); for (const c of clients) c.end(); server.closeAllConnections?.(); server.close(() => r()); }),
  };
}
