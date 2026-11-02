import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { mkdtempSync, writeFileSync, rmSync } from 'node:fs';
import { request } from 'node:http';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { serveDir } from '../../src/media/serve';
import { assetUrl } from '../../remotion/assetUrl';

let dir: string, srv: Awaited<ReturnType<typeof serveDir>>;
beforeAll(async () => {
  dir = mkdtempSync(join(tmpdir(), 'editkai-'));
  writeFileSync(join(dir, '50%off #1.txt'), 'ok');
  srv = await serveDir(dir);
});
afterAll(async () => { await srv.close(); rmSync(dir, { recursive: true, force: true }); });

const raw = (path: string) => new Promise<number>((res, rej) => {
  const u = new URL(srv.url);
  request({ host: u.hostname, port: u.port, path }, r => { r.resume(); res(r.statusCode!); }).on('error', rej).end();
});

describe('serveDir', () => {
  it('answers 400 for a malformed percent escape and keeps serving', async () => {
    expect(await raw('/%E0%A4%A')).toBe(400);
    expect(await raw('/50%25off%20%231.txt')).toBe(200);
  });
  it('serves a file whose name contains % and # when the URL is encoded with assetUrl', async () => {
    expect(await (await fetch(assetUrl(srv.url, '50%off #1.txt'))).text()).toBe('ok');
  });
});

describe('assetUrl', () => {
  it('encodes each path segment and keeps slashes', () => {
    expect(assetUrl('http://x', 'assets/50%off #1.mp4')).toBe('http://x/assets/50%25off%20%231.mp4');
  });
  it('leaves absolute URLs alone', () => {
    expect(assetUrl('http://x', 'https://y/z.mp4')).toBe('https://y/z.mp4');
  });
});
