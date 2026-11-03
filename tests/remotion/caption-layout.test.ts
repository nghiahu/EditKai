import { describe, it, expect } from 'vitest';
import { inkBox, planOf, stillOf } from './helper';
import type { Layer } from '../../src/plan/types';

const cap = (props: Record<string, unknown>, words: string[], hl = ''): Layer => ({
  id: 'c1', track: 'caption', start: 0, end: 4, props,
  words: words.map((t, i) => ({ t, s: 0.2 + i * 0.3, e: 0.4 + i * 0.3, hl: hl[i] === 't' })),
});
const ink = async (layer: Layer, frame: number) => inkBox(await stillOf(planOf('m1', [layer]), frame));

describe('centred captions', () => {
  it('the word variant at position center keeps its words on one line (not one word per row)', async () => {
    const b = await ink(cap({ variant: 'word', position: 'center' }, ['Edit', 'video', 'nhanh', 'gọn']), 80);
    expect(b.h).toBeLessThan(250); // one line of 72 px text is about 100 px tall; four stacked rows are 400+
    expect(b.w).toBeGreaterThan(300);
  }, 240000);
  it('big handles hug a short centred word instead of the safe-zone edges', async () => {
    const b = await ink(cap({ variant: 'big', handles: true }, ['token'], 't'), 60);
    expect(b.w).toBeGreaterThan(300);
    expect(b.w).toBeLessThan(760); // the safe zone is ~950 px wide; hugging the word is about 500-600
  }, 240000);
  it('big without handles is centred horizontally', async () => {
    const b = await ink(cap({ variant: 'big' }, ['token']), 60);
    expect(Math.abs(b.x + b.w / 2 - 540)).toBeLessThan(40);
  }, 240000);
});
