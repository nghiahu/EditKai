import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { mkdirSync, mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { runFfmpeg } from '../../src/media/ffmpeg';
import { shotChanges } from '../../src/media/shots';

let dir: string;

beforeAll(() => {
  dir = join(mkdtempSync(join(tmpdir(), 'editkai-shots-')), 'thư mục thử');
  mkdirSync(dir);
});
afterAll(() => rmSync(dir, { recursive: true, force: true }));

describe('shotChanges', () => {
  it('finds the time where the picture cuts to a different shot', async () => {
    const clip = join(dir, 'hai cảnh.mp4');
    await runFfmpeg([
      '-y', '-f', 'lavfi', '-i', 'testsrc2=s=160x120:r=30:d=1', '-f', 'lavfi', '-i', 'color=c=blue:s=160x120:r=30:d=1.5',
      '-filter_complex', '[0:v][1:v]concat=n=2:v=1:a=0[v]', '-map', '[v]', '-pix_fmt', 'yuv420p', clip,
    ]);
    const c = await shotChanges(clip);
    expect(c).toHaveLength(1);
    expect(Math.abs(c[0] - 1.0)).toBeLessThan(0.1);
  });
  it('a steady shot has no changes', async () => {
    const clip = join(dir, 'một cảnh.mp4');
    await runFfmpeg(['-y', '-f', 'lavfi', '-i', 'testsrc2=s=160x120:r=30:d=2', '-pix_fmt', 'yuv420p', clip]);
    expect(await shotChanges(clip)).toEqual([]);
  });
});
