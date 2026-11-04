import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import { blankStill, inkBox, meanLuma, planOf, stillOf } from './helper';
import type { Layer } from '../../src/plan/types';

const T = 300000;
const quote = (props: Record<string, unknown>): Layer => ({ id: 'q1', track: 'graphic', type: 'quote-card', start: 0, end: 4, props: { quote: 'Khán giả thích nghe bạn vượt qua khó khăn hơn là khoe thành công', ...props } });
const counter = (props: Record<string, unknown>): Layer => ({ id: 'n1', track: 'graphic', type: 'counter', start: 0, end: 4, props: { to: 1250, suffix: ' triệu', label: 'lượt xem', ...props } });
const bytes = async (layer: Layer, frame: number, style: 's1' | 'm1' = 'm1') => readFileSync(await stillOf(planOf(style, [layer]), frame));

describe('quote-card render', () => {
  for (const style of ['s1', 'm1'] as const) {
    it(`${style}: the words arrive one after another (frame 14 differs from frame 70), and the last frame equals a blank frame`, async () => {
      expect((await bytes(quote({}), 14, style)).equals(await bytes(quote({}), 70, style))).toBe(false);
      expect((await bytes(quote({}), 119, style)).equals(readFileSync(await blankStill(style, 119)))).toBe(true);
    }, T);
  }
  it('the quote fills in word by word: the card gives more light when every word has arrived than at the start', async () => {
    const q = quote({ quote: 'Khán giả sẽ luôn luôn thích nghe bạn vượt qua khó khăn như thế nào hơn là việc bạn khoe ra những thành công của bản thân mình' });
    const early = await stillOf(planOf('m1', [q]), 24);
    const late = await stillOf(planOf('m1', [q]), 80);
    const box = await inkBox(late); // the card
    expect(await meanLuma(late, box)).toBeGreaterThan((await meanLuma(early, box)) + 2);
  }, T);
  it('an author changes the picture, and a different position does too', async () => {
    const plain = await bytes(quote({}), 80);
    expect(plain.equals(await bytes(quote({ author: 'Disney' }), 80))).toBe(false);
    expect(plain.equals(await bytes(quote({ position: 'top' }), 80))).toBe(false);
  }, T);
  it('a 240-character quote stays inside the frame', async () => {
    const long = 'rất '.repeat(59).trim() + '!';
    const box = await inkBox(await stillOf(planOf('m1', [quote({ quote: long.slice(0, 240), author: 'Một người nói rất dài dòng' })]), 100));
    expect(box.x).toBeGreaterThan(0);
    expect(box.x + box.w).toBeLessThan(1080);
    expect(box.y + box.h).toBeLessThan(1920);
  }, T);
  it('a one-word quote renders', async () => {
    expect((await bytes(quote({ quote: 'Peace' }), 80)).length).toBeGreaterThan(1000);
  }, T);
});

describe('counter render', () => {
  for (const style of ['s1', 'm1'] as const) {
    it(`${style}: the number counts up (frame 12 differs from frame 100), and the last frame equals a blank frame`, async () => {
      expect((await bytes(counter({}), 12, style)).equals(await bytes(counter({}), 100, style))).toBe(false);
      expect((await bytes(counter({}), 119, style)).equals(readFileSync(await blankStill(style, 119)))).toBe(true);
    }, T);
  }
  it('once it has arrived the number holds still (frames 90 and 105 are equal)', async () => {
    expect((await bytes(counter({}), 90)).equals(await bytes(counter({}), 105))).toBe(true);
  }, T);
  it('a prefix, a suffix and a label each change the picture', async () => {
    const base = await bytes(counter({ suffix: undefined, label: undefined }), 90);
    expect(base.equals(await bytes(counter({ suffix: '%', label: undefined }), 90))).toBe(false);
    expect(base.equals(await bytes(counter({ prefix: '+', suffix: undefined, label: undefined }), 90))).toBe(false);
    expect(base.equals(await bytes(counter({ suffix: undefined }), 90))).toBe(false);
  }, T);
  it('a long number with a suffix stays inside the frame, and a count down to 0 renders', async () => {
    const box = await inkBox(await stillOf(planOf('m1', [counter({ to: 1234567890, suffix: ' đồng', decimals: 0 })]), 100));
    expect(box.x).toBeGreaterThan(0);
    expect(box.x + box.w).toBeLessThan(1080);
    expect((await bytes(counter({ from: 100, to: 0 }), 90)).length).toBeGreaterThan(1000);
  }, T);
});
