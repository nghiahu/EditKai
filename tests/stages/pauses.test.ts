import { describe, expect, it } from 'vitest';
import { describePauses } from '../../src/stages/pauses';

const words = ['một', 'hai', 'ba', 'bốn', 'năm', 'sáu', 'bảy', 'tám'].map((t, i) => ({ t, s: i * 1, e: i * 1 + 0.9 }));

describe('describePauses', () => {
  it('lists each pause with its length and the words around it', () => {
    const lines = describePauses(words, [{ start: 3.9, end: 4.2 }], 2);
    expect(lines).toHaveLength(1);
    expect(lines[0]).toContain('3.90–4.20');
    expect(lines[0]).toContain('0.30 s');
    expect(lines[0]).toContain('ba bốn'); // before
    expect(lines[0]).toContain('năm sáu'); // after
  });
  it('numbers the pauses and gives none for none', () => {
    expect(describePauses(words, [{ start: 1.9, end: 2.2 }, { start: 5.9, end: 6.2 }], 2).map(l => l.trim().split(' ')[0])).toEqual(['1.', '2.']);
    expect(describePauses(words, [], 2)).toEqual([]);
  });
});
