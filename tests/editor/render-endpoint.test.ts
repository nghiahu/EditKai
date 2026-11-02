import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { mkdtempSync, rmSync, writeFileSync, readFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { startEditorServer } from '../../editor/server/server';

let dir: string, srv: Awaited<ReturnType<typeof startEditorServer>>;
beforeEach(async () => {
  dir = mkdtempSync(join(tmpdir(), 'editkai-'));
  writeFileSync(join(dir, 'plan.json'), readFileSync('tests/fixtures/plan.valid.json', 'utf8'));
  srv = await startEditorServer(dir, 0);
});
afterEach(async () => { await srv.close(); rmSync(dir, { recursive: true, force: true }); });

describe('POST /api/render', () => {
  it('returns the render error message instead of crashing the server', async () => {
    const r = await fetch(`${srv.url}/api/render`, { method: 'POST' });
    expect(r.status).toBe(500);
    expect((await r.json()).error).toMatch(/Không tìm thấy video nguồn/);
    expect((await fetch(`${srv.url}/api/plan`)).status).toBe(200); // still alive
  });
});
