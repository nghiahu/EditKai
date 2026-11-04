import { mkdtempSync, readFileSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { runFfmpeg } from './ffmpeg';
import type { Range } from './silence';

const SAMPLE_RATE = 16000;
const HOP = SAMPLE_RATE / 100; // 10 ms per frame

/** Loudness per 10 ms frame (RMS, smoothed over 50 ms) of the audio of `file`; `level` is the 75th percentile, the usual loudness of speech. */
export async function loudnessEnvelope(file: string): Promise<{ env: number[]; level: number }> {
  const tmp = mkdtempSync(join(tmpdir(), 'editkai-pcm-'));
  const pcmFile = join(tmp, 'audio.pcm');
  try {
    await runFfmpeg(['-y', '-i', file, '-vn', '-ac', '1', '-ar', String(SAMPLE_RATE), '-f', 's16le', pcmFile]);
    const pcm = readFileSync(pcmFile);
    const frames = Math.floor(pcm.length / 2 / HOP);
    const raw: number[] = [];
    for (let f = 0; f < frames; f++) {
      let sum = 0;
      for (let i = 0; i < HOP; i++) { const v = pcm.readInt16LE((f * HOP + i) * 2); sum += v * v; }
      raw.push(Math.sqrt(sum / HOP));
    }
    const env = raw.map((_, f) => {
      let s = 0, n = 0;
      for (let k = -2; k <= 2; k++) if (raw[f + k] !== undefined) { s += raw[f + k]; n++; }
      return s / n;
    });
    const level = [...env].sort((a, b) => a - b)[Math.floor(env.length * 0.75)] || 1;
    return { env, level };
  } finally {
    rmSync(tmp, { recursive: true, force: true });
  }
}

/**
 * Real pauses in the speech: stretches at least `minSec` long where the loudness stays `relDb` dB under normal speech.
 * Cutting inside one of them never clips a word, unlike cutting at the word times Whisper gives (those words run into each other).
 */
export async function findPauses(file: string, opts: { minSec?: number; relDb?: number } = {}): Promise<Range[]> {
  const { minSec = 0.12, relDb = -22 } = opts;
  const { env, level } = await loudnessEnvelope(file);
  const threshold = level * 10 ** (relDb / 20);
  const out: Range[] = [];
  let from = -1;
  env.forEach((v, f) => {
    if (v < threshold) { if (from < 0) from = f; return; }
    if (from >= 0 && (f - from) / 100 >= minSec) out.push({ start: from / 100, end: f / 100 });
    from = -1;
  });
  if (from >= 0 && (env.length - from) / 100 >= minSec) out.push({ start: from / 100, end: env.length / 100 });
  return out;
}
