import { describe, it, expect, beforeEach } from 'vitest';
import { existsSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import { runCli } from '../../src/cli';
import { writeStoryboard, readStoryboard } from '../../src/director/storyboard';
import { writeProject } from '../helpers/project';

const out: string[] = [];
const err: string[] = [];
const cli = (...argv: string[]) => runCli(argv, s => out.push(s), s => err.push(s));
beforeEach(() => { out.length = 0; err.length = 0; });

describe('analyze command', () => {
  it('writes storyboard.json, prints a summary and exits 0', async () => {
    const dir = writeProject(['Hôm nay mình dùng Claude để edit.', 'Chỉ mất hơn nửa tiếng thôi.']);
    expect(await cli('analyze', dir)).toBe(0);
    expect(existsSync(join(dir, 'storyboard.json'))).toBe(true);
    expect(out.join('\n')).toMatch(/2 nhịp/);
  });
  it('the summary counts the inserts by type so the variety can be seen', async () => {
    const dir = writeProject(['Đầu tiên là phần mở bài.', 'Hôm nay mình dùng Claude để edit video nhé.', 'Chỉ mất hơn nửa tiếng thôi.'], { style: 's1' });
    expect(await cli('analyze', dir)).toBe(0);
    expect(out.join('\n')).toMatch(/title-card \d/);
  });
  it('exits 2 for a missing project folder or no folder argument', async () => {
    expect(await cli('analyze', join(writeProject(['x']), 'không-có'))).toBe(2);
    expect(await cli('analyze')).toBe(2);
  });
  it('exits 1 with the stage message when there is no transcript', async () => {
    const dir = writeProject(['Xin chào']);
    const { rmSync } = await import('node:fs');
    rmSync(join(dir, 'transcript.json'));
    expect(await cli('analyze', dir)).toBe(1);
    expect(err.join('\n')).toContain('Chưa có transcript.json');
  });
  it('refuses a reviewed storyboard until the bare --force flag is given', async () => {
    const dir = writeProject(['Một câu đơn giản thôi.']);
    await cli('analyze', dir);
    const sb = readStoryboard(dir);
    sb.beats[0].reviewed = true;
    writeStoryboard(dir, sb);
    expect(await cli('analyze', dir)).toBe(1);
    expect(err.join('\n')).toContain('--force');
    expect(await cli('analyze', dir, '--force')).toBe(0);
    expect(JSON.parse(readFileSync(join(dir, 'storyboard.json'), 'utf8')).beats[0].reviewed).toBe(false);
  });
  it('is listed in the command list of the usage message', async () => {
    await cli('nope', 'x');
    expect(err.join('\n')).toContain('analyze');
  });
});

describe('analyze summary and fillers', () => {
  it('says how many inserts are guesses to confirm', async () => {
    const dir = writeProject(Array.from({ length: 14 }, () => 'Mình nói tiếp về chủ đề này một cách bình thường.'), { style: 'm1' });
    out.length = 0;
    expect(await cli('analyze', dir)).toBe(0);
    expect(out.join('\n')).toMatch(/chưa chắc/);
  });
});
