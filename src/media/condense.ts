import { normalizeLoose } from '../director/text';
import type { Range } from './silence';

export interface Word { t: string; s: number; e: number }
export interface Span { first: number; last: number }
export interface Cut { time: number; how: string; weak: boolean }

const REACH_BEFORE = 0.6; // a pause this far before the word-time of a start, or after the word-time of an end, is still "the" pause
const REACH_AFTER = 0.25;
// without a pause the cut stays close to Whisper's time and leans away from the neighbouring word: a start may move a little later, an end a little earlier
const FALLBACK_INSIDE = 0.14;
const FALLBACK_OUTSIDE = 0.04;
const WEAK_DB = -12; // a cut less than 12 dB under normal speech is in the middle of speech
const SHOT_REACH = 0.15; // a source cut this close to a segment edge is respected
const SHOT_END_BACKOFF = 0.02;
const JOIN_REACH = 0.5; // words this close to a join are the ones that can be fragments

/** Index of the first word of `phrase` at or after `from` in `norm` (normalised words); throws when absent, so a typo never cuts the wrong part. */
export function findPhrase(norm: string[], phrase: string, from: number): number {
  const p = phrase.split(/\s+/).map(normalizeLoose).filter(Boolean);
  for (let i = from; i + p.length <= norm.length; i++) if (p.every((x, k) => norm[i + k] === x)) return i;
  throw new Error(`Không tìm thấy cụm "${phrase}" sau từ thứ ${from}`);
}

/** from/to phrases → word spans in order; two spans next to each other in the speech become one (no join between them). */
export function selectSpans(words: Word[], keep: { from: string; to: string }[]): Span[] {
  const norm = words.map(w => normalizeLoose(w.t));
  const spans: Span[] = [];
  let cursor = 0;
  for (const k of keep) {
    const a = findPhrase(norm, k.from, cursor);
    const z = findPhrase(norm, k.to, a);
    const last = z + k.to.split(/\s+/).filter(Boolean).length - 1;
    const prev = spans[spans.length - 1];
    if (prev && prev.last + 1 === a) prev.last = last;
    else spans.push({ first: a, last });
    cursor = last + 1;
  }
  return spans;
}

/**
 * Where to cut for a boundary near word-time `t`: the middle of the nearest real pause, else the quietest moment right next to `t`.
 * `env` is the loudness per 10 ms frame and `level` the usual loudness of speech (see src/media/pauses.ts).
 */
export function cutPoint(t: number, kind: 'start' | 'end', pauses: Range[], env: number[], level: number): Cut {
  const lo = kind === 'start' ? t - REACH_BEFORE : t - REACH_AFTER;
  const hi = kind === 'start' ? t + REACH_AFTER : t + REACH_BEFORE;
  const near = pauses.filter(p => p.end >= lo && p.start <= hi);
  if (near.length) {
    const p = near.reduce((a, b) => (Math.abs((a.start + a.end) / 2 - t) <= Math.abs((b.start + b.end) / 2 - t) ? a : b));
    return { time: (p.start + p.end) / 2, how: `ngừng ${(p.end - p.start).toFixed(2)} s`, weak: false };
  }
  const before = kind === 'start' ? FALLBACK_OUTSIDE : FALLBACK_INSIDE;
  const after = kind === 'start' ? FALLBACK_INSIDE : FALLBACK_OUTSIDE;
  const from = Math.max(0, Math.round((t - before) * 100));
  const to = Math.min(env.length - 1, Math.round((t + after) * 100));
  let best = from;
  for (let f = from; f <= to; f++) if (env[f] < env[best]) best = f;
  const db = 20 * Math.log10(Math.max(env[best], 1e-3) / level);
  const weak = db > WEAK_DB;
  return { time: (best + 0.5) / 100, how: `KHÔNG có chỗ ngừng, chỗ nhỏ nhất ${db.toFixed(0)} dB${weak ? ' (cắt giữa tiếng nói)' : ''}`, weak };
}

/** The source's own cuts (to b-roll, say): a segment must not keep a frame from the other side of one. */
export function snapToShots(start: number, end: number, shots: number[]): { start: number; end: number; notes: string[] } {
  const notes: string[] = [];
  const sc = shots.find(c => c > start && c - start <= SHOT_REACH);
  if (sc !== undefined) { notes.push(`đầu đoạn lùi theo cảnh cắt của video gốc ${start.toFixed(2)} -> ${sc.toFixed(2)}`); start = sc; }
  const ec = shots.find(c => c < end && end - c <= SHOT_REACH);
  if (ec !== undefined) { notes.push(`cuối đoạn lùi theo cảnh cắt của video gốc ${end.toFixed(2)} -> ${(ec - SHOT_END_BACKOFF).toFixed(2)}`); end = ec - SHOT_END_BACKOFF; }
  return { start, end, notes };
}

/** Times of the joins on the cut video: the running total of the kept lengths, without the last. */
export function joinTimes(segments: Range[]): number[] {
  const out: number[] = [];
  let acc = 0;
  for (const r of segments.slice(0, -1)) { acc += r.end - r.start; out.push(Math.round(acc * 1000) / 1000); }
  return out;
}

/**
 * Lines the words that should be in the cut video up with what Whisper hears in it and reports, per join, the heard words close to the join
 * that nothing in the expected text accounts for (a fragment such as "chính" of the sentence before). A different spelling of a wanted word is not one.
 */
export function checkJoins(expected: string[], heard: Word[], joins: number[]): { join: number; context: string; odd: string[] }[] {
  const got = heard.map(w => normalizeLoose(w.t));
  const n = expected.length, m = got.length;
  const d: number[][] = Array.from({ length: n + 1 }, (_, i) => Array.from({ length: m + 1 }, (_, j) => (i === 0 ? j : j === 0 ? i : 0)));
  for (let i = 1; i <= n; i++) for (let j = 1; j <= m; j++) d[i][j] = Math.min(d[i - 1][j] + 1, d[i][j - 1] + 1, d[i - 1][j - 1] + (expected[i - 1] === got[j - 1] ? 0 : 1));
  const extra = new Set<number>(); // heard words with nothing to match in the expected text
  for (let i = n, j = m; j > 0; ) {
    if (i > 0 && d[i][j] === d[i - 1][j - 1] + (expected[i - 1] === got[j - 1] ? 0 : 1)) { i--; j--; }
    else if (i > 0 && d[i][j] === d[i - 1][j] + 1) i--;
    else { extra.add(j - 1); j--; }
  }
  return joins.map(j => {
    const odd = heard.filter((w, idx) => extra.has(idx) && w.e >= j - JOIN_REACH && w.s <= j + JOIN_REACH).map(w => w.t);
    const context = heard.filter(w => w.e >= j - 1.2 && w.s <= j + 1.2).map(w => (w.s < j + 0.05 && w.e > j - 0.05 ? `[${w.t}]` : w.t)).join(' ');
    return { join: j, context, odd };
  });
}
