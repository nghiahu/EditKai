import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { mkdtempSync, mkdirSync, rmSync, writeFileSync, readFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { startEditorServer } from '../../editor/server/server';
import { runFfmpeg } from '../../src/media/ffmpeg';

let base: string, dir: string, srv: Awaited<ReturnType<typeof startEditorServer>>;
const fixture = () => readFileSync('tests/fixtures/plan.valid.json', 'utf8');

beforeEach(async () => {
  base = mkdtempSync(join(tmpdir(), 'editkai-'));
  dir = join(base, 'dự án');
  mkdirSync(dir);
  writeFileSync(join(dir, 'plan.json'), fixture());
  writeFileSync(join(dir, 'note.txt'), 'hello');
  srv = await startEditorServer(dir, 0);
});
afterEach(async () => { await srv.close(); rmSync(base, { recursive: true, force: true }); });

const put = (body: unknown) => fetch(`${srv.url}/api/plan`, { method: 'PUT', body: JSON.stringify(body), headers: { 'content-type': 'application/json' } });

describe('editor server', () => {
  it('serves the plan, the theme and project media', async () => {
    expect((await (await fetch(`${srv.url}/api/plan`)).json()).meta.style).toBe('s1');
    expect((await (await fetch(`${srv.url}/api/theme`)).json()).name).toBe('s1');
    expect(await (await fetch(`${srv.url}/media/note.txt`)).text()).toBe('hello');
  });
  it('PUT rejects an invalid plan with 422 and leaves the file unchanged', async () => {
    const bad = JSON.parse(fixture()); bad.layers[0].track = 'music';
    const r = await put(bad);
    expect(r.status).toBe(422);
    expect((await r.json()).issues[0].code).toBe('schema');
    expect(readFileSync(join(dir, 'plan.json'), 'utf8')).toBe(fixture());
  });
  it('PUT saves a valid plan', async () => {
    const p = JSON.parse(fixture()); p.layers[1].props.title = 'MỚI';
    expect((await put(p)).status).toBe(204);
    expect(JSON.parse(readFileSync(join(dir, 'plan.json'), 'utf8')).layers[1].props.title).toBe('MỚI');
  });
  it('emits plan-changed after an external write but not after its own save', async () => {
    const res = await fetch(`${srv.url}/api/events`);
    const reader = res.body!.getReader();
    let seen = '';
    let pending: Promise<ReadableStreamReadResult<Uint8Array>> | undefined; // keep one read in flight so no chunk is dropped
    const waitFor = async (ms: number) => {
      const end = Date.now() + ms;
      while (Date.now() < end && !seen.includes('plan-changed')) {
        pending ??= reader.read();
        const r = await Promise.race([pending, new Promise<null>(x => setTimeout(() => x(null), 200))]);
        if (r) { pending = undefined; if (!r.done) seen += new TextDecoder().decode(r.value); }
      }
    };
    const own = JSON.parse(fixture()); own.layers[1].props.title = 'TỰ LƯU';
    await put(own);
    await waitFor(1000);
    expect(seen).not.toContain('plan-changed');
    const ext = JSON.parse(fixture()); ext.layers[1].props.title = 'NGOÀI';
    writeFileSync(join(dir, 'plan.json'), JSON.stringify(ext));
    await waitFor(5000);
    expect(seen).toContain('plan-changed');
    await reader.cancel();
  }, 20000);
  it('rejects PUT and POST from a foreign origin with 403 and leaves the file unchanged', async () => {
    const evil = { 'content-type': 'application/json', origin: 'http://evil.example' };
    expect((await fetch(`${srv.url}/api/plan`, { method: 'PUT', body: fixture(), headers: evil })).status).toBe(403);
    expect((await fetch(`${srv.url}/api/render`, { method: 'POST', headers: evil })).status).toBe(403);
    expect(readFileSync(join(dir, 'plan.json'), 'utf8')).toBe(fixture());
  });
  it('allows the editor origin and answers CORS only for it', async () => {
    const ok = await fetch(`${srv.url}/api/plan`, { headers: { origin: 'http://127.0.0.1:5187' } });
    expect(ok.headers.get('access-control-allow-origin')).toBe('http://127.0.0.1:5187');
    const other = await fetch(`${srv.url}/api/plan`, { headers: { origin: 'http://evil.example' } });
    expect(other.headers.get('access-control-allow-origin')).toBeNull();
  });
  it('GET /api/validate reports validator issues for the saved plan', async () => {
    await runFfmpeg(['-y', '-f', 'lavfi', '-i', 'color=c=gray:s=320x240:r=30:d=3', '-c:v', 'libx264', '-pix_fmt', 'yuv420p', join(dir, 'cleaned.mp4')]);
    const p = JSON.parse(fixture());
    p.layers.push({ id: 'l3', track: 'title', type: 'title-card', start: 1, end: 2, props: { icon: 'x', title: 'y' } });
    await put(p);
    const body = await (await fetch(`${srv.url}/api/validate`)).json();
    expect(body.issues.map((i: { code: string }) => i.code)).toContain('track-overlap');
  });
});
