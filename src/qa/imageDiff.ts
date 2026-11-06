import { mkdtempSync, readFileSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { runFfmpeg } from '../media/ffmpeg';

const SIDE = 160; // pictures are compared at this width: enough for a bounding box, and fast
const THRESHOLD = 24; // levels (0-255) a pixel must differ by in some colour channel to count

async function rgb(png: string, w: number, h: number, dir: string, name: string): Promise<Buffer> {
  const raw = join(dir, `${name}.raw`);
  await runFfmpeg(['-y', '-i', png, '-vf', `scale=${w}:${h}`, '-pix_fmt', 'rgb24', '-f', 'rawvideo', raw]);
  return readFileSync(raw);
}

/** Where two pictures of the same size differ: the bounding box as shares of the frame (x, y, w, h in 0-1), or undefined when they look the same. */
export async function diffBox(a: string, b: string, aspect: { width: number; height: number }): Promise<{ x: number; y: number; w: number; h: number } | undefined> {
  const w = SIDE;
  const h = Math.max(1, Math.round((SIDE * aspect.height) / aspect.width));
  const dir = mkdtempSync(join(tmpdir(), 'editkai-diff-'));
  try {
    const [pa, pb] = [await rgb(a, w, h, dir, 'a'), await rgb(b, w, h, dir, 'b')];
    let x0 = w, x1 = -1, y0 = h, y1 = -1;
    for (let y = 0; y < h; y++) {
      for (let x = 0; x < w; x++) {
        const i = (y * w + x) * 3;
        if (Math.max(Math.abs(pa[i] - pb[i]), Math.abs(pa[i + 1] - pb[i + 1]), Math.abs(pa[i + 2] - pb[i + 2])) > THRESHOLD) {
          if (x < x0) x0 = x;
          if (x > x1) x1 = x;
          if (y < y0) y0 = y;
          y1 = y;
        }
      }
    }
    if (x1 < 0) return undefined;
    return { x: x0 / w, y: y0 / h, w: (x1 - x0 + 1) / w, h: (y1 - y0 + 1) / h };
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
}
