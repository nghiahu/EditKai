import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { mkdirSync, mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { runFfmpeg } from '../../src/media/ffmpeg';
import { lumaTrack } from '../../src/media/luma';

let dir: string;
let halves: string;
let flip: string;

beforeAll(async () => {
  dir = join(mkdtempSync(join(tmpdir(), 'editkai-luma-')), 'thư mục thử');
  mkdirSync(dir);
  halves = join(dir, 'nửa sáng.mp4'); // the top half white, the bottom half black
  await runFfmpeg(['-y', '-f', 'lavfi', '-i', 'color=c=black:s=160x120:r=30:d=2,drawbox=x=0:y=0:w=160:h=60:color=white:t=fill', '-pix_fmt', 'yuv420p', halves]);
  flip = join(dir, 'đổi sáng.mp4'); // white for 1 s, then black for 1 s
  await runFfmpeg(['-y', '-f', 'lavfi', '-i', 'color=c=white:s=160x120:r=30:d=1', '-f', 'lavfi', '-i', 'color=c=black:s=160x120:r=30:d=1',
    '-filter_complex', '[0:v][1:v]concat=n=2:v=1:a=0[v]', '-map', '[v]', '-pix_fmt', 'yuv420p', flip]);
});
afterAll(() => rmSync(dir, { recursive: true, force: true }));

describe('lumaTrack', () => {
  it('measures only the region asked for, as 0 (black) to 1 (white)', async () => {
    const top = await lumaTrack(halves, { x: 0, y: 0, w: 1, h: 0.4 });
    const bottom = await lumaTrack(halves, { x: 0, y: 0.6, w: 1, h: 0.4 });
    expect(top.every(v => v > 0.85)).toBe(true);
    expect(bottom.every(v => v < 0.15)).toBe(true);
  });
  it('gives one value per 1/fps second', async () => {
    const t = await lumaTrack(halves, { x: 0, y: 0, w: 1, h: 1 }, 4);
    expect(t.length).toBeGreaterThanOrEqual(7);
    expect(t.length).toBeLessThanOrEqual(9);
  });
  it('follows a change of brightness over time', async () => {
    const t = await lumaTrack(flip, { x: 0, y: 0, w: 1, h: 1 }, 4);
    expect(t[0]).toBeGreaterThan(0.85);
    expect(t[t.length - 1]).toBeLessThan(0.15);
  });
});

import { lumaGrid } from '../../src/media/luma';

describe('lumaGrid', () => {
  it('gives the brightness of each column of the region at every sample', async () => {
    const left = join(dir, 'trái sáng.mp4'); // the left 40% white, the rest black
    await runFfmpeg(['-y', '-f', 'lavfi', '-i', 'color=c=black:s=200x120:r=30:d=1,drawbox=x=0:y=0:w=80:h=120:color=white:t=fill', '-pix_fmt', 'yuv420p', left]);
    const g = await lumaGrid(left, { x: 0, y: 0, w: 1, h: 1 }, 10, 4);
    expect(g.length).toBeGreaterThanOrEqual(3);
    for (const row of g) {
      expect(row).toHaveLength(10);
      expect(row[0]).toBeGreaterThan(0.85);
      expect(row[3]).toBeGreaterThan(0.85);
      expect(row[5]).toBeLessThan(0.15);
      expect(row[9]).toBeLessThan(0.15);
    }
  });
});
