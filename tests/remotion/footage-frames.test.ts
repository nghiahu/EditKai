import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { mkdtempSync, readFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { footageMotion } from '../../remotion/footageMotion';
import { runFfmpeg } from '../../src/media/ffmpeg';
import { serveDir } from '../../src/media/serve';
import { blankStill, inkBox, lumaAt, planOf, stillOf } from './helper';
import type { Layer } from '../../src/plan/types';

const scaleOf = (s: { transform?: string | number }) => Number(/scale\(([\d.]+)\)/.exec(String(s.transform))?.[1]);
const shiftOf = (s: { transform?: string | number }) => Number(/translateX\((-?[\d.]+)%\)/.exec(String(s.transform))?.[1]);
const focus = { x: 0.5, y: 0.5 };

describe('footageMotion', () => {
  it('none gives an empty style', () => {
    expect(footageMotion('none', 0.5, focus)).toEqual({});
  });
  it('zoom-in goes from scale 1 to 1.12 and zoom-out is the reverse', () => {
    expect(scaleOf(footageMotion('zoom-in', 0, focus))).toBeCloseTo(1, 4);
    expect(scaleOf(footageMotion('zoom-in', 1, focus))).toBeCloseTo(1.12, 4);
    expect(scaleOf(footageMotion('zoom-out', 0, focus))).toBeCloseTo(1.12, 4);
    expect(scaleOf(footageMotion('zoom-out', 1, focus))).toBeCloseTo(1, 4);
  });
  it('pan-left and pan-right move opposite ways at a fixed scale of 1.08', () => {
    expect(shiftOf(footageMotion('pan-left', 0, focus))).toBeCloseTo(2, 3);
    expect(shiftOf(footageMotion('pan-left', 1, focus))).toBeCloseTo(-2, 3);
    expect(shiftOf(footageMotion('pan-right', 0, focus))).toBeCloseTo(-2, 3);
    expect(shiftOf(footageMotion('pan-right', 1, focus))).toBeCloseTo(2, 3);
    for (const p of [0, 0.5, 1]) expect(scaleOf(footageMotion('pan-left', p, focus))).toBeCloseTo(1.08, 4);
  });
  it('focus sets the transform origin', () => {
    expect(footageMotion('zoom-in', 0.5, { x: 0.3, y: 0.6 }).transformOrigin).toBe('30% 60%');
  });
  it('progress outside 0..1 and NaN stay finite (Review Focus 2)', () => {
    for (const p of [-5, 7, NaN, Infinity]) expect(JSON.stringify(footageMotion('zoom-in', p, focus))).not.toMatch(/NaN|Infinity/);
    expect(scaleOf(footageMotion('zoom-in', -5, focus))).toBeCloseTo(1, 4);
    expect(scaleOf(footageMotion('zoom-in', 7, focus))).toBeCloseTo(1.12, 4);
  });
});

describe('Footage frames in the composition', () => {
  let PNG = '';
  let srv: Awaited<ReturnType<typeof serveDir>>;
  beforeAll(async () => {
    const dir = mkdtempSync(join(tmpdir(), 'editkai-frames-'));
    await runFfmpeg(['-y', '-f', 'lavfi', '-i', 'color=c=red:s=64x36', '-frames:v', '1', join(dir, 'x.png')]);
    PNG = `data:image/png;base64,${readFileSync(join(dir, 'x.png')).toString('base64')}`;
    // red for 0-2 s, blue for 2-4 s
    await runFfmpeg(['-y', '-f', 'lavfi', '-i', 'color=c=red:s=540x960:r=30:d=2', '-f', 'lavfi', '-i', 'color=c=blue:s=540x960:r=30:d=2',
      '-filter_complex', 'concat=n=2:v=1:a=0', '-pix_fmt', 'yuv420p', join(dir, 'clip.mp4')]);
    srv = await serveDir(dir);
  });
  afterAll(() => srv?.close());

  const layer = (props: Record<string, unknown>, start = 0, end = 4): Layer => ({ id: 'f1', track: 'footage', type: 'footage', start, end, props: { src: PNG, ...props } });
  const bytes = async (props: Record<string, unknown>, frame: number, style: 's1' | 'm1' = 'm1') => readFileSync(await stillOf(planOf(style, [layer(props)]), frame));
  const blank = async (frame: number) => readFileSync(await blankStill('m1', frame));
  const T = 300000;

  it('window and phone each differ from frame none at frame 40', async () => {
    const none = await bytes({}, 40);
    expect((await bytes({ frame: 'window' }, 40)).equals(none)).toBe(false);
    expect((await bytes({ frame: 'phone' }, 40)).equals(none)).toBe(false);
    expect((await bytes({ frame: 'window' }, 40)).equals(await bytes({ frame: 'phone' }, 40))).toBe(false);
  }, T);
  it('a window title changes the picture', async () => {
    expect((await bytes({ frame: 'window', title: 'Editor' }, 40)).equals(await bytes({ frame: 'window' }, 40))).toBe(false);
  }, T);
  it('zoom-in differs between frames 20 and 100 while motion none does not', async () => {
    expect((await bytes({ motion: 'zoom-in', fit: 'contain' }, 20)).equals(await bytes({ motion: 'zoom-in', fit: 'contain' }, 100))).toBe(false);
    expect((await bytes({ motion: 'none' }, 40)).equals(await bytes({ motion: 'none' }, 100))).toBe(true);
  }, T);
  it('from: 2 shows the blue half of a red/blue clip, from: 0 shows the red half', async () => {
    const at = async (from: number) => lumaAt(await stillOf(planOf('m1', [layer({ src: `${srv.url}/clip.mp4`, from })]), 40), 540, 960);
    expect(await at(2)).toBeLessThan(50);
    expect(await at(0)).toBeGreaterThan(60);
  }, T);
  it('a failed load inside a phone frame with motion shows the placeholder and ends blank (Review Focus 1)', async () => {
    const failing = { src: 'http://127.0.0.1:1/none.png', frame: 'phone', motion: 'zoom-in' };
    expect((await bytes(failing, 40)).equals(await blank(40))).toBe(false);
    expect((await bytes(failing, 119)).equals(await blank(119))).toBe(true);
  }, T);
  it('the last frame equals a blank frame for window and phone', async () => {
    for (const frame of ['window', 'phone']) expect((await bytes({ frame }, 119)).equals(await blank(119))).toBe(true);
  }, T);
  it('a window card fits inside a 16:9 frame instead of running off the bottom', async () => {
    const plan16x9 = { ...planOf('m1', [layer({ frame: 'window' })]), meta: { source: 'cleaned.mp4', fps: 30, width: 1920, height: 1080, style: 'm1' } };
    const box = await inkBox(await stillOf(plan16x9, 40), 1920, 1080);
    expect(box.y + box.h).toBeLessThan(1000);
    expect(Math.abs(box.x + box.w / 2 - 960)).toBeLessThan(30);
  }, T);
  it('a 9:16 window keeps its place (84% wide, centred)', async () => {
    const box = await inkBox(await stillOf(planOf('m1', [layer({ frame: 'window' })]), 40));
    expect(box.w).toBeGreaterThan(1080 * 0.8);
    expect(Math.abs(box.x + box.w / 2 - 540)).toBeLessThan(20);
  }, T);
  it('a one-frame layer with motion renders', async () => {
    const png = await stillOf(planOf('m1', [layer({ frame: 'window', motion: 'pan-left' }, 0, 0.03)]), 0);
    expect(readFileSync(png).length).toBeGreaterThan(1000);
  }, T);
});
