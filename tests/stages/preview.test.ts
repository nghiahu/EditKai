import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { existsSync, mkdirSync, mkdtempSync, readFileSync, readdirSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { runFfmpeg } from '../../src/media/ffmpeg';
import { probe } from '../../src/media/probe';
import { previewStage, previewVideo } from '../../src/stages/preview';
import type { Plan } from '../../src/plan/types';

let base: string;
let dir: string;

beforeEach(() => {
  base = mkdtempSync(join(tmpdir(), 'editkai-preview-'));
  dir = join(base, 'dự án xem trước'); // spaces and diacritics on purpose
  mkdirSync(dir);
});
afterEach(() => rmSync(base, { recursive: true, force: true }));

async function setup(extra: Plan['layers'] = []) {
  await runFfmpeg(['-y', '-f', 'lavfi', '-i', 'color=c=gray:s=360x640:r=30:d=3', '-f', 'lavfi', '-i', 'sine=frequency=440:sample_rate=44100:duration=3',
    '-c:v', 'libx264', '-pix_fmt', 'yuv420p', '-c:a', 'aac', '-shortest', join(dir, 'cleaned.mp4')]);
  const plan: Plan = {
    version: 1, meta: { source: 'cleaned.mp4', fps: 30, width: 360, height: 640, style: 'm1' },
    scenes: [{ id: 'sc1', start: 0, end: 3, role: 'talking-head' }],
    layers: [
      { id: 'c1', track: 'caption', start: 0, end: 3, words: [{ t: 'Xin', s: 0.2, e: 0.5, hl: false }, { t: 'chào', s: 0.6, e: 0.9, hl: true }] },
      { id: 't1', track: 'title', type: 'title-card', start: 0.5, end: 2, props: { icon: 'video', title: 'XEM TRƯỚC' } },
      { id: 'tr', track: 'graphic', type: 'transition', start: 2.3, end: 2.7, props: { kind: 'dip' } },
      ...extra,
    ],
  };
  writeFileSync(join(dir, 'plan.json'), JSON.stringify(plan));
}
const bundles = () => readdirSync(tmpdir()).filter(n => n.startsWith('remotion-webpack-bundle-'));

describe('previewStage', () => {
  it('renders one picture per chosen moment into preview/ plus a contact sheet, each picture the size of the video', async () => {
    await setup();
    const r = await previewStage(dir);
    expect(r.frames.length).toBeGreaterThanOrEqual(3); // the title card, the transition, the captions and the ends
    for (const f of r.frames) {
      expect(existsSync(f.file)).toBe(true);
      const info = await probe(f.file);
      expect([info.width, info.height]).toEqual([360, 640]);
    }
    expect(r.frames.map(f => f.t)).toEqual([...r.frames.map(f => f.t)].sort((a, b) => a - b));
    expect(r.frames.some(f => f.label.includes('dip'))).toBe(true);
    expect(existsSync(r.sheet)).toBe(true);
    const report = readFileSync(join(dir, 'preview', 'report.md'), 'utf8');
    expect(report.split('\n').filter(l => /^\| \d+ \|/.test(l))).toHaveLength(r.frames.length);
    expect(report).toContain('f01.png');
    const sheet = await probe(r.sheet);
    expect(sheet.width).toBeGreaterThan(360);
    expect(sheet.width).toBeLessThanOrEqual(1920);
  }, 300000);
  it('clears an earlier preview and leaves no Remotion bundle folder behind', async () => {
    await setup();
    mkdirSync(join(dir, 'preview'));
    writeFileSync(join(dir, 'preview', 'cu.png'), 'x');
    const before = bundles();
    await previewStage(dir);
    expect(existsSync(join(dir, 'preview', 'cu.png'))).toBe(false);
    expect(bundles().filter(n => !before.includes(n))).toEqual([]);
  }, 300000);
  it('at: takes exactly those moments, in that order of time, named by the second, and report.md has a row for each', async () => {
    await setup();
    const r = await previewStage(dir, { at: [2.2, 0.4, 1.0] });
    expect(r.frames.map(f => f.t)).toEqual([0.4, 1, 2.2]);
    expect(r.frames.every(f => f.label.startsWith('mốc'))).toBe(true);
    const report = readFileSync(join(dir, 'preview', 'report.md'), 'utf8');
    expect(report.split('\n').filter(l => /^\| \d+ \|/.test(l))).toHaveLength(3);
  }, 300000);
  it('at: a moment outside the video is a clear error', async () => {
    await setup();
    await expect(previewStage(dir, { at: [99] })).rejects.toThrow(/99/);
  }, 300000);
  it('max limits the pictures', async () => {
    await setup();
    expect((await previewStage(dir, { max: 2 })).frames).toHaveLength(2);
  }, 300000);
  it('clear errors: no plan.json, or a plan with errors (the same refusal as render)', async () => {
    await expect(previewStage(dir)).rejects.toThrow('plan.json');
    await setup([{ id: 'f1', track: 'footage', type: 'footage', start: 0.5, end: 1, props: { src: 'assets/none.mp4' } }]);
    await expect(previewStage(dir)).rejects.toThrow(/missing-file/);
  }, 300000);
});

describe('previewVideo', () => {
  it('a small, quick copy of the video: the picture is scaled down and it is a separate file from out.mp4', async () => {
    await setup();
    const out = await previewVideo(dir, { scale: 0.5 });
    expect(out).toBe(join(dir, 'preview.mp4'));
    const info = await probe(out);
    expect([info.width, info.height]).toEqual([180, 320]);
    expect(Math.abs(info.durationSec - 3)).toBeLessThan(0.3);
    expect(existsSync(join(dir, 'out.mp4'))).toBe(false);
  }, 300000);
});
