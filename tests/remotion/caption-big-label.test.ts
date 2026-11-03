import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import { blankStill, planOf, stillOf } from './helper';
import type { Layer } from '../../src/plan/types';

const cap = (props: Record<string, unknown>, words?: string[], hl = 'ftf'): Layer => ({
  id: 'c1', track: 'caption', start: 0, end: 4, props,
  words: (words ?? ['Edit', 'video', 'nhanh']).map((t, i) => ({ t, s: 0.2 + i * 0.4, e: 0.5 + i * 0.4, hl: hl[i] === 't' })),
});
const bytes = async (style: 's1' | 'm1', layer: Layer, frame: number) => readFileSync(await stillOf(planOf(style, [layer]), frame));
const blank = async (style: 's1' | 'm1', frame: number) => readFileSync(await blankStill(style, frame));
const T = 240000;

describe('big caption', () => {
  for (const style of ['s1', 'm1'] as const) {
    it(`${style}: big differs from phrase at frame 40`, async () => {
      expect((await bytes(style, cap({ variant: 'big' }), 40)).equals(await bytes(style, cap({ variant: 'phrase' }), 40))).toBe(false);
    }, T);
    it(`${style}: the last frame equals a blank frame`, async () => {
      expect((await bytes(style, cap({ variant: 'big', handles: true }), 119)).equals(await blank(style, 119))).toBe(true);
    }, T);
  }
  it('m1 big is still springing at frame 6 and settled by frame 24 (it overshoots)', async () => {
    expect((await bytes('m1', cap({ variant: 'big' }), 6)).equals(await bytes('m1', cap({ variant: 'big' }), 24))).toBe(false);
  }, T);
  it('handles change the picture, and are ignored for a phrase', async () => {
    expect((await bytes('m1', cap({ variant: 'big', handles: true }), 40)).equals(await bytes('m1', cap({ variant: 'big' }), 40))).toBe(false);
    expect((await bytes('m1', cap({ variant: 'phrase', handles: true }), 40)).equals(await bytes('m1', cap({ variant: 'phrase' }), 40))).toBe(true);
  }, T);
  it('big is centred by default; top and bottom differ from it', async () => {
    const [d, c, t, b] = [await bytes('m1', cap({ variant: 'big' }), 40), await bytes('m1', cap({ variant: 'big', position: 'center' }), 40), await bytes('m1', cap({ variant: 'big', position: 'top' }), 40), await bytes('m1', cap({ variant: 'big', position: 'bottom' }), 40)];
    expect(d.equals(c)).toBe(true);
    expect(t.equals(c)).toBe(false);
    expect(b.equals(c)).toBe(false);
  }, T);
  it('a 30-character word in big and 25 words in a phrase render without throwing (Review Focus 2)', async () => {
    await bytes('m1', cap({ variant: 'big' }, ['x'.repeat(30)], 't'), 40);
    await bytes('s1', cap({ variant: 'phrase' }, Array.from({ length: 25 }, (_, i) => `từ${i}`), ''), 40);
  }, T);
});

describe('label caption', () => {
  const label = { variant: 'label', label: 'nó mở thêm' };
  for (const style of ['s1', 'm1'] as const) {
    it(`${style}: the label adds a line, so it differs from a phrase`, async () => {
      expect((await bytes(style, cap(label), 40)).equals(await bytes(style, cap({ variant: 'phrase' }), 40))).toBe(false);
    }, T);
    it(`${style}: the last frame equals a blank frame`, async () => {
      expect((await bytes(style, cap(label), 119)).equals(await blank(style, 119))).toBe(true);
    }, T);
  }
  it('the label arrives before the main line: frame 3 differs from a phrase at frame 3', async () => {
    expect((await bytes('m1', cap(label), 3)).equals(await bytes('m1', cap({ variant: 'phrase' }), 3))).toBe(false);
  }, T);
  it('a missing or empty label degrades to a plain phrase (Review Focus 5)', async () => {
    const phrase = await bytes('m1', cap({ variant: 'phrase' }), 40);
    expect((await bytes('m1', cap({ variant: 'label' }), 40)).equals(phrase)).toBe(true);
    expect((await bytes('m1', cap({ variant: 'label', label: '' }), 40)).equals(phrase)).toBe(true);
  }, T);
});

describe('empty words (Review Focus 1)', () => {
  it('render and end blank for big and label', async () => {
    for (const props of [{ variant: 'big' }, { variant: 'label', label: 'nhãn' }]) {
      const layer: Layer = { ...cap(props), words: [] };
      await bytes('m1', layer, 40); // must not throw
      expect((await bytes('m1', layer, 119)).equals(await blank('m1', 119))).toBe(true);
    }
  }, T);
});
