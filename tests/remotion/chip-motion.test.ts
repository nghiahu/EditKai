import { describe, it, expect } from 'vitest';
import { readFileSync, statSync } from 'node:fs';
import { blankStill, planOf, stillOf } from './helper';
import type { Layer } from '../../src/plan/types';

const labels = ['Typography', 'Graphic', 'Motion', 'Âm thanh'];
const chips = (n = 4): Layer => ({
  id: 'k1', track: 'graphic', type: 'chip-stack', start: 0, end: 4,
  props: { chips: labels.slice(0, n).map(label => ({ icon: 'typography', label })) },
});
const bytes = async (style: 's1' | 'm1', frame: number, layer = chips()) => readFileSync(await stillOf(planOf(style, [layer]), frame));

describe('ChipStack motion', () => {
  for (const style of ['s1', 'm1'] as const) {
    it(`${style}: at frame 4 the stack is less complete than at frame 40`, async () => {
      const early = await bytes(style, 4), later = await bytes(style, 40);
      expect(early.equals(later)).toBe(false);
      expect(early.equals(readFileSync(await blankStill(style, 4)))).toBe(false); // the first chip is already arriving
    }, 240000);
    it(`${style}: the shine sweep runs after landing and then stops (frames 30 vs 36 differ, 90 vs 91 are identical)`, async () => {
      expect((await bytes(style, 30)).equals(await bytes(style, 36))).toBe(false);
      expect((await bytes(style, 90)).equals(await bytes(style, 91))).toBe(true);
    }, 240000);
    it(`${style}: the last frame equals a blank frame`, async () => {
      expect((await bytes(style, 119)).equals(readFileSync(await blankStill(style, 119)))).toBe(true);
    }, 240000);
  }
  it('one chip and zero chips render without throwing', async () => {
    expect(statSync(await stillOf(planOf('m1', [chips(1)]), 20)).size).toBeGreaterThan(1000);
    expect(statSync(await stillOf(planOf('m1', [chips(0)]), 20)).size).toBeGreaterThan(1000);
  }, 240000);
});
