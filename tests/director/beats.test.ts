import { describe, it, expect } from 'vitest';
import { normalizeLoose, tokens } from '../../src/director/text';
import { segmentBeats } from '../../src/director/beats';

const word = (t: string, s: number, e = s + 0.25) => ({ t, s, e });
/** Words spaced 0.3 s apart; `gapAfter[i]` adds extra silence after word i. */
function say(text: string, gapAfter: Record<number, number> = {}) {
  let t = 0;
  return text.split(' ').map((w, i) => {
    const out = word(w, t);
    t += 0.3 + (gapAfter[i] ?? 0);
    return out;
  });
}

describe('normalizeLoose and tokens', () => {
  it('NFC and NFD forms are equal and lose diacritics', () => {
    const nfc = 'Đây Là Giao Diện'.normalize('NFC');
    const nfd = 'Đây Là Giao Diện'.normalize('NFD');
    expect(normalizeLoose(nfc)).toBe('day la giao dien');
    expect(normalizeLoose(nfd)).toBe('day la giao dien');
  });
  it('drops punctuation at the ends but keeps % and digits', () => {
    expect(normalizeLoose('token.')).toBe('token');
    expect(normalizeLoose('"Claude,"')).toBe('claude');
    expect(normalizeLoose('2-3%')).toBe('2-3%');
    expect(normalizeLoose('...')).toBe('');
  });
  it('tokens splits on whitespace and drops empty tokens', () => {
    expect(tokens('Quá  đẳng cấp ... rồi!')).toEqual(['qua', 'dang', 'cap', 'roi']);
  });
});

describe('segmentBeats', () => {
  it('cuts at sentence punctuation', () => {
    const w = say('Quá đẳng cấp rồi. Claude vừa trả video edit? Tuyệt vời!');
    const spans = segmentBeats(w);
    expect(spans.map(s => [s.firstWord, s.lastWord])).toEqual([[0, 3], [4, 8], [9, 10]]);
    expect(spans[0].text).toBe('Quá đẳng cấp rồi.');
  });
  it('cuts at a pause longer than 0.6 s even without punctuation', () => {
    const w = say('một hai ba bốn năm sáu', { 2: 0.9 });
    expect(segmentBeats(w).map(s => [s.firstWord, s.lastWord])).toEqual([[0, 2], [3, 5]]);
  });
  it('a pause of exactly 0.5 s does not cut', () => {
    expect(segmentBeats(say('một hai ba bốn', { 1: 0.5 }))).toHaveLength(1);
  });
  it('a 30-word run with no punctuation and no pause becomes beats of at most 14 words (Review Focus 1)', () => {
    const w = say(Array.from({ length: 30 }, (_, i) => `từ${i}`).join(' '));
    const spans = segmentBeats(w);
    expect(spans.length).toBeGreaterThanOrEqual(3);
    for (const s of spans) expect(s.lastWord - s.firstWord + 1).toBeLessThanOrEqual(14);
  });
  it('a long run with a comma is cut at the comma', () => {
    const w = say('một hai ba bốn năm, sáu bảy tám chín mười mười_một mười_hai mười_ba mười_bốn mười_lăm mười_sáu');
    const spans = segmentBeats(w);
    expect(spans[0].lastWord).toBe(4);
    for (const s of spans) expect(s.lastWord - s.firstWord + 1).toBeLessThanOrEqual(14);
  });
  it('a long run without commas is cut at its largest pause', () => {
    const w = say(Array.from({ length: 20 }, (_, i) => `a${i}`).join(' '), { 8: 0.4 });
    expect(segmentBeats(w)[0].lastWord).toBe(8);
  });
  it('0, 1 and 2 words give [] and one beat each (Review Focus 1)', () => {
    expect(segmentBeats([])).toEqual([]);
    expect(segmentBeats(say('xin'))).toHaveLength(1);
    expect(segmentBeats(say('xin chào'))).toHaveLength(1);
  });
  it('spans are contiguous and cover every word once', () => {
    const w = say('một hai. ba bốn năm sáu bảy tám chín mười mười_một mười_hai mười_ba mười_bốn mười_lăm mười_sáu mười_bảy. cuối cùng', { 5: 0.7 });
    const spans = segmentBeats(w);
    expect(spans[0].firstWord).toBe(0);
    expect(spans.at(-1)!.lastWord).toBe(w.length - 1);
    for (let i = 1; i < spans.length; i++) expect(spans[i].firstWord).toBe(spans[i - 1].lastWord + 1);
  });
  it('start and end come from the first and last word', () => {
    const w = say('một hai. ba bốn');
    const [a, b] = segmentBeats(w);
    expect(a.start).toBe(w[0].s);
    expect(a.end).toBe(w[1].e);
    expect(b.start).toBe(w[2].s);
  });
  it('repeated or backwards word times do not throw and still cover every word', () => {
    const w = [word('một', 1, 1.2), word('hai', 1, 1.2), word('ba', 0.5, 0.7), word('bốn.', 0.2, 0.4), word('năm', 5, 5.2)];
    const spans = segmentBeats(w);
    expect(spans.reduce((n, s) => n + (s.lastWord - s.firstWord + 1), 0)).toBe(5);
    for (const s of spans) expect(Number.isFinite(s.start) && Number.isFinite(s.end)).toBe(true);
  });
});

describe('segmentBeats and tiny beats', () => {
  it('a one-word beat joins the beat before it (captions never cross beats, so a stray word would flash alone)', () => {
    const w = say('một hai ba bốn năm. nào');
    const spans = segmentBeats(w);
    expect(spans.map(s => [s.firstWord, s.lastWord])).toEqual([[0, 5]]);
    expect(spans[0].text).toBe('một hai ba bốn năm. nào');
    expect(spans[0].end).toBe(w[5].e);
  });
  it('a beat shorter than 0.4 s joins the previous one even with two words', () => {
    const w = [word('một', 0), word('hai.', 0.4), word('à', 1.5, 1.6), word('ừ', 1.65, 1.75), word('ba', 3), word('bốn.', 3.4)];
    const spans = segmentBeats(w);
    expect(spans.map(s => [s.firstWord, s.lastWord])).toEqual([[0, 3], [4, 5]]);
  });
  it('a one-word beat at the very start joins the next beat', () => {
    expect(segmentBeats(say('ừ. một hai ba bốn')).map(s => [s.firstWord, s.lastWord])).toEqual([[0, 4]]);
  });
  it('a two-word beat of normal length stays a beat', () => {
    expect(segmentBeats(say('Quá đẳng cấp rồi. Tuyệt vời!')).map(s => [s.firstWord, s.lastWord])).toEqual([[0, 3], [4, 5]]);
  });
  it('a lone word is still one beat', () => {
    expect(segmentBeats(say('xin'))).toHaveLength(1);
  });
});

