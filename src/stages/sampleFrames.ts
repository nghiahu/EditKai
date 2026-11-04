import { existsSync, mkdirSync, rmSync } from 'node:fs';
import { join } from 'node:path';
import { runFfmpeg } from '../media/ffmpeg';
import { probe } from '../media/probe';

const SHEET_COLS = 4;
const SHEET_MAX_WIDTH = 1920;
const TILE_MAX_WIDTH = 480;
const even = (n: number) => Math.max(2, Math.round(n / 2) * 2);

export interface SampledFrames { dir: string; sheet: string; frames: { t: number; file: string }[] }

/**
 * Looks at the video itself (cleaned.mp4, no graphics yet): `count` pictures at the middle of equal parts of it, in `frames/`, and
 * `frames/sheet.png` with all of them in time order. For deciding framing (`focus`) and where the speaker is before any plan exists.
 */
export async function sampleFrames(projectDir: string, opts: { count?: number } = {}): Promise<SampledFrames> {
  const count = opts.count ?? 12;
  if (!Number.isInteger(count) || count < 1 || count > 60) throw new Error(`Số khung (--count) phải là số nguyên từ 1 đến 60, nhận được ${count}`);
  const video = join(projectDir, 'cleaned.mp4');
  if (!existsSync(video)) throw new Error('Chưa có cleaned.mp4 — chạy clean trước');
  const info = await probe(video);
  const dir = join(projectDir, 'frames');
  rmSync(dir, { recursive: true, force: true });
  mkdirSync(dir, { recursive: true });
  const frames: SampledFrames['frames'] = [];
  for (let i = 0; i < count; i++) {
    const t = Math.min(info.durationSec - 0.05, ((i + 0.5) * info.durationSec) / count);
    const file = join(dir, `s${String(i + 1).padStart(2, '0')}.png`);
    await runFfmpeg(['-y', '-ss', t.toFixed(3), '-i', video, '-frames:v', '1', file]);
    frames.push({ t, file });
  }
  const cols = Math.min(SHEET_COLS, frames.length);
  const tileW = even(Math.min(TILE_MAX_WIDTH, SHEET_MAX_WIDTH / cols));
  const tileH = even((tileW * info.height) / info.width);
  const sheet = join(dir, 'sheet.png');
  const scale = frames.map((_, i) => `[${i}:v]scale=${tileW}:${tileH}[s${i}]`).join(';');
  const layout = frames.map((_, i) => `${(i % cols) * tileW}_${Math.floor(i / cols) * tileH}`).join('|');
  const stack = frames.length > 1 ? `${frames.map((_, i) => `[s${i}]`).join('')}xstack=inputs=${frames.length}:layout=${layout}[out]` : '[s0]null[out]';
  await runFfmpeg(['-y', ...frames.flatMap(f => ['-i', f.file]), '-filter_complex', `${scale};${stack}`, '-map', '[out]', '-frames:v', '1', sheet]);
  return { dir, sheet, frames };
}
