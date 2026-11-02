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
