import { describe, it, expect } from 'vitest';
import { readFileSync, statSync } from 'node:fs';
import { blankStill, planOf, stillOf } from './helper';
import type { Layer } from '../../src/plan/types';

const caption = (start = 0, end = 4, words?: Layer['words']): Layer => ({
  id: 'c1', track: 'caption', start, end,
  words: words ?? [{ t: 'Edit', s: 0.2, e: 0.5, hl: false }, { t: 'video', s: 0.6, e: 0.9, hl: true }, { t: 'nhanh', s: 1.0, e: 1.3, hl: false }],
});
const bytes = async (style: 's1' | 'm1', layer: Layer, frame: number) => readFileSync(await stillOf(planOf(style, [layer]), frame));
const blank = async (style: 's1' | 'm1', frame: number) => readFileSync(await blankStill(style, frame));

describe('Caption motion', () => {
  for (const style of ['s1', 'm1'] as const) {
    it(`${style}: before the first word starts the caption equals a blank frame`, async () => {
      expect((await bytes(style, caption(), 3)).equals(await blank(style, 3))).toBe(true);
    }, 240000);
    it(`${style}: a later frame shows more words than an earlier one`, async () => {
      const early = await bytes(style, caption(), 12), later = await bytes(style, caption(), 24);
      expect(early.equals(later)).toBe(false);
      expect(early.equals(await blank(style, 12))).toBe(false);
      expect(later.equals(await blank(style, 24))).toBe(false);
    }, 240000);
    it(`${style}: the last frame equals a blank frame (exit finished)`, async () => {
      expect((await bytes(style, caption(), 119)).equals(await blank(style, 119))).toBe(true);
    }, 240000);
  }
  it('m1: the highlight box is still wiping 2 frames after the word starts and complete 10 frames later', async () => {
    const a = await bytes('m1', caption(), 20), b = await bytes('m1', caption(), 28);
    expect(a.equals(b)).toBe(false);
  }, 240000);
  it('s1: the underline of a highlighted word keeps drawing after the word is popped', async () => {
    const a = await bytes('s1', caption(), 26), b = await bytes('s1', caption(), 32);
    expect(a.equals(b)).toBe(false);
  }, 240000);
  it('words starting before the layer and a zero-duration word still render (Review Focus 2)', async () => {
    const odd = caption(1, 3, [{ t: 'a', s: 0.5, e: 0.9, hl: false }, { t: 'b', s: 1.5, e: 1.5, hl: true }, { t: 'c', s: 1.5, e: 1.5, hl: false }]);
    expect(statSync(await stillOf(planOf('m1', [odd]), 45)).size).toBeGreaterThan(1000);
  }, 240000);
});
