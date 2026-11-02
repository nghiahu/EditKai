import { normalizeWord } from '../qa/text';
import type { Range } from './silence';
import type { Transcript } from './transcribe';

/**
 * Adjacent repeated phrases (2–3 words): returns the earlier occurrence, so the later one is kept.
 * A single repeated word is not cut automatically because Vietnamese uses reduplication ("từ từ", "dần dần");
 * see findSuspectRepeats.
 */
export function findRepeats(t: Transcript): Range[] {
  const w = t.words;
  const n = w.map(x => normalizeWord(x.t));
  const out: Range[] = [];
  for (let i = 0; i < w.length; ) {
    let hit = 0;
    for (let len = 3; len >= 2 && !hit; len--) {
      if (i + 2 * len > w.length) continue;
      let same = true;
      for (let k = 0; k < len; k++) if (!n[i + k] || n[i + k] !== n[i + len + k]) same = false;
      if (same) hit = len;
    }
    if (hit) { out.push({ start: w[i].s, end: w[i + hit - 1].e }); i += hit; } else i++;
  }
  return out;
}

/** Adjacent single-word repeats: possible stumbles, listed for the director to review, never cut automatically. */
export function findSuspectRepeats(t: Transcript): { word: string; start: number; end: number }[] {
  const out: { word: string; start: number; end: number }[] = [];
  for (let i = 0; i + 1 < t.words.length; i++) {
    const a = normalizeWord(t.words[i].t);
    if (a && a === normalizeWord(t.words[i + 1].t)) out.push({ word: a, start: t.words[i].s, end: t.words[i].e });
  }
  return out;
}
