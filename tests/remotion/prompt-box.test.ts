import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import { typedText, typingDoneFrame } from '../../remotion/promptTyping';
import { blankStill, inkBox, planOf, stillOf } from './helper';
import type { Layer } from '../../src/plan/types';

const FPS = 30;

describe('typedText and typingDoneFrame', () => {
  const text = 'x'.repeat(60);
  it('is empty before frame 6 and types 28 characters per second after it', () => {
    expect(typedText(text, 0, FPS)).toBe('');
    expect(typedText(text, 6, FPS)).toBe('');
    expect(typedText(text, 6 + 30, FPS)).toHaveLength(28);
    expect(typedText(text, 6 + 15, FPS)).toHaveLength(14);
  });
  it('typingDoneFrame is where the whole text is typed', () => {
    expect(typingDoneFrame('x'.repeat(28), FPS)).toBe(36);
    expect(typingDoneFrame('', FPS)).toBe(6);
    expect(typedText(text, typingDoneFrame(text, FPS), FPS)).toBe(text);
    expect(typedText(text, typingDoneFrame(text, FPS) - 1, FPS).length).toBeLessThan(text.length);
    expect(typedText(text, 10000, FPS)).toBe(text);
  });
  it('is always a prefix of the text', () => {
    for (let f = 0; f < 80; f++) expect(text.startsWith(typedText(text, f, FPS))).toBe(true);
  });
  it('never ends on a lone combining mark for decomposed Vietnamese text (Review Focus 4)', () => {
    const nfd = 'Sửa giúp mình chữ này to hơn, đẹp hơn nữa'.normalize('NFD');
    for (let f = 0; f < 140; f++) {
      const typed = typedText(nfd, f, FPS);
      expect(nfd.startsWith(typed)).toBe(true);
      if (typed.length > 0) expect(/\p{M}$/u.test(typed.slice(-1)) && !/\p{L}\p{M}+$/u.test(typed)).toBe(false);
    }
  });
  it('a negative or non-finite frame types nothing, an empty text stays empty', () => {
    for (const f of [-5, NaN]) expect(typedText(text, f, FPS)).toBe('');
    expect(typedText('', 50, FPS)).toBe('');
  });
});

const prompt = (props: Record<string, unknown>, start = 0, end = 4): Layer => ({
  id: 'p1', track: 'graphic', type: 'prompt-box', start, end, props: { text: 'Sửa giúp mình chữ này to hơn', ...props },
});
const bytes = async (props: Record<string, unknown>, frame: number, style: 's1' | 'm1' = 'm1', start = 0, end = 4) =>
  readFileSync(await stillOf(planOf(style, [prompt(props, start, end)]), frame));
const T = 300000;

describe('prompt-box render', () => {
  for (const style of ['s1', 'm1'] as const) {
    it(`${style}: more is typed at frame 40 than at frame 20`, async () => {
      expect((await bytes({ text: 'x'.repeat(40) }, 40, style)).equals(await bytes({ text: 'x'.repeat(40) }, 20, style))).toBe(false);
    }, T);
    it(`${style}: the last frame equals a blank frame`, async () => {
      expect((await bytes({ strike: true }, 119, style)).equals(readFileSync(await blankStill(style, 119)))).toBe(true);
    }, T);
  }
  it('strike differs from no strike at frame 100', async () => {
    expect((await bytes({ strike: true }, 100)).equals(await bytes({}, 100))).toBe(false);
  }, T);
  it('a placeholder shows before typing starts', async () => {
    expect((await bytes({ placeholder: 'Nhập yêu cầu...' }, 3)).equals(await bytes({}, 3))).toBe(false);
  }, T);
  it('top, center and bottom give three different pictures', async () => {
    const [t, c, b] = [await bytes({ position: 'top' }, 40), await bytes({ position: 'center' }, 40), await bytes({ position: 'bottom' }, 40)];
    expect(t.equals(c)).toBe(false);
    expect(c.equals(b)).toBe(false);
    expect(t.equals(b)).toBe(false);
  }, T);
  it('200 characters in a 1 s layer render inside the frame and end blank (Review Focus 3)', async () => {
    const long = 'từ dài '.repeat(29);
    const png = await stillOf(planOf('m1', [prompt({ text: long }, 0, 1)]), 20);
    const box = await inkBox(png);
    expect(box.w).toBeLessThan(1080);
    expect(box.x).toBeGreaterThan(0);
    expect((await bytes({ text: long }, 29, 'm1', 0, 1)).equals(readFileSync(await blankStill('m1', 29)))).toBe(true);
  }, T);
  it('a single-character text renders', async () => {
    expect((await bytes({ text: 'a' }, 40)).length).toBeGreaterThan(1000);
  }, T);
});
