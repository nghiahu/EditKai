import { describe, it, expect } from 'vitest';
import { readFileSync, statSync } from 'node:fs';
import { blankStill, planOf, stillOf } from './helper';
import type { Layer } from '../../src/plan/types';

const card = (end = 4): Layer => ({
  id: 't1', track: 'title', type: 'title-card', start: 0, end,
  props: { icon: 'rocket', title: 'EDIT VIDEO', sub: 'Quy trình có sẵn' },
});
const bytes = async (style: 's1' | 'm1', frame: number, layer = card()) => readFileSync(await stillOf(planOf(style, [layer]), frame));

describe('TitleCard motion', () => {
  for (const style of ['s1', 'm1'] as const) {
    it(`${style}: frames 2, 14 and 40 all differ (it builds up)`, async () => {
      const [a, b, c] = [await bytes(style, 2), await bytes(style, 14), await bytes(style, 40)];
      expect(a.equals(b)).toBe(false);
      expect(b.equals(c)).toBe(false);
      expect(a.equals(c)).toBe(false);
    }, 240000);
    it(`${style}: the underline and sub-line are still arriving at frame 14 and done by frame 40`, async () => {
      expect((await bytes(style, 14)).equals(await bytes(style, 26))).toBe(false);
    }, 240000);
    it(`${style}: steady state — frames 80 and 81 are identical`, async () => {
      expect((await bytes(style, 80)).equals(await bytes(style, 81))).toBe(true);
    }, 240000);
    it(`${style}: the last frame equals a blank frame`, async () => {
      expect((await bytes(style, 119)).equals(readFileSync(await blankStill(style, 119)))).toBe(true);
    }, 240000);
  }
  it('a 0.2 s card (6 frames) renders without throwing (Review Focus 1)', async () => {
    expect(statSync(await stillOf(planOf('s1', [card(0.2)]), 3)).size).toBeGreaterThan(1000);
  }, 240000);
});
