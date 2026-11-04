import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { existsSync, mkdirSync, mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { sampleFrames } from '../../src/stages/sampleFrames';
import { runFfmpeg } from '../../src/media/ffmpeg';
import { probe } from '../../src/media/probe';
import { runCli } from '../../src/cli';

let base: string;
beforeAll(async () => {
  base = mkdtempSync(join(tmpdir(), 'editkai-frames-'));
  mkdirSync(join(base, 'dự án'));
  await runFfmpeg(['-y', '-f', 'lavfi', '-i', 'testsrc=s=320x180:r=30:d=10', '-pix_fmt', 'yuv420p', join(base, 'dự án', 'cleaned.mp4')]);
});
afterAll(() => rmSync(base, { recursive: true, force: true }));

describe('sampleFrames', () => {
  it('takes evenly spaced pictures of cleaned.mp4 and a contact sheet, in frames/', async () => {
    const r = await sampleFrames(join(base, 'dự án'), { count: 6 });
    expect(r.frames).toHaveLength(6);
    expect(r.frames.map(f => f.t)).toEqual([...r.frames.map(f => f.t)].sort((a, b) => a - b));
    expect(r.frames[0].t).toBeGreaterThan(0);
    expect(r.frames[5].t).toBeLessThan(10);
    for (const f of r.frames) expect(existsSync(f.file)).toBe(true);
    expect(existsSync(r.sheet)).toBe(true);
    expect((await probe(r.sheet)).width).toBeGreaterThan(300);
  }, 60000);
  it('a missing cleaned.mp4 is a clear error, and a count that makes no sense is refused', async () => {
    await expect(sampleFrames(base)).rejects.toThrow('cleaned.mp4');
    await expect(sampleFrames(join(base, 'dự án'), { count: 0 })).rejects.toThrow(/count|số khung/i);
  });
  it('the frames command prints the times and the sheet', async () => {
    const out: string[] = [];
    expect(await runCli(['frames', join(base, 'dự án'), '--count', '4'], s => out.push(s), s => out.push(s))).toBe(0);
    expect(out.join('\n')).toMatch(/sheet\.png/);
  }, 60000);
});
