import { describe, it, expect, beforeAll } from 'vitest';
import { mkdtempSync, readFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { runFfmpeg } from '../../src/media/ffmpeg';
import { blankStill, inkBox, planOf, stillOf } from './helper';
import type { Layer } from '../../src/plan/types';

let PNG = '';
beforeAll(async () => {
  const file = join(mkdtempSync(join(tmpdir(), 'editkai-logo-')), 'logo.png');
  await runFfmpeg(['-y', '-f', 'lavfi', '-i', 'color=c=red:s=96x96', '-frames:v', '1', file]);
  PNG = `data:image/png;base64,${readFileSync(file).toString('base64')}`;
});

const badge = (props: Record<string, unknown> = {}): Layer => ({ id: 'b1', track: 'graphic', type: 'logo-badge', start: 0, end: 4, props });
const bytes = async (props: Record<string, unknown>, frame: number, style: 's1' | 'm1' = 'm1') => readFileSync(await stillOf(planOf(style, [badge(props)]), frame));
const T = 300000;

describe('logo-badge', () => {
  for (const style of ['s1', 'm1'] as const) {
    it(`${style}: the badge builds up (frames 3, 12 and 40 differ)`, async () => {
      const [a, b, c] = [await bytes({}, 3, style), await bytes({}, 12, style), await bytes({}, 40, style)];
      expect(a.equals(b)).toBe(false);
      expect(b.equals(c)).toBe(false);
    }, T);
    it(`${style}: the last frame equals a blank frame`, async () => {
      expect((await bytes({ label: 'Claude Opus 5.5', sub: 'mô hình' }, 119, style)).equals(readFileSync(await blankStill(style, 119)))).toBe(true);
    }, T);
  }
  it('it keeps floating after it has settled (frames 60 and 75 differ)', async () => {
    expect((await bytes({}, 60)).equals(await bytes({}, 75))).toBe(false);
  }, T);
  it('label and sub change the picture', async () => {
    const plain = await bytes({}, 40);
    expect((await bytes({ label: 'Claude Opus 5.5' }, 40)).equals(plain)).toBe(false);
    expect((await bytes({ sub: 'mô hình mới' }, 40)).equals(plain)).toBe(false);
  }, T);
  it('an image src differs from the icon', async () => {
    expect((await bytes({ src: PNG }, 40)).equals(await bytes({}, 40))).toBe(false);
  }, T);
  it('a failing image src falls back to the icon', async () => {
    expect((await bytes({ src: 'http://127.0.0.1:1/none.png' }, 60)).equals(await bytes({}, 60))).toBe(true);
  }, T);
  it('top, center and bottom give three different pictures', async () => {
    const [t, c, b] = [await bytes({ position: 'top' }, 40), await bytes({ position: 'center' }, 40), await bytes({ position: 'bottom' }, 40)];
    expect(t.equals(c)).toBe(false);
    expect(c.equals(b)).toBe(false);
    expect(t.equals(b)).toBe(false);
  }, T);
  it('left and right put the badge in the left or the right half of the frame, level with the centre', async () => {
    const box = async (position: string) => inkBox(await stillOf(planOf('m1', [badge({ position })]), 40));
    const [l, c, r] = [await box('left'), await box('center'), await box('right')];
    expect(l.x + l.w).toBeLessThan(540);
    expect(r.x).toBeGreaterThan(540);
    expect(Math.abs(l.y - c.y)).toBeLessThan(40);
    expect(Math.abs(r.y - c.y)).toBeLessThan(40);
  }, T);
  it('an unknown icon renders like the check icon', async () => {
    expect((await bytes({ icon: 'zzz' }, 40)).equals(await bytes({ icon: 'check' }, 40))).toBe(true);
  }, T);
  it('a 60-character label wraps and stays inside the frame (Review Focus 4)', async () => {
    const png = await stillOf(planOf('m1', [badge({ label: 'Một nhãn rất dài để thử xem nó có tràn ra ngoài khung hình hay không nhé' })]), 40);
    const box = await inkBox(png);
    expect(box.w).toBeLessThan(1080);
    expect(box.x).toBeGreaterThan(0);
  }, T);
});
