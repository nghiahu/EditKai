import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { existsSync, mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { condenseStage } from '../../src/stages/condense';
import { runFfmpeg } from '../../src/media/ffmpeg';
import { probe } from '../../src/media/probe';

let base: string;
type W = { t: string; s: number; e: number };
const W = (t: string, s: number): W => ({ t, s, e: s + 0.3 });
// 12 s of tone with a 0.4 s pause at 4.0 s and another at 9.0 s
const WORDS = [W('một', 0.5), W('hai', 1.5), W('ba', 2.5), W('bốn', 3.5), W('năm', 4.8), W('sáu', 6), W('bảy', 7.5), W('tám', 9.6), W('chín', 10.8)];

async function project(opts: { cleaned?: boolean } = {}): Promise<string> {
  const dir = join(base, `dự án ${Math.random().toString(36).slice(2, 8)}`);
  mkdirSync(dir, { recursive: true });
  if (opts.cleaned !== false) {
    await runFfmpeg(['-y', '-f', 'lavfi', '-i', 'color=c=black:s=160x120:r=30:d=12',
      '-f', 'lavfi', '-i', "sine=frequency=300:sample_rate=16000:duration=12,volume=0:enable='between(t,4,4.4)+between(t,9,9.4)'",
      '-c:v', 'libx264', '-pix_fmt', 'yuv420p', '-c:a', 'aac', '-shortest', join(dir, 'cleaned.mp4')]);
  }
  writeFileSync(join(dir, 'transcript.json'), JSON.stringify({ words: WORDS }));
  return dir;
}
const spec = (dir: string, keep: { from: string; to: string }[]) => { const f = join(dir, 'condense-spec.json'); writeFileSync(f, JSON.stringify({ keep })); return f; };
// what Whisper "hears" in the cut video: the kept words, retimed
const fakeHeard = async (_video: string, out: string) => {
  const words = [W('một', 0.5), W('hai', 1.5), W('ba', 2.5), W('bốn', 3.5), W('tám', 4.6), W('chín', 5.8)];
  writeFileSync(out, JSON.stringify({ words }));
  return { words };
};

beforeAll(() => { base = mkdtempSync(join(tmpdir(), 'editkai-condense-')); });
afterAll(() => rmSync(base, { recursive: true, force: true }));

describe('condenseStage', () => {
  it('keeps the chosen sentences, cuts inside the pauses, and keeps the original as full.mp4', async () => {
    const dir = await project();
    const r = await condenseStage(dir, spec(dir, [{ from: 'một', to: 'bốn' }, { from: 'tám', to: 'chín' }]), { transcribe: fakeHeard });
    expect(r.segments).toHaveLength(2);
    expect(r.segments[0].end).toBeGreaterThan(4.0); // inside the pause 4.0-4.4
    expect(r.segments[0].end).toBeLessThan(4.4);
    expect(r.segments[1].start).toBeGreaterThan(9.0); // inside the pause 9.0-9.4
    expect(r.segments[1].start).toBeLessThan(9.45);
    expect(r.joins).toHaveLength(1);
    expect(existsSync(join(dir, 'full.mp4'))).toBe(true);
    expect(existsSync(join(dir, 'transcript.full.json'))).toBe(true);
    const cut = await probe(join(dir, 'cleaned.mp4'));
    expect(Math.abs(cut.durationSec - (r.keptSec))).toBeLessThan(0.3);
    expect(JSON.parse(readFileSync(join(dir, 'transcript.json'), 'utf8')).words).toHaveLength(6); // re-transcribed
    expect(JSON.parse(readFileSync(join(dir, 'condense.json'), 'utf8')).joins).toEqual(r.joins);
  }, 120000);
  it('two sentences that follow each other make one part with no join', async () => {
    const dir = await project();
    const r = await condenseStage(dir, spec(dir, [{ from: 'một', to: 'bốn' }, { from: 'năm', to: 'bảy' }]), { transcribe: fakeHeard });
    expect(r.segments).toHaveLength(1);
    expect(r.joins).toEqual([]);
  }, 120000);
  it('reports a word nobody asked for at a join as a problem', async () => {
    const dir = await project();
    const noisy = async (_v: string, out: string) => {
      const words = [W('một', 0.5), W('hai', 1.5), W('ba', 2.5), W('bốn', 3.5), W('chính', 3.8), W('tám', 4.6), W('chín', 5.8)];
      writeFileSync(out, JSON.stringify({ words }));
      return { words };
    };
    const r = await condenseStage(dir, spec(dir, [{ from: 'một', to: 'bốn' }, { from: 'tám', to: 'chín' }]), { transcribe: noisy });
    expect(r.problems).toBe(1);
    expect(r.lines.join('\n')).toContain('chính');
  }, 120000);
  it('running it again cuts from the original again (full.mp4), not from the already cut video', async () => {
    const dir = await project();
    await condenseStage(dir, spec(dir, [{ from: 'một', to: 'bốn' }, { from: 'tám', to: 'chín' }]), { transcribe: fakeHeard });
    const r2 = await condenseStage(dir, spec(dir, [{ from: 'một', to: 'bốn' }]), { transcribe: fakeHeard });
    expect(r2.segments).toHaveLength(1);
    expect(r2.segments[0].start).toBeLessThan(1); // 'một' is found in the full transcript, not in the shortened one
  }, 120000);
  it('clear errors: no cleaned video, no spec, an empty spec, a phrase that is not in the speech', async () => {
    const none = await project({ cleaned: false });
    await expect(condenseStage(none, spec(none, [{ from: 'một', to: 'bốn' }]), { transcribe: fakeHeard })).rejects.toThrow('cleaned.mp4');
    const dir = await project();
    await expect(condenseStage(dir, join(dir, 'khong-co.json'), { transcribe: fakeHeard })).rejects.toThrow('condense-spec.json');
    await expect(condenseStage(dir, spec(dir, []), { transcribe: fakeHeard })).rejects.toThrow('keep');
    await expect(condenseStage(dir, spec(dir, [{ from: 'không có đâu', to: 'bốn' }]), { transcribe: fakeHeard })).rejects.toThrow('không có đâu');
  }, 120000);
});

describe('condenseStage and transcript-fixes.json', () => {
  it('applies the fixes again to the new transcript and says how many words changed', async () => {
    const dir = await project();
    writeFileSync(join(dir, 'transcript-fixes.json'), JSON.stringify([{ sai: 'tám', dung: 'tấm' }, { sai: 'không có', dung: 'x' }]));
    const r = await condenseStage(dir, spec(dir, [{ from: 'một', to: 'bốn' }, { from: 'tám', to: 'chín' }]), { transcribe: fakeHeard });
    const words = (JSON.parse(readFileSync(join(dir, 'transcript.json'), 'utf8')).words as W[]).map(w => w.t);
    expect(words).toContain('tấm');
    expect(r.lines.join('\n')).toMatch(/sửa 1 từ/);
    expect(r.lines.join('\n')).toMatch(/không có/); // the fix that matched nothing is named
  }, 120000);
  it('without transcript-fixes.json nothing is said about fixes', async () => {
    const dir = await project();
    const r = await condenseStage(dir, spec(dir, [{ from: 'một', to: 'bốn' }]), { transcribe: fakeHeard });
    expect(r.lines.join('\n')).not.toMatch(/sửa/);
  }, 120000);
});
