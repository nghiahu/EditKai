import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { existsSync, mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { facesStage } from '../../src/stages/faces';
import { runCli } from '../../src/cli';
import { runFfmpeg } from '../../src/media/ffmpeg';

let base: string;
let dir: string;
beforeAll(async () => {
  base = mkdtempSync(join(tmpdir(), 'editkai-facesstage-'));
  dir = join(base, 'dự án mặt');
  mkdirSync(dir);
  await runFfmpeg(['-y', '-f', 'lavfi', '-i', 'testsrc=s=320x180:r=30:d=2', '-pix_fmt', 'yuv420p', join(dir, 'cleaned.mp4')]);
});
afterAll(() => rmSync(base, { recursive: true, force: true }));

describe('facesStage', () => {
  it('runs the tracker on cleaned.mp4, writes faces.json and says how many samples had a face', async () => {
    const r = await facesStage(dir);
    expect(existsSync(join(dir, 'faces.json'))).toBe(true);
    expect(r.samples).toBeGreaterThanOrEqual(7);
    expect(r.withFace).toBe(0); // a test pattern has no face
    expect(r.lines.join('\n')).toMatch(/không thấy mặt|0\//);
  }, 60000);
  it('uses the tracker it is given (so tests stay fast) and reports the share of samples with a face', async () => {
    const fake = async (_video: string, out: string) => writeFileSync(out, JSON.stringify({ fps: 4, samples: [
      { t: 0, box: { x: 0.4, y: 0.2, w: 0.2, h: 0.3 }, conf: 0.99 }, { t: 0.25, box: null, conf: 0 }] }));
    const r = await facesStage(dir, { track: fake });
    expect(r.samples).toBe(2);
    expect(r.withFace).toBe(1);
    expect(r.lines.join('\n')).toMatch(/1\/2/);
  });
  it('a missing cleaned.mp4 is a clear error', async () => {
    await expect(facesStage(base)).rejects.toThrow('cleaned.mp4');
  });
});

describe('faces command', () => {
  it('prints what facesStage found and exits 0', async () => {
    const out: string[] = [];
    expect(await runCli(['faces', dir], s => out.push(s), s => out.push(s))).toBe(0);
    expect(out.join('\n')).toMatch(/faces\.json/);
    expect(JSON.parse(readFileSync(join(dir, 'faces.json'), 'utf8')).samples.length).toBeGreaterThan(0);
  }, 60000);
});
