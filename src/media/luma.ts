import { mkdtempSync, readFileSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { runFfmpeg } from './ffmpeg';

/** A rectangle of the frame as fractions (0-1) of its width and height. */
export interface Region { x: number; y: number; w: number; h: number }

/**
 * Brightness (0 black, 1 white) of each of `cols` equal columns of `region` of the picture of `video`,
 * one row per 1/`fps` second: `result[sample][column]`.
 */
export async function lumaGrid(video: string, region: Region, cols: number, fps = 4): Promise<number[][]> {
  const tmp = mkdtempSync(join(tmpdir(), 'editkai-luma-'));
  const raw = join(tmp, 'luma.raw');
  try {
    const { x, y, w, h } = region;
    await runFfmpeg(['-y', '-i', video, '-an', '-vf', `fps=${fps},crop=iw*${w}:ih*${h}:iw*${x}:ih*${y},scale=${cols}:1:flags=area,format=gray`, '-f', 'rawvideo', raw]);
    const bytes = readFileSync(raw);
    const rows: number[][] = [];
    for (let i = 0; i + cols <= bytes.length; i += cols) rows.push([...bytes.subarray(i, i + cols)].map(b => b / 255));
    return rows;
  } finally {
    rmSync(tmp, { recursive: true, force: true });
  }
}

/** Mean brightness (0-1) of the whole `region`, one value per 1/`fps` second. */
export async function lumaTrack(video: string, region: Region, fps = 4): Promise<number[]> {
  return (await lumaGrid(video, region, 1, fps)).map(r => r[0]);
}
