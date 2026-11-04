import { describe, expect, it } from 'vitest';
import { inkBox, lumaAt, planOf, stillOf } from './helper';
import { loadTheme } from '../../src/style/theme';
import type { Layer } from '../../src/plan/types';

// a white picture, like the white panel of a source video: text there used to disappear
const whiteTheme = () => { const t = loadTheme('styles/m1'); return { ...t, colors: { ...t.colors, navy: '#FFFFFF', black: '#FFFFFF' } }; };

const cap = (props: Record<string, unknown>): Layer => ({
  id: 'c1', track: 'caption', start: 0, end: 4, props,
  words: ['Đầu', 'tiên', 'là', 'phần'].map((t, i) => ({ t, s: 0.2 + i * 0.3, e: 0.4 + i * 0.3, hl: false })),
});

describe('caption backdrop', () => {
  it('a plate darkens the picture behind the text; without it a white picture stays white', async () => {
    const plain = await stillOf(planOf('m1', [cap({})]), 60, { theme: whiteTheme() });
    const plate = await stillOf(planOf('m1', [cap({ backdrop: 'plate' })]), 60, { theme: whiteTheme() });
    const box = await inkBox(await stillOf(planOf('m1', [cap({})]), 60)); // where the text sits, measured on the normal dark picture
    const x = box.x - 14, y = box.y + Math.round(box.h / 2); // in the padding, left of the text
    expect(await lumaAt(plain, x, y)).toBeGreaterThan(240);
    expect(await lumaAt(plate, x, y)).toBeLessThan(120);
  }, 240000);
  it('the plate works for the word variant too', async () => {
    const plain = await stillOf(planOf('m1', [cap({ variant: 'word' })]), 80, { theme: whiteTheme() });
    const plate = await stillOf(planOf('m1', [cap({ variant: 'word', backdrop: 'plate' })]), 80, { theme: whiteTheme() });
    const box = await inkBox(await stillOf(planOf('m1', [cap({ variant: 'word' })]), 80));
    const x = box.x - 14, y = box.y + Math.round(box.h / 2);
    expect(await lumaAt(plain, x, y)).toBeGreaterThan(240);
    expect(await lumaAt(plate, x, y)).toBeLessThan(120);
  }, 240000);
});
