import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import { blankStill, planOf, stillOf } from './helper';
import type { Layer } from '../../src/plan/types';

const WORDS = [['Edit', 0.2], ['video', 0.6], ['nhanh', 1.0], ['gọn', 1.4]] as const;
const cap = (props: Record<string, unknown> | undefined, hl = 'ffff', start = 0, end = 4, count = 4): Layer => ({
  id: 'c1', track: 'caption', start, end, ...(props === undefined ? {} : { props }),
  words: WORDS.slice(0, count).map(([t, s], i) => ({ t, s, e: s + 0.3, hl: hl[i] === 't' })),
});
const bytes = async (style: 's1' | 'm1', layer: Layer, frame: number) => readFileSync(await stillOf(planOf(style, [layer]), frame));
const blank = async (style: 's1' | 'm1', frame: number) => readFileSync(await blankStill(style, frame));
const T = 240000;

describe('phrase caption', () => {
  for (const style of ['s1', 'm1'] as const) {
    it(`${style}: the whole phrase is up at once — settled frames 40 and 41 are identical while the word variant still builds at 33 and 34`, async () => {
      expect((await bytes(style, cap({ variant: 'phrase' }), 40)).equals(await bytes(style, cap({ variant: 'phrase' }), 41))).toBe(true);
      expect((await bytes(style, cap({ variant: 'word' }), 33)).equals(await bytes(style, cap({ variant: 'word' }), 34))).toBe(false);
    }, T);
    it(`${style}: text is already up at frame 12 (differs from blank)`, async () => {
      expect((await bytes(style, cap({}), 12)).equals(await blank(style, 12))).toBe(false);
    }, T);
    it(`${style}: the last frame equals a blank frame`, async () => {
      expect((await bytes(style, cap({}, 'fttf'), 119)).equals(await blank(style, 119))).toBe(true);
    }, T);
    it(`${style}: box, ink and underline give three different pictures at frame 40`, async () => {
      const [a, b, c] = [await bytes(style, cap({ emphasis: 'box' }, 'fttf'), 40), await bytes(style, cap({ emphasis: 'ink' }, 'fttf'), 40), await bytes(style, cap({ emphasis: 'underline' }, 'fttf'), 40)];
      expect(a.equals(b)).toBe(false);
      expect(b.equals(c)).toBe(false);
      expect(a.equals(c)).toBe(false);
    }, T);
    it(`${style}: two separate highlighted runs differ from one merged run`, async () => {
      expect((await bytes(style, cap({ emphasis: 'box' }, 'ftft'), 40)).equals(await bytes(style, cap({ emphasis: 'box' }, 'fttf'), 40))).toBe(false);
    }, T);
    it(`${style}: top, center and bottom give three different pictures at frame 40`, async () => {
      const [t, c, b] = [await bytes(style, cap({ position: 'top' }), 40), await bytes(style, cap({ position: 'center' }), 40), await bytes(style, cap({ position: 'bottom' }), 40)];
      expect(t.equals(c)).toBe(false);
      expect(c.equals(b)).toBe(false);
      expect(t.equals(b)).toBe(false);
    }, T);
  }
  it('m1: the box is still wiping at frame 8 and complete at frame 20', async () => {
    expect((await bytes('m1', cap({ emphasis: 'box' }, 'fttf'), 8)).equals(await bytes('m1', cap({ emphasis: 'box' }, 'fttf'), 20))).toBe(false);
  }, T);
  it('a layer shorter than the box wipe (0.2 s) renders and ends blank (Review Focus 3)', async () => {
    expect((await bytes('m1', cap({ emphasis: 'box' }, 'fttf', 0, 0.2), 5)).equals(await blank('m1', 5))).toBe(true);
    expect((await bytes('m1', cap({ emphasis: 'box' }, 'fttf', 0, 0.2), 3)).equals(await blank('m1', 3))).toBe(false);
  }, T);
  it('empty words, all words highlighted and no highlighted word render and end blank (Review Focus 1)', async () => {
    const empty: Layer = { ...cap({}), words: [] };
    for (const layer of [empty, cap({ emphasis: 'box' }, 'tttt'), cap({ emphasis: 'box' }, 'ffff')]) {
      expect((await bytes('m1', layer, 119)).equals(await blank('m1', 119))).toBe(true);
      await bytes('m1', layer, 40); // must not throw
    }
  }, T);
  it('free-text props render like the defaults (Review Focus 4)', async () => {
    const odd = await bytes('s1', cap({ variant: 'Phrase', position: 'middle', emphasis: 5 }, 'fttf'), 40);
    expect(odd.equals(await bytes('s1', cap(undefined, 'fttf'), 40))).toBe(true);
  }, T);
});
