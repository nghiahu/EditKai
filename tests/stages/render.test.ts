import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { mkdtempSync, mkdirSync, readdirSync, rmSync, existsSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { runFfmpeg } from '../../src/media/ffmpeg';
import { probe } from '../../src/media/probe';
import { renderStage } from '../../src/stages/render';
import type { Plan } from '../../src/plan/types';

let base: string;
let dir: string;

beforeEach(() => {
  base = mkdtempSync(join(tmpdir(), 'editkai-'));
  dir = join(base, 'dự án render'); // spaces + diacritics on purpose
  mkdirSync(dir);
});
afterEach(() => rmSync(base, { recursive: true, force: true }));

async function setup(style: 's1' | 'm1', durationSec: number, layerEnd: number, extra: Plan['layers'] = []) {
  await runFfmpeg(['-y', '-f', 'lavfi', '-i', `color=c=gray:s=360x640:r=30:d=${durationSec}`,
    '-f', 'lavfi', '-i', `sine=frequency=440:sample_rate=44100:duration=${durationSec}`,
    '-c:v', 'libx264', '-pix_fmt', 'yuv420p', '-c:a', 'aac', '-shortest', join(dir, 'cleaned.mp4')]);
  const plan: Plan = {
    version: 1, meta: { source: 'cleaned.mp4', fps: 30, width: 360, height: 640, style },
    scenes: [{ id: 'sc1', start: 0, end: layerEnd, role: 'talking-head' }],
    layers: [{ id: 'c1', track: 'caption', start: 0, end: layerEnd, words: [{ t: 'Xin', s: 0, e: 0.3, hl: false }, { t: 'chào', s: 0.3, e: 0.6, hl: true }] }, ...extra],
  };
  writeFileSync(join(dir, 'plan.json'), JSON.stringify(plan));
}

describe('renderStage', () => {
  it('refuses to render when the plan has errors and lists them', async () => {
    await setup('s1', 2, 2, [{ id: 'f1', track: 'footage', type: 'footage', start: 0.5, end: 1, props: { src: 'assets/none.mp4' } }]);
    await expect(renderStage(dir)).rejects.toThrow(/missing-file/);
    expect(existsSync(join(dir, 'out.mp4'))).toBe(false);
  });
  it('refuses a layer that runs past a 0.8 s video', async () => {
    await setup('s1', 0.8, 4.2);
    await expect(renderStage(dir)).rejects.toThrow(/out-of-bounds/);
  });
  it('leaves no remotion-webpack-bundle folder behind in the temp dir (each render used to leave 36 MB)', async () => {
    const bundles = () => readdirSync(tmpdir()).filter(n => n.startsWith('remotion-webpack-bundle-'));
    const before = bundles();
    await setup('s1', 1, 1);
    await renderStage(dir);
    expect(bundles().filter(n => !before.includes(n))).toEqual([]);
  }, 300000);
  for (const style of ['s1', 'm1'] as const) {
    it(`renders a 2 s clip for ${style} in a folder with spaces and diacritics`, async () => {
      await setup(style, 2, 2);
      const out = await renderStage(dir);
      expect(existsSync(out)).toBe(true);
      const info = await probe(out);
      expect([info.width, info.height]).toEqual([360, 640]);
      expect(Math.abs(info.durationSec - 2)).toBeLessThan(0.2);
    }, 300000);
  }
  it('does not hang on a 0.8 s video', async () => {
    await setup('m1', 0.8, 0.8);
    const out = await renderStage(dir);
    expect(Math.abs((await probe(out)).durationSec - 0.8)).toBeLessThan(0.2);
  }, 120000);
});
