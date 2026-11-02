import { normalizeWord } from '../qa/text';
import type { Range } from './silence';
import type { Transcript } from './transcribe';

/** Adjacent repeated phrases (1–3 words): returns the earlier occurrence, so the later one is kept. */
export function findRepeats(t: Transcript): Range[] {
  const w = t.words;
  const n = w.map(x => normalizeWord(x.t));
  const out: Range[] = [];
  for (let i = 0; i < w.length; ) {
    let hit = 0;
    for (let len = 3; len >= 1 && !hit; len--) {
      if (i + 2 * len > w.length) continue;
      let same = true;
      for (let k = 0; k < len; k++) if (!n[i + k] || n[i + k] !== n[i + len + k]) same = false;
      if (same) hit = len;
    }
    if (hit) { out.push({ start: w[i].s, end: w[i + hit - 1].e }); i += hit; } else i++;
  }
  return out;
}
