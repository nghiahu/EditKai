import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest';
import { mkdirSync, mkdtempSync, readFileSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { runCli } from '../../src/cli';
import { runFfmpeg } from '../../src/media/ffmpeg';

let base: string;
let wide: string;
let tall: string;
const out: string[] = [];
const err: string[] = [];
const cli = (...argv: string[]) => runCli(argv, s => out.push(s), s => err.push(s));
const project = () => join(base, 'dự án', Math.random().toString(36).slice(2));
const meta = (dir: string) => JSON.parse(readFileSync(join(dir, 'project.json'), 'utf8'));

beforeAll(async () => {
  base = mkdtempSync(join(tmpdir(), 'editkai-init-'));
  mkdirSync(join(base, 'dự án'));
  wide = join(base, 'ngang.mp4');
  tall = join(base, 'dọc.mp4');
  await runFfmpeg(['-y', '-f', 'lavfi', '-i', 'color=c=gray:s=320x180:r=30:d=1', '-pix_fmt', 'yuv420p', wide]);
  await runFfmpeg(['-y', '-f', 'lavfi', '-i', 'color=c=gray:s=180x320:r=30:d=1', '-pix_fmt', 'yuv420p', tall]);
});
afterAll(() => rmSync(base, { recursive: true, force: true }));
beforeEach(() => { out.length = 0; err.length = 0; });

describe('init and the shape of the source', () => {
  it('a wide source in a 9:16 frame prints what will happen (cropped to fill) and how to change it', async () => {
    expect(await cli('init', project(), '--source', wide, '--style', 'm1', '--aspect', '9:16')).toBe(0);
    const text = out.join('\n');
    expect(text).toMatch(/16:9/);
    expect(text).toMatch(/9:16/);
    expect(text).toMatch(/focus/);
  });
  it('a source of the same shape as the frame prints no note', async () => {
    expect(await cli('init', project(), '--source', tall, '--style', 'm1', '--aspect', '9:16')).toBe(0);
    expect(out.join('\n')).not.toMatch(/focus/);
    expect(await cli('init', project(), '--source', wide, '--style', 'm1', '--aspect', '16:9')).toBe(0);
    expect(out.join('\n')).not.toMatch(/focus/);
  });
  it('--fit and --focus are kept in project.json', async () => {
    const dir = project();
    expect(await cli('init', dir, '--source', wide, '--style', 'm1', '--aspect', '9:16', '--fit', 'contain', '--focus', '0.3,0.4')).toBe(0);
    expect(meta(dir)).toMatchObject({ fit: 'contain', focus: { x: 0.3, y: 0.4 } });
  });
  it('without them project.json has neither', async () => {
    const dir = project();
    await cli('init', dir, '--source', wide, '--style', 'm1', '--aspect', '9:16');
    expect(meta(dir)).not.toHaveProperty('fit');
    expect(meta(dir)).not.toHaveProperty('focus');
  });
  it('a bad --fit or --focus exits 2 with a message and creates nothing', async () => {
    for (const bad of [['--fit', 'stretch'], ['--focus', '2,0.5'], ['--focus', 'giữa']]) {
      const dir = project();
      expect(await cli('init', dir, '--source', wide, '--style', 'm1', '--aspect', '9:16', ...bad)).toBe(2);
      expect(err.join('\n')).toMatch(/fit|focus/);
      err.length = 0;
    }
  });
});
