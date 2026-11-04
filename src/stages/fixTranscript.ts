import { copyFileSync, existsSync, readFileSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';

export type Fix = { sai: string; dung: string; sau?: string; tiep?: string };
type Words = { words: { t: string; s: number; e: number }[] };

const bare = (s: string) => s.toLowerCase().replace(/^[^\p{L}\p{N}]+|[^\p{L}\p{N}]+$/gu, '');

/**
 * Fixes words Whisper heard wrong (captions follow transcript.json word for word, so a wrong word would be printed on the video).
 * The fixes file is a list of `{ sai, dung, sau?, tiep? }`: replace the word `sai` by `dung`, only when the word before it is `sau` and
 * the word after it is `tiep` if those are given. Punctuation around a word and every word time are kept. The original transcript is
 * kept as transcript.whisper.json and fixes always start from it, so running again gives the same result.
 * `unmatched` are the fixes that changed nothing (a typo in `sai`, or a `sau`/`tiep` that does not fit).
 */
export function fixTranscript(projectDir: string, fixesFile = join(projectDir, 'transcript-fixes.json')): { changed: number; unmatched: Fix[] } {
  if (!existsSync(fixesFile)) throw new Error(`Chưa có ${fixesFile}: cần transcript-fixes.json dạng [{ "sai": "áp", "dung": "ác", "sau": "cái" }]`);
  const file = join(projectDir, 'transcript.json');
  if (!existsSync(file)) throw new Error('Chưa có transcript.json — chạy clean trước');
  let fixes: Fix[];
  try { fixes = JSON.parse(readFileSync(fixesFile, 'utf8')); } catch (e) { throw new Error(`${fixesFile} không phải JSON hợp lệ: ${(e as Error).message}`); }
  if (!Array.isArray(fixes)) throw new Error('transcript-fixes.json phải là một mảng');
  fixes.forEach((f, i) => { if (typeof f?.sai !== 'string' || typeof f?.dung !== 'string') throw new Error(`mục ${i + 1} của transcript-fixes.json cần "sai" và "dung" là chuỗi`); });

  const backup = join(projectDir, 'transcript.whisper.json');
  if (!existsSync(backup)) copyFileSync(file, backup);
  const transcript = JSON.parse(readFileSync(backup, 'utf8')) as Words;
  const orig = transcript.words.map(w => w.t); // "sau" and "tiep" compare with the original words, not ones already fixed
  let changed = 0;
  const used = new Set<number>();
  transcript.words.forEach((w, i) => {
    for (const [k, f] of fixes.entries()) {
      if (bare(w.t) !== bare(f.sai)) continue;
      if (f.sau && bare(orig[i - 1] ?? '') !== bare(f.sau)) continue;
      if (f.tiep && bare(orig[i + 1] ?? '') !== bare(f.tiep)) continue;
      const m = /^([^\p{L}\p{N}]*)(.*?)([^\p{L}\p{N}]*)$/su.exec(w.t)!;
      w.t = `${m[1]}${f.dung}${m[3]}`;
      changed++;
      used.add(k);
      break;
    }
  });
  writeFileSync(file, JSON.stringify(transcript, null, 2));
  return { changed, unmatched: fixes.filter((_, k) => !used.has(k)) };
}
