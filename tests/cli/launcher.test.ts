import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { spawnSync } from 'node:child_process';
import { existsSync, mkdirSync, mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';
import { runFfmpeg } from '../../src/media/ffmpeg';

const launcher = resolve('scripts/ev.mjs');
let base: string;
const ev = (cwd: string, ...args: string[]) => spawnSync(process.execPath, [launcher, ...args], { cwd, encoding: 'utf8' });

beforeAll(async () => {
  base = join(mkdtempSync(join(tmpdir(), 'editkai-ev-')), 'thư mục khác');
  mkdirSync(base);
  await runFfmpeg(['-y', '-f', 'lavfi', '-i', 'color=c=gray:s=160x120:r=30:d=1', '-pix_fmt', 'yuv420p', join(base, 'clip.mp4')]);
});
afterAll(() => rmSync(base, { recursive: true, force: true }));

describe('scripts/ev.mjs (runs the CLI from any folder)', () => {
  it('runs the cli and passes its exit code and messages through, even from a folder that is not the skill folder', () => {
    const r = ev(base, 'khong-co-lenh', 'x');
    expect(r.status).toBe(2);
    expect(r.stderr).toContain('Lệnh không hợp lệ');
  });
  it('a relative --source is read from the folder the command was typed in, not from the skill folder', () => {
    const project = join(base, 'dự án');
    const r = ev(base, 'init', project, '--source', 'clip.mp4', '--style', 'm1', '--aspect', '16:9');
    expect(r.status).toBe(0);
    expect(existsSync(join(project, 'source.mp4'))).toBe(true);
  });
  it('a relative file for assets add is read from that folder too', () => {
    const project = join(base, 'dự án');
    const r = ev(base, 'assets', 'add', project, 'clip.mp4', '--desc', 'thử');
    expect(r.status).toBe(0);
    expect(existsSync(join(project, 'assets', 'clip.mp4'))).toBe(true);
  });
});
