import { mkdtempSync, readFileSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { runFfmpeg } from './ffmpeg';

/** A rectangle of the frame as fractions (0-1) of its width and height. */
export interface Region { x: number; y: number; w: number; h: number }

/** How the picture sits in a frame of another shape (see plan.meta.fit / focus): the region is then taken from the frame, not from the picture. */
export interface FrameView { width: number; height: number; fit: 'cover' | 'contain'; focus: { x: number; y: number } }

const VIEW_WIDTH = 360; // the frame is simulated at this width: enough for brightness, cheap to decode

function viewFilter(view: FrameView): string {
  const w = VIEW_WIDTH;
  const h = Math.max(2, Math.round((VIEW_WIDTH * view.height) / view.width));
  if (view.fit === 'contain') return `scale=${w}:${h}:force_original_aspect_ratio=decrease,pad=${w}:${h}:(ow-iw)/2:(oh-ih)/2:black`;
  return `scale=${w}:${h}:force_original_aspect_ratio=increase,crop=${w}:${h}:(iw-ow)*${view.focus.x}:(ih-oh)*${view.focus.y}`;
}

/**
 * Brightness (0 black, 1 white) of each of `cols` equal columns of `region` of the picture of `video`,
 * one row per 1/`fps` second: `result[sample][column]`. With a `view` the region is a part of the frame the picture is fitted into.
 */
export async function lumaGrid(video: string, region: Region, cols: number, fps = 4, view?: FrameView): Promise<number[][]> {
  const tmp = mkdtempSync(join(tmpdir(), 'editkai-luma-'));
  const raw = join(tmp, 'luma.raw');
  try {
    const { x, y, w, h } = region;
    const fit = view ? `${viewFilter(view)},` : '';
    await runFfmpeg(['-y', '-i', video, '-an', '-vf', `fps=${fps},${fit}crop=iw*${w}:ih*${h}:iw*${x}:ih*${y},scale=${cols}:1:flags=area,format=gray`, '-f', 'rawvideo', raw]);
    const bytes = readFileSync(raw);
    const rows: number[][] = [];
    for (let i = 0; i + cols <= bytes.length; i += cols) rows.push([...bytes.subarray(i, i + cols)].map(b => b / 255));
    return rows;
  } finally {
    rmSync(tmp, { recursive: true, force: true });
  }
}

/** Mean brightness (0-1) of the whole `region`, one value per 1/`fps` second. */
export async function lumaTrack(video: string, region: Region, fps = 4, view?: FrameView): Promise<number[]> {
  return (await lumaGrid(video, region, 1, fps, view)).map(r => r[0]);
}
