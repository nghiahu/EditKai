import { describe, expect, it } from 'vitest';
import { checkJoins, cutPoint, findPhrase, joinTimes, selectSpans, snapToShots } from '../../src/media/condense';

type W = { t: string; s: number; e: number };
/** Words of a sentence, 0.3 s each, back to back. */
const words = (text: string): W[] => text.split(' ').map((t, i) => ({ t, s: i * 0.3, e: i * 0.3 + 0.3 }));

describe('findPhrase', () => {
  const norm = ['cau', 'chuyen', 'voi', 'minh', 'la', 'mot', 'cau', 'chuyen'];
  it('finds a phrase ignoring case, tone marks and punctuation, at or after a given word', () => {
    expect(findPhrase(norm, 'câu chuyện', 0)).toBe(0);
    expect(findPhrase(norm, 'câu chuyện', 1)).toBe(6);
  });
  it('throws a clear message when the phrase is not there, so a typo never cuts the wrong part', () => {
    expect(() => findPhrase(norm, 'không có đâu', 0)).toThrow(/không có đâu/);
    expect(() => findPhrase(norm, 'câu chuyện', 7)).toThrow(/câu chuyện/);
  });
});

describe('selectSpans', () => {
  const w = words('một hai ba bốn năm sáu bảy tám chín mười');
  it('turns from/to phrases into word spans, in order', () => {
    expect(selectSpans(w, [{ from: 'hai', to: 'ba' }, { from: 'sáu', to: 'bảy' }])).toEqual([{ first: 1, last: 2 }, { first: 5, last: 6 }]);
  });
  it('joins two spans that are next to each other in the speech (no join needed)', () => {
    expect(selectSpans(w, [{ from: 'hai', to: 'ba' }, { from: 'bốn', to: 'năm' }])).toEqual([{ first: 1, last: 4 }]);
  });
  it('a later phrase is looked for after the earlier one, so a repeated word picks the right occurrence', () => {
    const rep = words('a b c a b c');
    expect(selectSpans(rep, [{ from: 'a', to: 'b' }, { from: 'a', to: 'b' }])).toEqual([{ first: 0, last: 1 }, { first: 3, last: 4 }]);
  });
});

describe('cutPoint', () => {
  const quiet = (n: number, from: number, to: number, base = 1) => Array.from({ length: n }, (_, f) => (f >= from && f < to ? 0.02 : base)); // 10 ms frames
  it('a start close after a real pause is cut in the middle of that pause', () => {
    const c = cutPoint(5.0, 'start', [{ start: 4.7, end: 4.95 }], quiet(1000, 470, 495), 1);
    expect(c.time).toBeCloseTo(4.825, 3);
    expect(c.how).toMatch(/ngừng/);
    expect(c.weak).toBe(false);
  });
  it('an end looks for a pause after the word, not before it', () => {
    expect(cutPoint(5.0, 'end', [{ start: 5.1, end: 5.4 }], quiet(1000, 510, 540), 1).time).toBeCloseTo(5.25, 3);
    expect(cutPoint(5.0, 'end', [{ start: 4.2, end: 4.4 }], quiet(1000, 420, 440), 1).how).toMatch(/KHÔNG/); // too far before
  });
  it('without a pause it stays right next to the word time and takes the quietest moment there', () => {
    const env = Array.from({ length: 1000 }, (_, f) => (f === 505 ? 0.1 : 1)); // one dip at 5.05 s, just after the word
    const c = cutPoint(5.0, 'start', [], env, 1);
    expect(c.how).toMatch(/KHÔNG/);
    expect(c.time).toBeCloseTo(5.055, 2);
  });
  it('flags a cut in the middle of loud speech as weak', () => {
    const loud = cutPoint(5.0, 'end', [], Array(1000).fill(0.9), 1);
    expect(loud.weak).toBe(true);
    expect(cutPoint(5.0, 'end', [], Array(1000).fill(0.05), 1).weak).toBe(false);
  });
});

describe('snapToShots', () => {
  it('a source cut just inside the start moves the start to it; one just inside the end pulls the end back before it', () => {
    expect(snapToShots(10.0, 20.0, [10.1]).start).toBeCloseTo(10.1, 5);
    expect(snapToShots(10.0, 20.0, [19.95]).end).toBeCloseTo(19.93, 5);
  });
  it('source cuts further away, or on the wrong side, change nothing', () => {
    const r = snapToShots(10.0, 20.0, [9.9, 10.5, 19.5, 20.1, 30]);
    expect([r.start, r.end]).toEqual([10.0, 20.0]);
    expect(r.notes).toEqual([]);
  });
  it('says what it moved', () => {
    expect(snapToShots(10.0, 20.0, [10.1, 19.95]).notes).toHaveLength(2);
  });
});

describe('joinTimes', () => {
  it('are the running total of the kept lengths, without the last one', () => {
    expect(joinTimes([{ start: 0, end: 10 }, { start: 50, end: 55 }, { start: 90, end: 92 }])).toEqual([10, 15]);
    expect(joinTimes([{ start: 0, end: 10 }])).toEqual([]);
  });
});

describe('checkJoins', () => {
  const heard = (list: [string, number][]): W[] => list.map(([t, s]) => ({ t, s, e: s + 0.25 }));
  it('a word nobody asked for right at a join is reported; a different spelling of a wanted word is not', () => {
    const expected = ['đầu', 'video', 'phần', 'thân', 'bài'];
    const r = checkJoins(expected, heard([['đầu', 9.2], ['video', 9.5], ['chính', 9.9], ['phần', 10.1], ['thân', 10.4], ['bài', 10.7]]), [10.0]);
    expect(r).toHaveLength(1);
    expect(r[0].odd).toEqual(['chính']);
    const spelled = checkJoins(['khán', 'giả'], heard([['khán', 9.9], ['giản', 10.2]]), [10.0]);
    expect(spelled[0].odd).toEqual([]);
  });
  it('an extra word far from every join is not a problem of the join', () => {
    const r = checkJoins(['a', 'b'], heard([['a', 1], ['x', 2], ['b', 10]]), [10.0]);
    expect(r[0].odd).toEqual([]);
  });
  it('the context shows the words around the join with the one on the join in brackets', () => {
    const r = checkJoins(['a', 'b', 'c'], heard([['a', 9.0], ['b', 9.9], ['c', 10.3]]), [10.0]);
    expect(r[0].context).toContain('[b]');
  });
});
