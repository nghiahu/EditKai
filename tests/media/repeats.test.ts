import { describe, it, expect } from 'vitest';
import { findRepeats, findSuspectRepeats } from '../../src/media/repeats';

const tr = (...w: [string, number, number][]) => ({ words: w.map(([t, s, e]) => ({ t, s, e })) });

describe('findRepeats', () => {
  it('does not cut a single repeated word (Vietnamese reduplication: "từ từ", "dần dần")', () => {
    expect(findRepeats(tr(['đi', 0, 0.2], ['từ', 0.3, 0.5], ['từ', 0.6, 0.8], ['thôi', 0.9, 1.1]))).toEqual([]);
  });
  it('lists single repeated words as suspects for review instead', () => {
    expect(findSuspectRepeats(tr(['đi', 0, 0.2], ['từ', 0.3, 0.5], ['từ', 0.6, 0.8], ['thôi', 0.9, 1.1])))
      .toEqual([{ word: 'từ', start: 0.3, end: 0.5 }]);
  });
  it('ignores non-adjacent repeats', () => {
    expect(findRepeats(tr(['tôi', 0, 0.3], ['muốn', 0.4, 0.7], ['tôi', 0.8, 1.1]))).toEqual([]);
  });
  it('finds a repeated two-word phrase', () => {
    const r = findRepeats(tr(['em', 0, 0.2], ['muốn', 0.3, 0.6], ['em', 0.7, 0.9], ['muốn', 1, 1.3], ['đi', 1.4, 1.6]));
    expect(r).toEqual([{ start: 0, end: 0.6 }]);
  });
  it('treats NFC and NFD spellings as the same word', () => {
    const r = findRepeats(tr(['Đây'.normalize('NFD'), 0, 0.3], ['em', 0.3, 0.5], ['Đây'.normalize('NFC'), 0.6, 0.9], ['em', 0.9, 1.1]));
    expect(r).toHaveLength(1);
  });
});
