import { existsSync, readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { join, dirname } from 'node:path';
import { run } from './ffmpeg';

export interface TWord { t: string; s: number; e: number }
export interface Transcript { words: TWord[] }

const root = join(dirname(fileURLToPath(import.meta.url)), '..', '..');

function pythonBin(): string {
  const venv = join(root, '.venv', 'Scripts', 'python.exe');
  return existsSync(venv) ? venv : 'python';
}

/** Transcribe `file` with faster-whisper (scripts/transcribe.py) and write the result to `outJson`. */
export async function transcribe(file: string, outJson: string): Promise<Transcript> {
  await run(pythonBin(), [join(root, 'scripts', 'transcribe.py'), file, outJson]);
  return JSON.parse(readFileSync(outJson, 'utf8')) as Transcript;
}
