import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { run, runFfmpeg } from '../../src/media/ffmpeg';
import { renderStage } from '../../src/stages/render';
import type { Plan } from '../../src/plan/types';

let base: string;
beforeAll(() => { base = mkdtempSync(join(tmpdir(), 'editkai-sfx-render-')); });
afterAll(() => rmSync(base, { recursive: true, force: true }));

/** RMS level (dB) of `len` seconds of the sound of `file` from `from`; a silent clip gives -inf, returned as -200. */
async function level(file: string, from: number, len: number): Promise<number> {
  const out = await run('ffmpeg', ['-hide_banner', '-ss', String(from), '-t', String(len), '-i', file, '-vn', '-af', 'astats=metadata=1:measure_overall=RMS_level', '-f', 'null', '-']);
  const m = /Overall[\s\S]*?RMS level dB:\s*(-?[\d.]+|-inf)/.exec(out);
  if (!m) throw new Error(`no level in: ${out.slice(-500)}`);
  return m[1] === '-inf' ? -200 : Number(m[1]);
}

async function render(name: string, sfx?: Plan['meta']['sfx']): Promise<string> {
  const dir = join(base, name);
  mkdirSync(dir);
  // a silent source, so any sound in the result comes from the effects
  await runFfmpeg(['-y', '-f', 'lavfi', '-i', 'color=c=gray:s=360x640:r=30:d=3', '-f', 'lavfi', '-i', 'anullsrc=r=44100:cl=mono', '-t', '3', '-c:v', 'libx264', '-pix_fmt', 'yuv420p', '-c:a', 'aac', '-shortest', join(dir, 'cleaned.mp4')]);
  const plan: Plan = {
    version: 1, meta: { source: 'cleaned.mp4', fps: 30, width: 360, height: 640, style: 'm1', ...(sfx ? { sfx } : {}) },
    scenes: [{ id: 'sc1', start: 0, end: 3, role: 'talking-head' }],
    layers: [{ id: 'i1', track: 'graphic', type: 'logo-badge', start: 1, end: 2.5, props: { label: 'Claude' } }],
  };
  writeFileSync(join(dir, 'plan.json'), JSON.stringify(plan));
  return renderStage(dir);
}

describe('render with sound effects', () => {
  it('a card makes a pop where it appears, and nothing is heard elsewhere', async () => {
    const out = await render('on');
    expect(await level(out, 1.0, 0.15)).toBeGreaterThan(-45);
    expect(await level(out, 0.1, 0.5)).toBeLessThan(-70); // before any cue
  }, 300000);
  it('meta.sfx.enabled false keeps the video silent', async () => {
    const out = await render('off', { enabled: false });
    expect(await level(out, 1.0, 0.15)).toBeLessThan(-70);
  }, 300000);
});
