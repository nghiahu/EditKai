import { mkdirSync, mkdtempSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { dirname, join } from 'node:path';
import type { Asset } from '../../src/assets/manifest';
import { runFfmpeg } from '../../src/media/ffmpeg';

export interface W { t: string; s: number; e: number }

/** Words from sentences: 0.3 s per word, plus `pause` seconds of silence after each sentence. */
export function makeWords(sentences: string[], opts: { step?: number; pause?: number } = {}): W[] {
  const { step = 0.3, pause = 1 } = opts;
  const words: W[] = [];
  let t = 0;
  for (const sentence of sentences) {
    for (const w of sentence.split(/\s+/).filter(Boolean)) {
      words.push({ t: w, s: Math.round(t * 1000) / 1000, e: Math.round((t + step * 0.85) * 1000) / 1000 });
      t += step;
    }
    t += pause;
  }
  return words;
}

/** A temp project folder (path with a space and a diacritic on purpose) with transcript.json and project.json, plus optional extras. */
export function writeProject(
  sentences: string[],
  opts: { style?: 's1' | 'm1'; assets?: Asset[]; glossary?: unknown; words?: W[]; pause?: number } = {},
): string {
  const dir = join(mkdtempSync(join(tmpdir(), 'editkai-director-')), 'dự án');
  mkdirSync(dir, { recursive: true });
  writeFileSync(join(dir, 'transcript.json'), JSON.stringify({ words: opts.words ?? makeWords(sentences, { pause: opts.pause }) }));
  writeFileSync(join(dir, 'project.json'), JSON.stringify({ style: opts.style ?? 'm1', aspect: '9:16', width: 1080, height: 1920, fps: 30 }));
  if (opts.assets) {
    writeFileSync(join(dir, 'assets.json'), JSON.stringify({ assets: opts.assets }));
    for (const a of opts.assets) { // the listed files exist (empty stand-ins), like after assets add
      mkdirSync(dirname(join(dir, a.file)), { recursive: true });
      writeFileSync(join(dir, a.file), '');
    }
  }
  if (opts.glossary !== undefined) writeFileSync(join(dir, 'glossary.json'), JSON.stringify(opts.glossary));
  return dir;
}

/** A plain video of `seconds` s named cleaned.mp4 in the project (for tests that need a real duration). */
export async function writeCleanedVideo(dir: string, seconds: number): Promise<void> {
  await runFfmpeg(['-y', '-f', 'lavfi', '-i', `color=c=gray:s=320x240:r=30:d=${seconds}`, '-c:v', 'libx264', '-pix_fmt', 'yuv420p', join(dir, 'cleaned.mp4')]);
}
