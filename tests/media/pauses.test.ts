import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { mkdirSync, mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { runFfmpeg } from '../../src/media/ffmpeg';
import { findPauses } from '../../src/media/pauses';

let dir: string;
let clip: string;

beforeAll(async () => {
  dir = join(mkdtempSync(join(tmpdir(), 'editkai-pauses-')), 'thư mục thử');
  mkdirSync(dir);
  clip = join(dir, 'lời nói.mp4');
  // a tone with a 0.3 s gap at 1.0 s and a 0.2 s gap at 2.5 s
  await runFfmpeg([
    '-y', '-f', 'lavfi', '-i', 'color=c=black:s=160x120:r=30:d=4',
    '-f', 'lavfi', '-i', "sine=frequency=300:sample_rate=16000:duration=4,volume=0:enable='between(t,1,1.3)+between(t,2.5,2.7)'",
    '-c:v', 'libx264', '-pix_fmt', 'yuv420p', '-c:a', 'aac', '-shortest', clip,
  ]);
});
afterAll(() => rmSync(dir, { recursive: true, force: true }));

describe('findPauses', () => {
  it('finds both gaps within 0.08 s at the default minimum', async () => {
    const p = await findPauses(clip);
    expect(p).toHaveLength(2);
    // each pause lies inside the real gap (a cut anywhere in it clips nothing) and covers most of it
    for (const [pause, from, to] of [[p[0], 1.0, 1.3], [p[1], 2.5, 2.7]] as const) {
      expect(pause.start).toBeGreaterThanOrEqual(from - 0.03);
      expect(pause.end).toBeLessThanOrEqual(to + 0.03);
      expect(pause.end - pause.start).toBeGreaterThan((to - from) * 0.5);
    }
  });
  it('a larger minimum keeps only the longer gap', async () => {
    const p = await findPauses(clip, { minSec: 0.25 });
    expect(p).toHaveLength(1);
    expect(p[0].start).toBeGreaterThanOrEqual(0.97);
    expect(p[0].end).toBeLessThanOrEqual(1.33);
  });
  it('a file without any pause gives no pauses', async () => {
    const steady = join(dir, 'liên tục.mp4');
    await runFfmpeg(['-y', '-f', 'lavfi', '-i', 'color=c=black:s=160x120:r=30:d=2', '-f', 'lavfi', '-i', 'sine=frequency=300:sample_rate=16000:duration=2', '-c:v', 'libx264', '-pix_fmt', 'yuv420p', '-c:a', 'aac', '-shortest', steady]);
    expect(await findPauses(steady)).toEqual([]);
  });
});
