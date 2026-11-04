import { beforeEach, describe, expect, it } from 'vitest';
import { join } from 'node:path';
import { runCli } from '../../src/cli';
import { writeProject } from '../helpers/project';

const out: string[] = [];
const err: string[] = [];
const cli = (...argv: string[]) => runCli(argv, s => out.push(s), s => err.push(s));
beforeEach(() => { out.length = 0; err.length = 0; });

describe('preview command', () => {
  it('exits 2 for a missing project folder or no folder', async () => {
    expect(await cli('preview', join(writeProject(['x']), 'không-có'))).toBe(2);
    expect(await cli('preview')).toBe(2);
  });
  it('exits 1 with the stage message when there is no plan.json, for the pictures and for --video', async () => {
    const dir = writeProject(['Xin chào']);
    expect(await cli('preview', dir)).toBe(1);
    expect(err.join('\n')).toContain('plan.json');
    err.length = 0;
    expect(await cli('preview', dir, '--video')).toBe(1);
    expect(err.join('\n')).toContain('plan.json');
  });
  it('is in the usage list', async () => {
    await cli('nope', 'x');
    expect(err.join('\n')).toContain('preview');
  });
});
