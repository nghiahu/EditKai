import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { mkdtempSync, mkdirSync, rmSync, existsSync, readFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { runFfmpeg } from '../../src/media/ffmpeg';
import { probe } from '../../src/media/probe';
import { cleanStage } from '../../src/stages/clean';
import type { Transcript } from '../../src/media/transcribe';

let dir: string;
const stub = (words: Transcript['words']) => async () => ({ words });

beforeEach(() => { dir = join(mkdtempSync(join(tmpdir(), 'editkai-')), 'dự án thử'); mkdirSync(dir); });
afterEach(() => rmSync(join(dir, '..'), { recursive: true, force: true }));

async function makeSource(audio: 'tone-gap' | 'none' | 'silent') {
  const args = ['-y', '-f', 'lavfi', '-i', 'color=c=black:s=320x240:r=30:d=3'];
  if (audio === 'tone-gap') args.push('-f', 'lavfi', '-i', "sine=frequency=440:sample_rate=44100:duration=3,volume=0:enable='between(t,1,2)'");
  if (audio === 'silent') args.push('-f', 'lavfi', '-i', 'anullsrc=r=44100:cl=mono:d=3');
  args.push('-c:v', 'libx264', '-pix_fmt', 'yuv420p', ...(audio === 'none' ? [] : ['-c:a', 'aac', '-shortest']), join(dir, 'source.mp4'));
  await runFfmpeg(args);
}

describe('cleanStage', () => {
  it('cuts the silence and writes cleaned.mp4, transcript.json and cuts.json', async () => {
    await makeSource('tone-gap');
    const words = [{ t: 'a', s: 0.1, e: 0.9 }, { t: 'b', s: 2.1, e: 2.9 }];
    const r = await cleanStage(dir, { transcribe: stub(words) });
    expect(r.cuts).toHaveLength(1);
    expect(existsSync(join(dir, 'cleaned.mp4'))).toBe(true);
    expect(JSON.parse(readFileSync(join(dir, 'cuts.json'), 'utf8'))).toHaveLength(1);
    expect(existsSync(join(dir, 'transcript.json'))).toBe(true);
    const d = (await probe(join(dir, 'cleaned.mp4'))).durationSec;
    expect(d).toBeGreaterThan(2.0);
    expect(d).toBeLessThan(2.5);
  });
  it('throws a clear message for a video without audio', async () => {
    await makeSource('none');
    await expect(cleanStage(dir, { transcribe: stub([]) })).rejects.toThrow('Không tìm thấy lời nói trong video');
  });
  it('throws a clear message when the transcript has no words', async () => {
    await makeSource('silent');
    await expect(cleanStage(dir, { transcribe: stub([]) })).rejects.toThrow('Không tìm thấy lời nói trong video');
  });
});
