import type { BeatSpan } from './types';

const MAX_WORDS = 14;
const PAUSE_SEC = 0.6;
const SENTENCE_END = /[.?!…]$/;
const COMMA_END = /[,;:]$/;

/**
 * Cuts a transcript into beats: at sentence punctuation or a pause longer than 0.6 s; a beat of more than 14 words is cut again at
 * a comma, else at the largest pause, else after 14 words. Spans are contiguous and cover every word once.
 */
export function segmentBeats(words: { t: string; s: number; e: number }[]): BeatSpan[] {
  const spans: BeatSpan[] = [];
  const push = (a: number, b: number) =>
    spans.push({ firstWord: a, lastWord: b, start: words[a].s, end: words[b].e, text: words.slice(a, b + 1).map(w => w.t).join(' ') });

  const flush = (from: number, to: number) => {
    let a = from;
    while (to - a + 1 > MAX_WORDS) {
      const limit = a + MAX_WORDS - 1;
      let cut = -1;
      for (let i = limit; i > a; i--) if (COMMA_END.test(words[i].t)) { cut = i; break; }
      if (cut < 0) {
        let best = a;
        let bestGap = -Infinity;
        for (let i = a; i < limit; i++) {
          const gap = words[i + 1].s - words[i].e;
          if (gap > bestGap) { bestGap = gap; best = i; }
        }
        cut = bestGap > 0 ? best : limit;
      }
      push(a, cut);
      a = cut + 1;
    }
    push(a, to);
  };

  let first = 0;
  for (let i = 0; i < words.length; i++) {
    const endsHere = i === words.length - 1 || SENTENCE_END.test(words[i].t) || words[i + 1].s - words[i].e > PAUSE_SEC;
    if (endsHere) { flush(first, i); first = i + 1; }
  }
  return spans;
}
