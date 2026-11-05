import { describe, expect, it } from 'vitest';
import { mkdtempSync, readFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { runFfmpeg } from '../../src/media/ffmpeg';
import { planOf, stillOf } from './helper';
import type { Layer } from '../../src/plan/types';

const cap = (props: Record<string, unknown>): Layer => ({
  id: 'c1', track: 'caption', start: 0, end: 4, props,
  words: ['cái', 'chặng', 'đường', 'dài'].map((t, i) => ({ t, s: 0.2 + i * 0.3, e: 0.4 + i * 0.3, hl: false })),
});

/** How many pixels of a still are yellow (the style's yellow: red and green high, blue low). */
async function yellowPixels(png: string): Promise<number> {
  const raw = join(mkdtempSync(join(tmpdir(), 'editkai-ink-')), 'rgb.raw');
  await runFfmpeg(['-y', '-i', png, '-vf', 'scale=540:960', '-pix_fmt', 'rgb24', '-f', 'rawvideo', raw]);
  const px = readFileSync(raw);
  let n = 0;
  for (let i = 0; i + 2 < px.length; i += 3) if (px[i] > 200 && px[i + 1] > 170 && px[i + 2] < 120) n++;
  return n;
}

describe('caption ink', () => {
  for (const variant of ['phrase', 'word']) {
    it(`${variant}: ink "accent" sets the text in the style's yellow; the default text is white (no yellow at all)`, async () => {
      const white = await yellowPixels(await stillOf(planOf('m1', [cap({ variant })]), 80));
      const yellow = await yellowPixels(await stillOf(planOf('m1', [cap({ variant, ink: 'accent' })]), 80));
      expect(white).toBe(0);
      expect(yellow).toBeGreaterThan(300);
    }, 300000);
  }
});
