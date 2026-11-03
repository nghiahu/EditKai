import { bundle } from '@remotion/bundler';
import { renderStill, selectComposition } from '@remotion/renderer';
import { mkdtempSync, readFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';
import { runFfmpeg } from '../../src/media/ffmpeg';
import { loadTheme } from '../../src/style/theme';
import type { Layer, Plan } from '../../src/plan/types';

let serveUrl: Promise<string> | undefined;
const outDir = mkdtempSync(join(tmpdir(), 'editkai-still-'));
let n = 0;

export const bundled = () => (serveUrl ??= bundle({ entryPoint: resolve('remotion/index.ts') }));

export function planOf(style: 's1' | 'm1', layers: Layer[], durationSec = 4): Plan {
  return {
    version: 1,
    meta: { source: 'cleaned.mp4', fps: 30, width: 1080, height: 1920, style },
    scenes: [{ id: 'sc1', start: 0, end: durationSec, role: 'talking-head' }],
    layers,
  };
}

/** Render one frame of the PlanVideo composition to a PNG and return its path. */
export async function stillOf(plan: Plan, frame: number, extra: Record<string, unknown> = {}): Promise<string> {
  const url = await bundled();
  const inputProps = { plan, theme: loadTheme(`styles/${plan.meta.style}`), videoSrc: '', durationSec: 4, ...extra };
  const composition = await selectComposition({ serveUrl: url, id: 'PlanVideo', inputProps });
  const output = join(outDir, `still-${n++}.png`);
  await renderStill({ composition, serveUrl: url, output, frame, inputProps });
  return output;
}

/** A frame of the composition with no layers (what a fully faded-out layer must look like). */
export const blankStill = (style: 's1' | 'm1', frame = 0): Promise<string> => stillOf(planOf(style, []), frame);

/** Render `frames` of a plan and tile them left to right (240 px wide each) into one PNG, for looking at motion. */
export async function filmstrip(plan: Plan, frames: number[], outPng: string): Promise<string> {
  const pngs: string[] = [];
  for (const f of frames) pngs.push(await stillOf(plan, f));
  const filter = pngs.map((_, i) => `[${i}:v]scale=240:-1[s${i}]`).join(';') + ';' + pngs.map((_, i) => `[s${i}]`).join('') + `hstack=inputs=${pngs.length}`;
  await runFfmpeg(['-y', ...pngs.flatMap(p => ['-i', p]), '-filter_complex', filter, outPng]);
  return outPng;
}

/**
 * Bounding box of everything clearly brighter than the (dark) background in a still: {w, h, x, y}.
 * Decodes the PNG to raw gray bytes with ffmpeg and scans them (ffmpeg's cropdetect gives inverted column ranges for these stills).
 */
export async function inkBox(png: string, width = 1080, height = 1920): Promise<{ w: number; h: number; x: number; y: number }> {
  const raw = join(mkdtempSync(join(tmpdir(), 'editkai-ink-')), 'gray.raw');
  await runFfmpeg(['-y', '-i', png, '-vf', `scale=${width}:${height}`, '-pix_fmt', 'gray', '-f', 'rawvideo', raw]);
  const px = readFileSync(raw);
  let x0 = width, x1 = -1, y0 = height, y1 = -1;
  for (let y = 0; y < height; y++) {
    for (let x = 0; x < width; x++) {
      if (px[y * width + x] > 60) {
        if (x < x0) x0 = x;
        if (x > x1) x1 = x;
        if (y < y0) y0 = y;
        y1 = y;
      }
    }
  }
  if (x1 < 0) throw new Error('no content brighter than the background');
  return { w: x1 - x0 + 1, h: y1 - y0 + 1, x: x0, y: y0 };
}

/** Luma (0-255) of one pixel of a PNG, via a 1x1 crop written as PGM. */
export async function lumaAt(png: string, x: number, y: number): Promise<number> {
  const out = join(mkdtempSync(join(tmpdir(), 'editkai-luma-')), 'p.pgm');
  await runFfmpeg(['-y', '-i', png, '-vf', `crop=1:1:${x}:${y},format=gray`, '-frames:v', '1', out]);
  const b = readFileSync(out);
  return b[b.length - 1];
}
