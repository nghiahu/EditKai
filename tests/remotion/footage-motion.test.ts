import { describe, it, expect, beforeAll } from 'vitest';
import { mkdtempSync, readFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { runFfmpeg } from '../../src/media/ffmpeg';
import { blankStill, planOf, stillOf } from './helper';
import type { Layer } from '../../src/plan/types';

// a small valid PNG as a data URI, so the success path needs no server
let PNG = '';
beforeAll(async () => {
  const file = join(mkdtempSync(join(tmpdir(), 'editkai-png-')), 'x.png');
  await runFfmpeg(['-y', '-f', 'lavfi', '-i', 'color=c=red:s=64x36', '-frames:v', '1', file]);
  PNG = `data:image/png;base64,${readFileSync(file).toString('base64')}`;
});
const footage = (fit: 'cover' | 'contain'): Layer => ({ id: 'f1', track: 'footage', type: 'footage', start: 0, end: 4, props: { src: PNG, fit } }); // PNG is read when each test runs
const bytes = async (frame: number, fit: 'cover' | 'contain', style: 's1' | 'm1' = 'm1') => readFileSync(await stillOf(planOf(style, [footage(fit)]), frame));

describe('Footage motion', () => {
  it('contain differs from cover at frame 40', async () => {
    expect((await bytes(40, 'contain')).equals(await bytes(40, 'cover'))).toBe(false);
  }, 240000);
  it('the contain card is still entering at frame 3 and settled at frame 40', async () => {
    expect((await bytes(3, 'contain')).equals(await bytes(40, 'contain'))).toBe(false);
  }, 240000);
  it('the contain card is a card: the top-left corner stays the background while a cover fills it', async () => {
    const corner = async (png: string) => {
      const out = join(mkdtempSync(join(tmpdir(), 'editkai-crop-')), 'c.png');
      await runFfmpeg(['-y', '-i', png, '-vf', 'crop=120:120:0:0', '-frames:v', '1', out]);
      return readFileSync(out);
    };
    const blank = await corner(await blankStill('m1', 40));
    expect((await corner(await stillOf(planOf('m1', [footage('contain')]), 40))).equals(blank)).toBe(true);
    expect((await corner(await stillOf(planOf('m1', [footage('cover')]), 40))).equals(blank)).toBe(false);
  }, 240000);
  for (const fit of ['cover', 'contain'] as const) {
    it(`the last frame equals a blank frame for fit ${fit}`, async () => {
      expect((await bytes(119, fit)).equals(readFileSync(await blankStill('m1', 119)))).toBe(true);
    }, 240000);
  }
});
