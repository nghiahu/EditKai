import { describe, it, expect } from 'vitest';
import { readFileSync, statSync } from 'node:fs';
import { planOf, stillOf } from './helper';
import type { Layer } from '../../src/plan/types';

const caption = (hl: boolean): Layer => ({
  id: 'c1', track: 'caption', start: 0, end: 4,
  words: [{ t: 'Edit', s: 0.1, e: 0.4, hl: false }, { t: 'video', s: 0.5, e: 0.9, hl }, { t: 'nhanh', s: 1, e: 1.4, hl: false }],
});

describe('Caption', () => {
  for (const style of ['s1', 'm1'] as const) {
    it(`renders a ${style} frame`, async () => {
      const png = await stillOf(planOf(style, [caption(true)]), 10);
      expect(statSync(png).size).toBeGreaterThan(1000);
    }, 240000);
  }
  it('highlighting a word changes the picture', async () => {
    const a = readFileSync(await stillOf(planOf('m1', [caption(false)]), 10));
    const b = readFileSync(await stillOf(planOf('m1', [caption(true)]), 10));
    expect(a.equals(b)).toBe(false);
  }, 240000);
  it('s1 and m1 look different for the same caption', async () => {
    const a = readFileSync(await stillOf(planOf('s1', [caption(true)]), 10));
    const b = readFileSync(await stillOf(planOf('m1', [caption(true)]), 10));
    expect(a.equals(b)).toBe(false);
  }, 240000);
});
