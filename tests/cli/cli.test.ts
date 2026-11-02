import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { mkdtempSync, rmSync, existsSync, readFileSync, writeFileSync, mkdirSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { runCli } from '../../src/cli';
import { runFfmpeg } from '../../src/media/ffmpeg';
import type { Plan } from '../../src/plan/types';

let base: string, src: string;
const out: string[] = [];
const err: string[] = [];
const cli = (...argv: string[]) => runCli(argv, s => out.push(s), s => err.push(s));
const projectDir = () => join(base, 'dự án');

beforeEach(async () => {
  base = mkdtempSync(join(tmpdir(), 'editkai-'));
  out.length = 0; err.length = 0;
  src = join(base, 'gốc.mp4');
  await runFfmpeg(['-y', '-f', 'lavfi', '-i', 'color=c=gray:s=320x240:r=30:d=3', '-f', 'lavfi', '-i', 'sine=frequency=440:duration=3',
    '-c:v', 'libx264', '-pix_fmt', 'yuv420p', '-c:a', 'aac', '-shortest', src]);
});
afterEach(() => rmSync(base, { recursive: true, force: true }));

const writePlan = (layers: Plan['layers']) => {
  const plan: Plan = { version: 1, meta: { source: 'cleaned.mp4', fps: 30, width: 1080, height: 1920, style: 's1' }, scenes: [], layers };
  writeFileSync(join(projectDir(), 'plan.json'), JSON.stringify(plan));
};
const title = (id: string, start: number, end: number) => ({ id, track: 'title' as const, type: 'title-card', start, end, props: { icon: 'check', title: id } });
async function initProject(aspect?: string) {
  const args = ['init', projectDir(), '--source', src, '--style', 's1'];
  if (aspect) args.push('--aspect', aspect);
  expect(await cli(...args)).toBe(0);
  await runFfmpeg(['-y', '-i', src, '-c', 'copy', join(projectDir(), 'cleaned.mp4')]);
  out.length = 0; // drop init's message so tests can parse what the next command prints
}

describe('cli', () => {
  it('init sets canvas 1080x1920 for 9:16 and copies the source', async () => {
    await initProject('9:16');
    expect(existsSync(join(projectDir(), 'source.mp4'))).toBe(true);
    expect(JSON.parse(readFileSync(join(projectDir(), 'project.json'), 'utf8'))).toMatchObject({ style: 's1', aspect: '9:16', width: 1080, height: 1920, fps: 30 });
  });
  it('init defaults to 9:16 and supports 16:9', async () => {
    await initProject();
    expect(JSON.parse(readFileSync(join(projectDir(), 'project.json'), 'utf8')).aspect).toBe('9:16');
    rmSync(projectDir(), { recursive: true });
    await cli('init', projectDir(), '--source', src, '--style', 'm1', '--aspect', '16:9');
    expect(JSON.parse(readFileSync(join(projectDir(), 'project.json'), 'utf8'))).toMatchObject({ width: 1920, height: 1080 });
  });
  it('init rejects an unknown style or aspect', async () => {
    expect(await cli('init', projectDir(), '--source', src, '--style', 'zz')).toBe(2);
    expect(await cli('init', projectDir(), '--source', src, '--style', 's1', '--aspect', '4:3')).toBe(2);
    expect(err.join('\n')).toMatch(/zz|4:3/);
  });
  it('validate exits 0 and prints no issues for a good plan', async () => {
    await initProject(); writePlan([title('a', 0, 1)]);
    expect(await cli('validate', projectDir())).toBe(0);
    expect(JSON.parse(out.join(''))).toMatchObject({ round: 1, maxRounds: 3, issues: [] });
  });
  it('validate exits 1 on errors and prints their codes', async () => {
    await initProject(); writePlan([title('a', 0, 2), title('b', 1, 2)]);
    expect(await cli('validate', projectDir())).toBe(1);
    expect(JSON.parse(out.join('')).issues.map((i: { code: string }) => i.code)).toContain('track-overlap');
  });
  it('validate sets stop after the third round with issues remaining', async () => {
    await initProject(); writePlan([title('a', 0, 2), title('b', 1, 2)]);
    const rounds: any[] = [];
    for (let i = 0; i < 3; i++) { out.length = 0; await cli('validate', projectDir()); rounds.push(JSON.parse(out.join(''))); }
    expect(rounds.map(r => r.round)).toEqual([1, 2, 3]);
    expect(rounds[1].stop).toBeUndefined();
    expect(rounds[2].stop).toBe(true);
  });
  it('unknown command exits 2 with a one-line message', async () => {
    expect(await cli('bay')).toBe(2);
    expect(err).toHaveLength(1);
  });
  it('a missing project folder exits 2', async () => {
    expect(await cli('validate', join(base, 'không-có'))).toBe(2);
    expect(await cli('editor', join(base, 'không-có'))).toBe(2);
  });
  it('clean reports a clear error for a video without speech', async () => {
    mkdirSync(projectDir());
    await runFfmpeg(['-y', '-f', 'lavfi', '-i', 'color=c=gray:s=320x240:r=30:d=2', '-c:v', 'libx264', '-pix_fmt', 'yuv420p', join(projectDir(), 'source.mp4')]);
    expect(await cli('clean', projectDir())).toBe(1);
    expect(err.join('')).toContain('Không tìm thấy lời nói trong video');
  });
});
