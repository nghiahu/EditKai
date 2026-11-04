import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { runFfmpeg } from '../../src/media/ffmpeg';
import { runQa, resetQaRounds } from '../../src/stages/qa';

let dir: string;
beforeEach(async () => {
  dir = mkdtempSync(join(tmpdir(), 'editkai-'));
  await runFfmpeg(['-y', '-f', 'lavfi', '-i', 'color=c=gray:s=320x240:r=30:d=3', '-c:v', 'libx264', '-pix_fmt', 'yuv420p', join(dir, 'cleaned.mp4')]);
  const t = (id: string, s: number, e: number) => ({ id, track: 'title', type: 'title-card', start: s, end: e, props: { icon: 'check', title: id } });
  writeFileSync(join(dir, 'plan.json'), JSON.stringify({ version: 1, meta: { source: 'cleaned.mp4', fps: 30, width: 1080, height: 1920, style: 's1' }, scenes: [], layers: [t('a', 0, 2), t('b', 1, 2)] }));
});
afterEach(() => rmSync(dir, { recursive: true, force: true }));

describe('QA rounds', () => {
  it('stops at round 3, and resetQaRounds starts a new count (a later editing session)', async () => {
    const rounds = [];
    for (let i = 0; i < 3; i++) rounds.push(await runQa(dir));
    expect(rounds[2]).toMatchObject({ round: 3, stop: true });
    resetQaRounds(dir);
    expect(await runQa(dir)).toMatchObject({ round: 1 });
  });
});

import { checkProject } from '../../src/stages/qa';

describe('checkProject with assets.json', () => {
  it('a corrupt manifest becomes one asset-manifest-invalid warning instead of an exception (Review Focus 5)', async () => {
    writeFileSync(join(dir, 'assets.json'), '{ not json');
    const issues = await checkProject(dir);
    expect(issues.filter(i => i.code === 'asset-manifest-invalid')).toHaveLength(1);
    expect(issues.find(i => i.code === 'asset-manifest-invalid')?.severity).toBe('warning');
  });
  it('a manifest entry whose file is missing warns asset-missing', async () => {
    writeFileSync(join(dir, 'assets.json'), JSON.stringify({ assets: [{ file: 'assets/gone.mp4', description: 'x', kind: 'screen' }] }));
    expect((await checkProject(dir)).some(i => i.code === 'asset-missing')).toBe(true);
  });
});

describe('checkProject with a malformed but parseable assets.json', () => {
  it('an entry that is not an object with a string file becomes a warning instead of a crash', async () => {
    for (const manifest of [{ assets: ['assets/a.mp4'] }, { assets: [{}] }, { assets: [{ file: 3 }] }, { assets: [null] }]) {
      writeFileSync(join(dir, 'assets.json'), JSON.stringify(manifest));
      const issues = await checkProject(dir);
      expect(issues.some(i => i.code === 'asset-manifest-invalid' && i.severity === 'warning')).toBe(true);
    }
  });
  it('valid entries next to a broken one are still checked', async () => {
    writeFileSync(join(dir, 'assets.json'), JSON.stringify({ assets: [{ file: 'assets/gone.mp4' }, 'oops'] }));
    const codes = (await checkProject(dir)).map(i => i.code);
    expect(codes).toContain('asset-missing');
    expect(codes).toContain('asset-manifest-invalid');
  });
});
