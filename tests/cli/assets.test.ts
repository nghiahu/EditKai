import { describe, it, expect, beforeAll, afterAll, beforeEach } from 'vitest';
import { existsSync, mkdirSync, mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { runCli } from '../../src/cli';
import { runFfmpeg } from '../../src/media/ffmpeg';

let base: string, clip: string, project: string;
const out: string[] = [];
const err: string[] = [];
const cli = (...argv: string[]) => runCli(argv, s => out.push(s), s => err.push(s));

beforeAll(async () => {
  base = mkdtempSync(join(tmpdir(), 'editkai-assets-cli-'));
  clip = join(base, 'màn hình.mp4');
  await runFfmpeg(['-y', '-f', 'lavfi', '-i', 'testsrc2=s=320x180:r=30:d=1', '-pix_fmt', 'yuv420p', clip]);
});
afterAll(() => rmSync(base, { recursive: true, force: true }));
beforeEach(() => {
  out.length = 0; err.length = 0;
  project = join(base, 'dự án', String(Math.random()).slice(2));
  mkdirSync(project, { recursive: true });
});

describe('assets command', () => {
  it('assets add prints the entry and exits 0', async () => {
    expect(await cli('assets', 'add', project, clip, '--desc', 'quay màn hình editor')).toBe(0);
    expect(JSON.parse(out.join(''))).toMatchObject({ file: 'assets/màn hình.mp4', kind: 'screen', description: 'quay màn hình editor' });
    expect(existsSync(join(project, 'assets', 'màn hình.mp4'))).toBe(true);
  });
  it('assets add exits 2 without --desc, with an invalid --kind, with a missing file or a missing project', async () => {
    expect(await cli('assets', 'add', project, clip)).toBe(2);
    expect(await cli('assets', 'add', project, clip, '--desc', 'x', '--kind', 'film')).toBe(2);
    expect(await cli('assets', 'add', project, join(base, 'không-có.mp4'), '--desc', 'x')).toBe(2);
    expect(await cli('assets', 'add', join(base, 'không-có-dự-án'), clip, '--desc', 'x')).toBe(2);
    expect(err.length).toBeGreaterThanOrEqual(4);
  });
  it('assets list prints the manifest', async () => {
    await cli('assets', 'add', project, clip, '--desc', 'một', '--kind', 'phone');
    out.length = 0;
    expect(await cli('assets', 'list', project)).toBe(0);
    expect(JSON.parse(out.join('')).assets).toHaveLength(1);
  });
  it('assets list of a project without a manifest prints an empty list', async () => {
    expect(await cli('assets', 'list', project)).toBe(0);
    expect(JSON.parse(out.join(''))).toEqual({ assets: [] });
  });
  it('an unknown assets sub-command exits 2', async () => {
    expect(await cli('assets', 'remove', project)).toBe(2);
    expect(await cli('assets')).toBe(2);
  });
  it('a corrupt manifest is reported, not thrown, by assets list', async () => {
    const { writeFileSync } = await import('node:fs');
    writeFileSync(join(project, 'assets.json'), '{ nope');
    expect(await cli('assets', 'list', project)).toBe(1);
    expect(err.join('')).toMatch(/assets\.json/);
  });
});
