import { describe, it, expect, beforeAll } from 'vitest';
import { mkdtempSync, readFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { baseDim, mergeStyles } from '../../remotion/baseDim';
import { transitionStyle } from '../../remotion/transition';
import { loadTheme } from '../../src/style/theme';
import { runFfmpeg } from '../../src/media/ffmpeg';
import { serveDir } from '../../src/media/serve';
import { blankStill, planOf, stillOf } from './helper';
import type { Layer } from '../../src/plan/types';

const motion = loadTheme('styles/m1').motion;
const overlay = (start = 5, end = 9, id = 'e'): Layer => ({ id, track: 'graphic', type: 'explainer-scene', start, end, props: { title: 'X', mode: 'overlay' } });
const full = (): Layer => ({ id: 'f', track: 'graphic', type: 'explainer-scene', start: 5, end: 9, props: { title: 'X' } });
const footage = (fit: string): Layer => ({ id: 'g', track: 'footage', type: 'footage', start: 5, end: 9, props: { src: 'assets/a.mp4', fit } });
const amount = (s: { filter?: string | number }) => { const m = /brightness\(([\d.]+)\) blur\(([\d.]+)px\)/.exec(String(s.filter)); return m ? { b: Number(m[1]), blur: Number(m[2]) } : undefined; };

describe('baseDim', () => {
  it('does nothing for a full-mode explainer or a cover footage', () => {
    expect(baseDim([full()], 7, motion)).toEqual({});
    expect(baseDim([footage('cover')], 7, motion)).toEqual({});
  });
  it('overlay explainer: ramps in, holds brightness 0.55 and blur 6px, and is gone after the end', () => {
    const ramp = amount(baseDim([overlay()], 5.1, motion))!;
    expect(ramp.b).toBeLessThan(1);
    expect(ramp.b).toBeGreaterThan(0.55);
    expect(ramp.blur).toBeGreaterThan(0);
    expect(ramp.blur).toBeLessThan(6);
    expect(amount(baseDim([overlay()], 7, motion))).toEqual({ b: 0.55, blur: 6 });
    expect(baseDim([overlay()], 9, motion)).toEqual({});
    expect(baseDim([overlay()], 4.9, motion)).toEqual({});
  });
  it('ramps out in the last quarter second', () => {
    expect(amount(baseDim([overlay()], 8.9, motion))!.b).toBeGreaterThan(0.55);
  });
  it('footage with fit contain dims', () => {
    expect(amount(baseDim([footage('contain')], 7, motion))).toEqual({ b: 0.55, blur: 6 });
  });
  it('two dimming layers at once never go darker than 0.55', () => {
    expect(amount(baseDim([overlay(5, 9, 'a'), footage('contain')], 7, motion))).toEqual({ b: 0.55, blur: 6 });
  });
});

describe('mergeStyles', () => {
  it('concatenates transforms and filters and lets other keys win last', () => {
    expect(mergeStyles({ transform: 'scale(1.1)', filter: 'blur(2px)' }, { transform: 'translate(1px, 2px)', filter: 'brightness(0.5)', opacity: 0.5 }, { opacity: 0.8 }))
      .toEqual({ transform: 'scale(1.1) translate(1px, 2px)', filter: 'blur(2px) brightness(0.5)', opacity: 0.8 });
    expect(mergeStyles({}, {})).toEqual({});
  });
});

describe('transitionStyle (eased)', () => {
  const tr = (kind: string): Layer => ({ id: 't', track: 'graphic', type: 'transition', start: 2, end: 3, props: { kind } });
  const blur = (t: number) => Number(/blur\(([\d.]+)px\)/.exec(String(transitionStyle([tr('blur')], t).filter))![1]);
  it('eases in: a quarter of the way in the blur is below the old sine value', () => {
    expect(blur(2.25)).toBeLessThan(14 * Math.sin(Math.PI / 4));
    expect(blur(2.5)).toBe(14);
  });
  it('push moves up, scales and blurs slightly in the middle', () => {
    const s = transitionStyle([tr('push')], 2.5);
    expect(String(s.transform)).toMatch(/translateY\(-60/);
    expect(String(s.transform)).toMatch(/scale\(1\.06/);
    expect(String(s.filter)).toMatch(/blur\(4/);
  });
  it('flash leaves the base video alone (the component draws it)', () => {
    expect(transitionStyle([tr('flash')], 2.5)).toEqual({});
  });
});

// luma (0-255) of one pixel of a PNG, via a 1x1 crop written as PGM
async function luma(png: string, x: number, y: number): Promise<number> {
  const out = join(mkdtempSync(join(tmpdir(), 'editkai-luma-')), 'p.pgm');
  await runFfmpeg(['-y', '-i', png, '-vf', `crop=1:1:${x}:${y},format=gray`, '-frames:v', '1', out]);
  const b = readFileSync(out);
  return b[b.length - 1];
}

describe('transition and dim in the composition', () => {
  let srv: Awaited<ReturnType<typeof serveDir>>;
  beforeAll(async () => {
    const dir = mkdtempSync(join(tmpdir(), 'editkai-clip-'));
    await runFfmpeg(['-y', '-f', 'lavfi', '-i', 'color=c=0xC8C8C8:s=1080x1920:r=30:d=2', '-c:v', 'libx264', '-pix_fmt', 'yuv420p', join(dir, 'base.mp4')]);
    srv = await serveDir(dir);
    return () => srv.close();
  });

  it('a flash frame in the middle is much brighter than a blank frame', async () => {
    const flash: Layer = { id: 'x', track: 'graphic', type: 'transition', start: 0, end: 4, props: { kind: 'flash' } };
    const lit = await luma(await stillOf(planOf('m1', [flash]), 60), 540, 960);
    const dark = await luma(await blankStill('m1', 60), 540, 960);
    expect(lit).toBeGreaterThan(dark + 100);
  }, 240000);

  it('an overlay explainer dims and blurs the base video outside its card', async () => {
    const plain = await luma(await stillOf(planOf('m1', [], 2), 30, { videoSrc: `${srv.url}/base.mp4`, durationSec: 2 }), 100, 1800);
    const dimmed = await luma(await stillOf(planOf('m1', [{ ...overlay(0, 2), props: { title: 'X', mode: 'overlay' } }], 2), 30, { videoSrc: `${srv.url}/base.mp4`, durationSec: 2 }), 100, 1800);
    expect(plain).toBeGreaterThan(180);
    expect(dimmed).toBeLessThan(plain * 0.7);
    expect(dimmed).toBeGreaterThan(40);
  }, 400000);
});
