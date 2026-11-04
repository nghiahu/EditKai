import { existsSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import { findPauses } from '../media/pauses';
import type { Range } from '../media/silence';

type W = { t: string; s: number; e: number };
const centre = (w: W) => (w.s + w.e) / 2;

/** One line per pause: its times and length and a few words before and after it (the word times are Whisper's, so only roughly right). */
export function describePauses(words: W[], pauses: Range[], context = 6): string[] {
  return pauses.map((p, i) => {
    const mid = (p.start + p.end) / 2;
    const before = words.filter(w => centre(w) < mid).slice(-context).map(w => w.t).join(' ');
    const after = words.filter(w => centre(w) >= mid).slice(0, context).map(w => w.t).join(' ');
    return `${String(i + 1).padStart(2)}. ${p.start.toFixed(2)}–${p.end.toFixed(2)} (${(p.end - p.start).toFixed(2)} s)  …${before}  ‖  ${after}…`;
  });
}

/** The pauses of the project's video (full.mp4 after a condense, else cleaned.mp4) with the words around them: where a cut loses no word. */
export async function listPauses(projectDir: string, minSec = 0.18): Promise<string[]> {
  const cut = existsSync(join(projectDir, 'full.mp4'));
  const video = join(projectDir, cut ? 'full.mp4' : 'cleaned.mp4');
  const transcript = join(projectDir, cut ? 'transcript.full.json' : 'transcript.json');
  if (!existsSync(video)) throw new Error('Chưa có cleaned.mp4 — chạy clean trước');
  if (!existsSync(transcript)) throw new Error(`Chưa có ${cut ? 'transcript.full.json' : 'transcript.json'} — chạy clean trước`);
  const words = (JSON.parse(readFileSync(transcript, 'utf8')) as { words: W[] }).words;
  const pauses = await findPauses(video, { minSec });
  return [`${pauses.length} khoảng ngừng ≥ ${minSec} s (thời gian từ của Whisper chỉ gần đúng, nên từ "trước" và "sau" là ước lượng)`, ...describePauses(words, pauses)];
}
