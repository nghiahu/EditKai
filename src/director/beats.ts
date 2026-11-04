import type { BeatSpan } from './types';

const MAX_WORDS = 14;
const PAUSE_SEC = 0.6;
const SENTENCE_END = /[.?!…]$/;
const COMMA_END = /[,;:]$/;
const TINY_SEC = 0.4;

/**
 * Cuts a transcript into beats: at sentence punctuation or a pause longer than 0.6 s; a beat of more than 14 words is cut again at
 * a comma, else at the largest pause, else after 14 words. A beat of less than 0.4 s (one short word, say) is joined to the beat before it
 * (the first one to the beat after it): captions never cross a beat, so it would flash up alone. Spans are contiguous and cover every word once.
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
  return mergeTiny(spans);
}

const isTiny = (s: BeatSpan) => s.end - s.start < TINY_SEC;

function mergeTiny(spans: BeatSpan[]): BeatSpan[] {
  const join = (a: BeatSpan, b: BeatSpan): BeatSpan => ({ firstWord: a.firstWord, lastWord: b.lastWord, start: a.start, end: b.end, text: `${a.text} ${b.text}` });
  const out: BeatSpan[] = [];
  for (const s of spans) {
    const prev = out[out.length - 1];
    if (prev && isTiny(s)) out[out.length - 1] = join(prev, s);
    else out.push(s);
  }
  if (out.length > 1 && isTiny(out[0])) out.splice(0, 2, join(out[0], out[1]));
  return out;
}
