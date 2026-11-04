import { mkdirSync, rmSync } from 'node:fs';
import { join } from 'node:path';
import { openBrowser, renderStill } from '@remotion/renderer';
import { runFfmpeg } from '../media/ffmpeg';
import { openRenderSession, renderStage } from './render';
import { previewFrames, type PreviewFrame } from './previewFrames';

const PARALLEL = 4; // pictures rendered at once
const SHEET_COLS = 4;
const SHEET_MAX_WIDTH = 1920;
const TILE_MAX_WIDTH = 480;
export const PREVIEW_VIDEO_SCALE = 0.35;

export interface PreviewResult { dir: string; sheet: string; frames: (PreviewFrame & { file: string })[] }

const even = (n: number) => 2 * Math.max(1, Math.round(n / 2));

/**
 * A quick look instead of a full render: one picture of each moment worth checking (previewFrames) in `preview/`, and `preview/sheet.png`,
 * all of them on one sheet in time order. The same checks as a render apply (a plan with errors is refused).
 */
export async function previewStage(projectDir: string, opts: { max?: number } = {}): Promise<PreviewResult> {
  const session = await openRenderSession(projectDir);
  try {
    const dir = join(projectDir, 'preview');
    rmSync(dir, { recursive: true, force: true });
    mkdirSync(dir, { recursive: true });
    const { fps, width, height } = session.plan.meta;
    const frames: PreviewResult['frames'] = [];
    const browser = await openBrowser('chrome'); // one browser for every picture: opening one costs seconds
    try {
      const wanted = previewFrames(session.plan, { max: opts.max });
      // a few pictures at a time: each one seeks the video and loads a page, so they overlap well
      let next = 0;
      const results: PreviewResult['frames'] = new Array(wanted.length);
      await Promise.all(Array.from({ length: Math.min(PARALLEL, wanted.length) }, async () => {
        while (next < wanted.length) {
          const i = next++;
          const f = wanted[i];
          const file = join(dir, `f${String(i + 1).padStart(2, '0')}.png`);
          const frame = Math.min(session.composition.durationInFrames - 1, Math.max(0, Math.round(f.t * fps)));
          await renderStill({ composition: session.composition, serveUrl: session.serveUrl, output: file, frame, inputProps: session.inputProps, puppeteerInstance: browser });
          results[i] = { ...f, file };
        }
      }));
      frames.push(...results);
    } finally {
      await browser.close({ silent: true });
    }

    // contact sheet: the pictures in rows of SHEET_COLS, each scaled to fit
    const cols = Math.min(SHEET_COLS, frames.length);
    const tileW = even(Math.min(TILE_MAX_WIDTH, SHEET_MAX_WIDTH / cols));
    const tileH = even((tileW * height) / width);
    const sheet = join(dir, 'sheet.png');
    const scale = frames.map((_, i) => `[${i}:v]scale=${tileW}:${tileH}[s${i}]`).join(';');
    const layout = frames.map((_, i) => `${(i % cols) * tileW}_${Math.floor(i / cols) * tileH}`).join('|');
    const stack = frames.length > 1 ? `${frames.map((_, i) => `[s${i}]`).join('')}xstack=inputs=${frames.length}:layout=${layout}[out]` : '[s0]null[out]';
    await runFfmpeg(['-y', ...frames.flatMap(f => ['-i', f.file]), '-filter_complex', `${scale};${stack}`, '-map', '[out]', '-frames:v', '1', sheet]);
    return { dir, sheet, frames };
  } finally {
    await session.close();
  }
}

/** A small, fast copy of the video (`preview.mp4`, the picture scaled down, lower quality) to watch the motion without waiting for the full render. */
export function previewVideo(projectDir: string, opts: { scale?: number } = {}): Promise<string> {
  return renderStage(projectDir, { scale: opts.scale ?? PREVIEW_VIDEO_SCALE, out: join(projectDir, 'preview.mp4'), fast: true });
}
