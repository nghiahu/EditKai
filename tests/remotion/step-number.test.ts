import { describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';
import { blankStill, inkBox, planOf, stillOf } from './helper';
import type { Layer } from '../../src/plan/types';

const step = (props: Record<string, unknown>): Layer => ({ id: 's1', track: 'graphic', type: 'step-number', start: 0, end: 4, props } as Layer);
const png = (props: Record<string, unknown>, frame: number, style: 's1' | 'm1' = 'm1') => stillOf(planOf(style, [step(props)]), frame);
const bytes = async (props: Record<string, unknown>, frame: number, style: 's1' | 'm1' = 'm1') => readFileSync(await png(props, frame, style));
const T = 300000;

describe('step-number', () => {
  it('the numeral lands (frames 3, 12 and 45 differ) and the last frame is as blank as the picture', async () => {
    const p = { number: 2, title: 'CHIA SẺ' };
    const [a, b, c] = [await bytes(p, 3), await bytes(p, 12), await bytes(p, 45)];
    expect(a.equals(b)).toBe(false);
    expect(b.equals(c)).toBe(false);
    expect((await bytes(p, 119)).equals(readFileSync(await blankStill('m1', 119)))).toBe(true);
  }, T);
  it('sits at the top by default, and goes to the bottom, or to a side, when asked', async () => {
    const box = async (position?: string) => inkBox(await png({ number: 3, title: 'MỞ MÁY', ...(position ? { position } : {}) }, 45));
    const [dflt, top, bottom, left, right] = [await box(), await box('top'), await box('bottom'), await box('left'), await box('right')];
    expect(dflt.y).toBe(top.y);
    expect(top.y + top.h / 2).toBeLessThan(500);
    expect(bottom.y + bottom.h / 2).toBeGreaterThan(1400);
    expect(left.x + left.w).toBeLessThan(540);
    expect(right.x).toBeGreaterThan(540);
  }, T);
  it('another number, a title and a sub-line each change the picture, in both styles', async () => {
    for (const style of ['s1', 'm1'] as const) {
      const base = await bytes({ number: 2 }, 45, style);
      expect((await bytes({ number: 12 }, 45, style)).equals(base)).toBe(false);
      expect((await bytes({ number: 2, title: 'MỞ MÁY' }, 45, style)).equals(base)).toBe(false);
      expect((await bytes({ number: 2, sub: 'rồi bấm nút' }, 45, style)).equals(base)).toBe(false);
    }
  }, T);
  it('a 40-character title and a two-digit number stay inside the frame', async () => {
    const b = await inkBox(await png({ number: 88, title: 'MỘT CÁI TIÊU ĐỀ DÀI TỚI BỐN MƯƠI KÝ TỰ NÈ', sub: 'x'.repeat(60) }, 45));
    expect(b.x).toBeGreaterThanOrEqual(0);
    expect(b.x + b.w).toBeLessThanOrEqual(1080);
  }, T);
});
