import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { existsSync, mkdtempSync, readFileSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { run, runFfmpeg } from '../../src/media/ffmpeg';
import { pythonBin } from '../../src/media/transcribe';

const script = join('scripts', 'face_track.py');
const track = (video: string, out: string, ...extra: string[]) => run(pythonBin(), [script, video, out, ...extra]);
let dir: string;
let clip: string;
beforeAll(async () => {
  dir = mkdtempSync(join(tmpdir(), 'editkai-face-'));
  clip = join(dir, 'ngay-khong-mat.mp4'); // a test pattern: no face in it
  await runFfmpeg(['-y', '-f', 'lavfi', '-i', 'testsrc=s=320x180:r=30:d=2', '-pix_fmt', 'yuv420p', clip]);
});
afterAll(() => rmSync(dir, { recursive: true, force: true }));

describe('face_track.py', () => {
  it('writes one sample per 1/fps second, with a null box where there is no face', async () => {
    const out = join(dir, 'faces.json');
    await track(clip, out, '--fps', '4');
    const j = JSON.parse(readFileSync(out, 'utf8'));
    expect(j.fps).toBe(4);
    expect(j.samples.length).toBeGreaterThanOrEqual(7);
    expect(j.samples.length).toBeLessThanOrEqual(9);
    expect(j.samples[0]).toEqual({ t: 0, box: null, conf: 0 });
    expect(j.samples.every((s: { box: unknown }) => s.box === null)).toBe(true);
    expect(j.samples[1].t).toBeCloseTo(0.25, 5);
  }, 60000);
  it('a missing video or a missing model is a clear error', async () => {
    await expect(track(join(dir, 'khong-co.mp4'), join(dir, 'x.json'))).rejects.toThrow(/khong-co|video|Không/i);
    await expect(run(pythonBin(), [script, clip, join(dir, 'y.json'), '--model', join(dir, 'khong-co.onnx')])).rejects.toThrow(/mô hình|model/i);
  }, 60000);
  // a face in a real video: set EDITKAI_FACE_VIDEO to a clip of someone talking (not kept in the repo: it is personal data)
  const faceVideo = process.env.EDITKAI_FACE_VIDEO;
  (faceVideo && existsSync(faceVideo) ? it : it.skip)('finds the largest face as a box inside the frame', async () => {
    const out = join(dir, 'face.json');
    await track(faceVideo!, out, '--fps', '1');
    const found = JSON.parse(readFileSync(out, 'utf8')).samples.filter((s: { box: unknown }) => s.box);
    expect(found.length).toBeGreaterThan(0);
    for (const s of found) {
      const b = s.box;
      expect(b.x).toBeGreaterThanOrEqual(0);
      expect(b.y).toBeGreaterThanOrEqual(0);
      expect(b.x + b.w).toBeLessThanOrEqual(1.001);
      expect(b.y + b.h).toBeLessThanOrEqual(1.001);
      expect(s.conf).toBeGreaterThan(0.7);
    }
  }, 120000);
});
