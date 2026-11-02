import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { mkdtempSync, mkdirSync, rmSync, existsSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { runFfmpeg } from '../../src/media/ffmpeg';
import { probe } from '../../src/media/probe';
import { detectSilences } from '../../src/media/silence';
import { cutVideo } from '../../src/media/cut';

let dir: string;
let clip: string;

beforeAll(async () => {
  // folder name has spaces and diacritics on purpose (Windows paths like "Tài liệu")
  dir = join(mkdtempSync(join(tmpdir(), 'editkai-')), 'thư mục thử');
  mkdirSync(dir);
  clip = join(dir, 'tone silence tone.mp4');
  await runFfmpeg([
    '-y', '-f', 'lavfi', '-i', 'color=c=black:s=320x240:r=30:d=3',
    '-f', 'lavfi', '-i', "sine=frequency=440:sample_rate=44100:duration=3,volume=0:enable='between(t,1,2)'",
    '-c:v', 'libx264', '-pix_fmt', 'yuv420p', '-c:a', 'aac', '-shortest', clip,
  ]);
});
afterAll(() => rmSync(dir, { recursive: true, force: true }));

describe('media', () => {
  it('probe reads size, fps, duration and audio', async () => {
    const info = await probe(clip);
    expect(info).toMatchObject({ width: 320, height: 240, fps: 30, hasAudio: true });
    expect(info.durationSec).toBeGreaterThan(2.9);
    expect(info.durationSec).toBeLessThan(3.2);
  });
  it('detectSilences finds a 1 s gap within 0.1 s', async () => {
    const r = await detectSilences(clip);
    expect(r).toHaveLength(1);
    expect(Math.abs(r[0].start - 1)).toBeLessThan(0.1);
    expect(Math.abs(r[0].end - 2)).toBeLessThan(0.1);
  });
  it('cutVideo keeps only the given ranges', async () => {
    const out = join(dir, 'cut.mp4');
    await cutVideo(clip, [{ start: 0, end: 1 }, { start: 2, end: 3 }], out);
    expect(existsSync(out)).toBe(true);
    expect(Math.abs((await probe(out)).durationSec - 2)).toBeLessThan(0.15);
  });
  it('runFfmpeg rejects with ffmpeg stderr on failure', async () => {
    await expect(runFfmpeg(['-i', join(dir, 'missing.mp4'), '-f', 'null', '-'])).rejects.toThrow(/missing\.mp4/);
  });
});
