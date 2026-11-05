import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { run, runFfmpeg } from '../../src/media/ffmpeg';
import { renderStage } from '../../src/stages/render';
import { LAYER_TYPES } from '../../src/plan/layerTypes';
import type { Plan } from '../../src/plan/types';

let base: string;
let out: string;
beforeAll(async () => {
  base = mkdtempSync(join(tmpdir(), 'editkai-freeze-'));
  const dir = join(base, 'dự án đóng băng');
  mkdirSync(dir);
  // a picture that changes all the time (a moving test pattern) and a steady 440 Hz tone: whatever stands still or goes quiet is the freeze's doing
  await runFfmpeg(['-y', '-f', 'lavfi', '-i', 'testsrc2=s=360x640:r=30:d=3', '-f', 'lavfi', '-i', 'sine=frequency=440:sample_rate=44100:duration=3',
    '-c:v', 'libx264', '-pix_fmt', 'yuv420p', '-c:a', 'aac', '-shortest', join(dir, 'cleaned.mp4')]);
  const plan: Plan = {
    version: 1, meta: { source: 'cleaned.mp4', fps: 30, width: 360, height: 640, style: 'm1', sfx: { enabled: false } },
    scenes: [{ id: 'sc1', start: 0, end: 3, role: 'talking-head' }],
    layers: [{ id: 'f1', track: 'camera', type: 'freeze', start: 1, end: 2 }],
  };
  writeFileSync(join(dir, 'plan.json'), JSON.stringify(plan));
  out = await renderStage(dir);
}, 300000);
afterAll(() => rmSync(base, { recursive: true, force: true }));

/** Peak signal-to-noise ratio (dB) between the pictures of the result at two moments: high when they are the same. */
async function psnr(a: number, b: number): Promise<number> {
  const text = await run('ffmpeg', ['-hide_banner', '-ss', String(a), '-i', out, '-ss', String(b), '-i', out, '-frames:v', '1', '-lavfi', '[0:v][1:v]psnr', '-f', 'null', '-']);
  const m = /average:(inf|[\d.]+)/.exec(text);
  if (!m) throw new Error(text.slice(-400));
  return m[1] === 'inf' ? 999 : Number(m[1]);
}
async function level(from: number, len: number): Promise<number> {
  const text = await run('ffmpeg', ['-hide_banner', '-ss', String(from), '-t', String(len), '-i', out, '-vn', '-af', 'astats=metadata=1:measure_overall=RMS_level', '-f', 'null', '-']);
  const m = /Overall[\s\S]*?RMS level dB:\s*(-?[\d.]+|-inf)/.exec(text);
  return m && m[1] !== '-inf' ? Number(m[1]) : -200;
}

describe('freeze', () => {
  it('is a camera layer with no props to give', () => {
    expect(LAYER_TYPES.freeze.track).toBe('camera');
    expect(LAYER_TYPES.freeze.check({})).toBeUndefined();
  });
  it('the picture stands still while it is up, and moves before and after', async () => {
    expect(await psnr(1.25, 1.85)).toBeGreaterThan(40);
    expect(await psnr(0.3, 0.8)).toBeLessThan(25);
    expect(await psnr(2.2, 2.7)).toBeLessThan(25);
  }, 120000);
  it('the sound keeps going through it', async () => {
    expect(await level(0.2, 0.6)).toBeGreaterThan(-30);
    expect(await level(1.2, 0.6)).toBeGreaterThan(-30);
    expect(Math.abs((await level(1.2, 0.6)) - (await level(0.2, 0.6)))).toBeLessThan(4);
  }, 120000);
});
