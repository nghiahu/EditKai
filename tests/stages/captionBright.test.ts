import { describe, expect, it } from 'vitest';
import { join } from 'node:path';
import { measureCaptionBright } from '../../src/stages/captionBright';
import { loadTheme } from '../../src/style/theme';
import type { Layer } from '../../src/plan/types';
import { writeCleanedVideo, writeProject } from '../helpers/project';

const theme = loadTheme('styles/m1');
const caption = (id: string, start: number, end: number, props?: Record<string, unknown>): Layer => ({ id, track: 'caption', start, end, props, words: [{ t: 'x', s: start, e: end, hl: false }] });

describe('measureCaptionBright', () => {
  it('shares the text width on a near-white picture: all of it on a white picture, none on a black one', async () => {
    const dir = writeProject(['x']);
    await writeCleanedVideo(dir, 3, 'white');
    const white = await measureCaptionBright(join(dir, 'cleaned.mp4'), [caption('a', 0.2, 1.5)], theme);
    expect(white.get('a')!).toBeGreaterThan(0.85);
    await writeCleanedVideo(dir, 3, 'black');
    const black = await measureCaptionBright(join(dir, 'cleaned.mp4'), [caption('a', 0.2, 1.5)], theme);
    expect(black.get('a')!).toBeLessThan(0.15);
  }, 60000);
  it('measures each position where its caption sits, and ignores layers it cannot place', async () => {
    const dir = writeProject(['x']);
    await writeCleanedVideo(dir, 3, 'white');
    const m = await measureCaptionBright(join(dir, 'cleaned.mp4'), [caption('t', 0, 1, { position: 'top' }), caption('c', 0, 1, { variant: 'big' }), caption('late', 50, 51)], theme);
    expect(m.get('t')!).toBeGreaterThan(0.85);
    expect(m.get('c')!).toBeGreaterThan(0.85);
    expect(m.has('late')).toBe(false); // starts after the video ends
  }, 60000);
});

describe('measureCaptionBright looks only where the text is', () => {
  const wordsOf = (n: number): Layer['words'] => Array.from({ length: n }, (_, i) => ({ t: 'abcdefgh', s: 0.1 + i * 0.05, e: 0.15 + i * 0.05, hl: false }));
  it('a short centred caption ignores a white panel at the far left; a long one that reaches it does not', async () => {
    const dir = writeProject(['x']);
    // 16:9 picture, the left 28% white (like the source video\'s panel), the rest black
    const clip = join(dir, 'cleaned.mp4');
    const { runFfmpeg } = await import('../../src/media/ffmpeg');
    await runFfmpeg(['-y', '-f', 'lavfi', '-i', 'color=c=black:s=640x360:r=30:d=2,drawbox=x=0:y=0:w=180:h=360:color=white:t=fill', '-c:v', 'libx264', '-pix_fmt', 'yuv420p', clip]);
    const short: Layer = { id: 'short', track: 'caption', start: 0, end: 1, words: wordsOf(2) };
    const long: Layer = { id: 'long', track: 'caption', start: 0, end: 1, words: wordsOf(10) };
    const m = await measureCaptionBright(clip, [short, long], theme, 1920);
    expect(m.get('short')!).toBeLessThan(0.15);
    expect(m.get('long')!).toBeGreaterThan(0.15);
  }, 60000);
});

describe('measureCaptionBright for a picture cropped into the frame', () => {
  it('looks at the part of the picture that is in the frame: a white left half counts only when the focus is on it', async () => {
    const dir = writeProject(['x']);
    const clip = join(dir, 'cleaned.mp4');
    const { runFfmpeg } = await import('../../src/media/ffmpeg');
    await runFfmpeg(['-y', '-f', 'lavfi', '-i', 'color=c=black:s=640x360:r=30:d=2,drawbox=x=0:y=0:w=320:h=360:color=white:t=fill', '-c:v', 'libx264', '-pix_fmt', 'yuv420p', clip]);
    const layer: Layer = { id: 'c', track: 'caption', start: 0, end: 1, words: [{ t: 'abcdefgh', s: 0, e: 1, hl: false }] };
    const view = (x: number) => ({ width: 1080, height: 1920, fit: 'cover' as const, focus: { x, y: 0.5 } });
    expect((await measureCaptionBright(clip, [layer], theme, 1080, view(0))).get('c')!).toBeGreaterThan(0.8);
    expect((await measureCaptionBright(clip, [layer], theme, 1080, view(1))).get('c')!).toBeLessThan(0.1);
  }, 60000);
});
