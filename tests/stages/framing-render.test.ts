import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { copyFileSync, mkdirSync, mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { runFfmpeg } from '../../src/media/ffmpeg';
import { previewStage } from '../../src/stages/preview';
import type { Plan } from '../../src/plan/types';
import { meanLuma } from '../remotion/helper';

let base: string;
let dir: string;

beforeEach(async () => {
  base = mkdtempSync(join(tmpdir(), 'editkai-framing-'));
  dir = join(base, 'dự án khung hình');
  mkdirSync(dir);
  // a wide 640x360 picture: the left half red, the right half lime
  await runFfmpeg(['-y', '-f', 'lavfi', '-i', 'color=c=lime:s=640x360:r=30:d=2,drawbox=x=0:y=0:w=320:h=360:color=red:t=fill', '-pix_fmt', 'yuv420p', join(dir, 'cleaned.mp4')]);
});
afterEach(() => rmSync(base, { recursive: true, force: true }));

/** The first picture of a preview of a 360x640 frame made from that wide source, with the given meta. */
async function frameWith(meta: Record<string, unknown>): Promise<string> {
  const plan: Plan = {
    version: 1, meta: { source: 'cleaned.mp4', fps: 30, width: 360, height: 640, style: 'm1', ...meta } as Plan['meta'],
    scenes: [{ id: 's1', start: 0, end: 2, role: 'talking-head' }], layers: [],
  };
  writeFileSync(join(dir, 'plan.json'), JSON.stringify(plan));
  const png = join(base, Math.random().toString(36).slice(2) + '.png'); // the preview folder is emptied by every run: keep a copy
  copyFileSync((await previewStage(dir, { max: 1 })).frames[0].file, png);
  return png;
}
const region = (x: number, y: number, w: number, h: number) => ({ x, y, w, h });
const T = 300000;

describe('a wide source in a tall frame', () => {
  it('cover (the default) fills the whole frame: no bars at the top and bottom, and the focus decides which part stays', async () => {
    const left = await frameWith({ focus: { x: 0, y: 0.5 } });
    const right = await frameWith({ focus: { x: 1, y: 0.5 } });
    for (const png of [left, right]) {
      expect(await meanLuma(png, region(0, 0, 360, 60), 360, 640)).toBeGreaterThan(40); // not the dark background: the picture reaches the top edge
      expect(await meanLuma(png, region(0, 580, 360, 60), 360, 640)).toBeGreaterThan(40);
    }
    expect(await meanLuma(left, region(100, 300, 160, 40), 360, 640)).toBeLessThan(110); // red
    expect(await meanLuma(right, region(100, 300, 160, 40), 360, 640)).toBeGreaterThan(120); // green
  }, T);
  it('contain keeps the whole picture in the middle with bars above and below', async () => {
    const png = await frameWith({ fit: 'contain' });
    expect(await meanLuma(png, region(0, 0, 360, 80), 360, 640)).toBeLessThan(15);
    expect(await meanLuma(png, region(0, 560, 360, 80), 360, 640)).toBeLessThan(15);
    expect(await meanLuma(png, region(0, 280, 180, 80), 360, 640)).toBeLessThan(110); // the red half, whole
    expect(await meanLuma(png, region(180, 280, 180, 80), 360, 640)).toBeGreaterThan(120); // the green half, whole
  }, T);
});
