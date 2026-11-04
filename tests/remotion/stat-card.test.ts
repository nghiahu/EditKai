import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import { blankStill, inkBox, planOf, stillOf } from './helper';
import type { Layer } from '../../src/plan/types';

const rows = (n: number) => Array.from({ length: n }, (_, i) => ({ icon: ['clock', 'zap', 'rocket', 'star'][i], value: `~${30 + i} phút`, caption: `dòng ${i + 1}` }));
const card = (props: Record<string, unknown>): Layer => ({ id: 's1', track: 'graphic', type: 'stat-card', start: 0, end: 4, props: { rows: rows(2), ...props } });
const bytes = async (props: Record<string, unknown>, frame: number, style: 's1' | 'm1' = 'm1') => readFileSync(await stillOf(planOf(style, [card(props)]), frame));
const T = 300000;

describe('stat-card render', () => {
  for (const style of ['s1', 'm1'] as const) {
    it(`${style}: rows arrive one after another (frame 6 differs from frame 40)`, async () => {
      expect((await bytes({ rows: rows(4) }, 6, style)).equals(await bytes({ rows: rows(4) }, 40, style))).toBe(false);
    }, T);
    it(`${style}: the last frame equals a blank frame`, async () => {
      expect((await bytes({ rows: rows(4), title: 'Thời gian' }, 119, style)).equals(readFileSync(await blankStill(style, 119)))).toBe(true);
    }, T);
  }
  it('four rows differ from one row', async () => {
    expect((await bytes({ rows: rows(4) }, 60)).equals(await bytes({ rows: rows(1) }, 60))).toBe(false);
  }, T);
  it('a title changes the picture', async () => {
    expect((await bytes({ title: 'Thời gian' }, 60)).equals(await bytes({}, 60))).toBe(false);
  }, T);
  it('a row without an icon or caption renders', async () => {
    expect((await bytes({ rows: [{ value: '5–10 phút' }] }, 60)).length).toBeGreaterThan(1000);
  }, T);
  it('a 40-character value and a 60-character caption stay inside the frame (Review Focus 4)', async () => {
    const long = [{ icon: 'clock', value: 'một giá trị rất rất rất dài, bốn mươi ký tự', caption: 'một chú thích cũng rất dài để thử xem nó có tràn ra khỏi thẻ hay không' }];
    const box = await inkBox(await stillOf(planOf('m1', [card({ rows: long })]), 60));
    expect(box.w).toBeLessThan(1080);
    expect(box.x).toBeGreaterThan(0);
  }, T);
  it('top, center and bottom give three different pictures', async () => {
    const [t, c, b] = [await bytes({ position: 'top' }, 60), await bytes({ position: 'center' }, 60), await bytes({ position: 'bottom' }, 60)];
    expect(t.equals(c)).toBe(false);
    expect(c.equals(b)).toBe(false);
    expect(t.equals(b)).toBe(false);
  }, T);
});
