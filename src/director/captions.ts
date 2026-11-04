import type { Layer } from '../plan/types';
import type { Beat, Storyboard } from './types';

type W = { t: string; s: number; e: number };
type Chunk = { first: number; last: number; variant: 'phrase' | 'big'; beat: Beat };

const LEAD_SEC = 0.05;
const TAIL_SEC = 0.4;
const MIN_SEC = 0.1;
const MAX_BIG_WORDS = 3;
const PUNCT = /[,.;:!?…]$/;

/** Splits words first..last into chunks of at most `max` words, breaking at punctuation once a chunk has 2 words. */
function split(first: number, last: number, max: number, words: W[]): [number, number][] {
  const out: [number, number][] = [];
  let from = first;
  for (let i = first; i <= last; i++) {
    const n = i - from + 1;
    if (i === last || n >= max || (n >= 2 && PUNCT.test(words[i].t))) {
      out.push([from, i]);
      from = i + 1;
    }
  }
  return out;
}

/** Caption layers (track `caption`, ids c1…) from the storyboard's caption treatments; never overlapping, always inside the video. */
export function captionLayers(
  sb: Storyboard,
  words: W[],
  limits: { maxCaptionWords: number },
  durationSec: number,
): { layers: Layer[]; issues: string[] } {
  const issues: string[] = [];
  const max = Math.max(1, Math.floor(limits.maxCaptionWords));
  const chunks: (Chunk & { hl: Set<number>; props?: Record<string, unknown> })[] = [];

  for (const beat of sb.beats) {
    const first = beat.firstWord;
    const last = Math.min(beat.lastWord, words.length - 1);
    if (!(first >= 0) || first > last) { issues.push(`${beat.id}: khoảng từ ${beat.firstWord}–${beat.lastWord} nằm ngoài lời, bỏ qua caption`); continue; }
    const spec = beat.treatment.caption;

    const hlAll = Array.isArray(spec.hl) ? spec.hl : [];
    const hl = new Set(hlAll.filter(i => Number.isInteger(i) && i >= first && i <= last));
    if (hl.size !== new Set(hlAll).size) issues.push(`${beat.id}: có chỉ số hl nằm ngoài nhịp, đã bỏ qua`);

    let big: [number, number] | null = null;
    if (spec.bigRange) {
      const [a, b] = spec.bigRange;
      if (Number.isInteger(a) && Number.isInteger(b) && a >= first && b <= last && a <= b && b - a + 1 <= MAX_BIG_WORDS) big = [a, b];
      else issues.push(`${beat.id}: bigRange [${a}, ${b}] không hợp lệ (ngoài nhịp hoặc dài hơn ${MAX_BIG_WORDS} từ), bỏ qua`);
    }

    const beatChunks: (Chunk & { hl: Set<number>; props?: Record<string, unknown> })[] = [];
    const push = (a: number, b: number, variant: 'phrase' | 'big') => beatChunks.push({ first: a, last: b, variant, beat, hl });
    if (big) {
      if (big[0] > first) split(first, big[0] - 1, max, words).forEach(([a, b]) => push(a, b, 'phrase'));
      push(big[0], big[1], 'big');
      if (big[1] < last) split(big[1] + 1, last, max, words).forEach(([a, b]) => push(a, b, 'phrase'));
    } else {
      split(first, last, max, words).forEach(([a, b]) => push(a, b, 'phrase'));
    }

    for (const c of beatChunks) if (c.variant === 'big') c.props = { variant: 'big' };
    if (spec.variant === 'label') {
      if (!spec.label) issues.push(`${beat.id}: caption label thiếu chữ, dùng phrase`);
      else {
        const toolWord = beat.cues.find(c => c.kind === 'tool' && c.word !== undefined)?.word;
        const phrases = beatChunks.filter(c => c.variant === 'phrase');
        const target = phrases.find(c => toolWord !== undefined && toolWord >= c.first && toolWord <= c.last) ?? phrases[0];
        if (target) target.props = { variant: 'label', label: spec.label };
      }
    } else if (spec.variant === 'big' && !big) {
      issues.push(`${beat.id}: variant big cần bigRange hợp lệ, dùng phrase`);
    }
    chunks.push(...beatChunks);
  }

  const layers: Layer[] = [];
  let prevEnd = 0;
  chunks.forEach((c, i) => {
    const rawStart = words[c.first].s - LEAD_SEC;
    const next = chunks[i + 1];
    let end = words[c.last].e + TAIL_SEC;
    if (next) end = Math.min(end, words[next.first].s - LEAD_SEC - LEAD_SEC);
    end = Math.min(end, durationSec);
    const start = Math.max(0, rawStart, prevEnd);
    if (start + MIN_SEC > durationSec + 1e-9) { issues.push(`${c.beat.id}: caption bắt đầu quá gần cuối video, bỏ qua`); return; }
    end = Math.max(end, start + MIN_SEC);
    prevEnd = end;
    const ws = words.slice(c.first, c.last + 1).map((w, k) => ({ t: w.t, s: w.s, e: w.e, hl: c.hl.has(c.first + k) }));
    layers.push({ id: `c${layers.length + 1}`, track: 'caption', start, end, words: ws, ...(c.props ? { props: c.props } : {}) });
  });
  return { layers, issues };
}
