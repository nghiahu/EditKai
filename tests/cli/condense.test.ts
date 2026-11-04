import { beforeEach, describe, expect, it } from 'vitest';
import { existsSync, readFileSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { runCli } from '../../src/cli';
import { writeProject } from '../helpers/project';

const out: string[] = [];
const err: string[] = [];
const cli = (...argv: string[]) => runCli(argv, s => out.push(s), s => err.push(s));
beforeEach(() => { out.length = 0; err.length = 0; });

describe('fix-transcript command', () => {
  it('fixes the words in transcript.json from transcript-fixes.json and says how many', async () => {
    const dir = writeProject(['Một câu thôi.']);
    writeFileSync(join(dir, 'transcript-fixes.json'), JSON.stringify([{ sai: 'thôi', dung: 'nữa' }]));
    expect(await cli('fix-transcript', dir)).toBe(0);
    expect(out.join('\n')).toMatch(/1 từ/);
    expect(JSON.parse(readFileSync(join(dir, 'transcript.json'), 'utf8')).words.map((w: { t: string }) => w.t)).toContain('nữa.');
    expect(existsSync(join(dir, 'transcript.whisper.json'))).toBe(true);
  });
  it('--fixes names another file; exit 1 with the stage message when it is missing; 2 for a missing project', async () => {
    const dir = writeProject(['Một câu thôi.']);
    const other = join(dir, 'sua.json');
    writeFileSync(other, JSON.stringify([{ sai: 'một', dung: 'hai' }]));
    expect(await cli('fix-transcript', dir, '--fixes', other)).toBe(0);
    expect(await cli('fix-transcript', dir)).toBe(1);
    expect(err.join('\n')).toContain('transcript-fixes.json');
    expect(await cli('fix-transcript', join(dir, 'không-có'))).toBe(2);
  });
});

describe('condense and pauses commands', () => {
  it('exit 2 for a missing project, 1 with the stage message when the inputs are missing', async () => {
    const dir = writeProject(['Xin chào']);
    expect(await cli('condense', join(dir, 'không-có'))).toBe(2);
    expect(await cli('condense', dir)).toBe(1);
    expect(err.join('\n')).toContain('condense-spec.json');
    err.length = 0;
    expect(await cli('pauses', dir)).toBe(1);
    expect(err.join('\n')).toContain('cleaned.mp4');
  });
  it('are in the usage list', async () => {
    await cli('nope', 'x');
    for (const c of ['condense', 'pauses', 'fix-transcript']) expect(err.join('\n')).toContain(c);
  });
});
