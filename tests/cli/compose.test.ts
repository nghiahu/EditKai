import { beforeEach, describe, expect, it } from 'vitest';
import { existsSync, rmSync } from 'node:fs';
import { join } from 'node:path';
import { runCli } from '../../src/cli';
import { writeCleanedVideo, writeProject } from '../helpers/project';

const out: string[] = [];
const err: string[] = [];
const cli = (...argv: string[]) => runCli(argv, s => out.push(s), s => err.push(s));
beforeEach(() => { out.length = 0; err.length = 0; });

describe('compose command', () => {
  it('prints the summary and exits 0', async () => {
    const dir = writeProject(['Hôm nay mình dùng Claude để edit.', 'Chỉ mất hơn nửa tiếng thôi.']);
    await writeCleanedVideo(dir, 10);
    expect(await cli('analyze', dir)).toBe(0);
    out.length = 0;
    expect(await cli('compose', dir)).toBe(0);
    expect(existsSync(join(dir, 'plan.json'))).toBe(true);
    expect(out.join('\n')).toMatch(/plan\.json/);
    expect(out.join('\n')).toMatch(/caption/);
  }, 60000);
  it('exits 2 for a missing project and for no folder', async () => {
    expect(await cli('compose', join(writeProject(['x']), 'không-có'))).toBe(2);
    expect(await cli('compose')).toBe(2);
  });
  it('exits 1 without a storyboard', async () => {
    const dir = writeProject(['Xin chào mọi người.']);
    await writeCleanedVideo(dir, 5);
    rmSync(join(dir, 'storyboard.json'), { force: true });
    expect(await cli('compose', dir)).toBe(1);
    expect(err.join('\n')).toContain('storyboard.json');
  }, 60000);
  it('is in the usage list', async () => {
    await cli('nope', 'x');
    expect(err.join('\n')).toContain('compose');
  });
});
