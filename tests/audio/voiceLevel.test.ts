import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { runFfmpeg } from '../../src/media/ffmpeg';
import { levelAround, parseLevels, voiceLevels } from '../../src/audio/voiceLevel';
import { DENSITY_OFFSET_DB, SFX_VOLUME, sfxVolume } from '../../src/audio/gain';
import { PEAK } from '../../src/audio/synth';

describe('parseLevels', () => {
  it('reads one dB value per 0.1 s chunk from ffmpeg\'s metadata lines, and -inf as very quiet', () => {
    const text = 'frame:0 pts:0 pts_time:0\nlavfi.astats.Overall.RMS_level=-34.8\nframe:1 pts:1600 pts_time:0.1\nlavfi.astats.Overall.RMS_level=-inf\nframe:2\nlavfi.astats.Overall.RMS_level=-20.5\n';
    expect(parseLevels(text)).toEqual([-34.8, -120, -20.5]);
    expect(parseLevels('nothing here')).toEqual([]);
  });
});

describe('levelAround', () => {
  const levels = [-60, -60, -20, -30, -60, -60, -60, -60, -60, -60]; // chunks 0.1 s each: 0.2-0.3 s is -20 dB
  it('is the loudest chunk from a little before a moment to a little after it (default: 0.1 s before, 0.4 s after)', () => {
    expect(levelAround(levels, 0.25)).toBe(-20); // the window 0.15-0.65 s holds the loud chunk
    expect(levelAround(levels, 0.5, 0.1, 0.1)).toBe(-60); // 0.4-0.6 s is quiet
    expect(levelAround(levels, 0.45, 0.2, 0.1)).toBe(-20); // 0.25-0.55 s reaches back to the loud chunk
  });
  it('is undefined when there is nothing measured there', () => {
    expect(levelAround([], 1)).toBeUndefined();
    expect(levelAround(levels, 50)).toBeUndefined();
  });
});

describe('sfxVolume: the level of a sound effect from the level of the voice around it', () => {
  it('follows the voice: a louder voice gives a louder effect, by the same number of dB, until the cap', () => {
    const quiet = sfxVolume(-30, 'standard', 1);
    const loud = sfxVolume(-24, 'standard', 1);
    expect(loud / quiet).toBeCloseTo(10 ** (6 / 20), 2);
  });
  it('density: restrained is quieter than standard, which is quieter than rich', () => {
    const [a, b, c] = (['restrained', 'standard', 'rich'] as const).map(d => sfxVolume(-30, d, 1));
    expect(a).toBeLessThan(b);
    expect(b).toBeLessThan(c);
    expect(DENSITY_OFFSET_DB.rich - DENSITY_OFFSET_DB.restrained).toBe(12);
  });
  it('never above the cap; with no voice to measure (silence or nothing) it is the cap', () => {
    expect(sfxVolume(-5, 'rich', 0.25)).toBe(0.25);
    expect(sfxVolume(undefined, 'standard', 0.25)).toBe(0.25);
    expect(sfxVolume(-120, 'standard', 0.4)).toBe(0.4);
  });
  it('an effect is always well under the voice: its peak at least 9 dB below the voice level on every density (a listener on headphones was hurt by effects above it)', () => {
    for (const density of ['restrained', 'standard', 'rich'] as const) {
      for (const voiceDb of [-30, -20, -12]) {
        const peakDb = 20 * Math.log10(sfxVolume(voiceDb, density, 1) * PEAK);
        expect(peakDb).toBeLessThanOrEqual(voiceDb - 5);
      }
    }
    expect(DENSITY_OFFSET_DB.standard).toBeLessThanOrEqual(-9);
  });
  it('and never above a low ceiling by default', () => {
    expect(sfxVolume(-5, 'rich', SFX_VOLUME)).toBeLessThanOrEqual(0.12);
    expect(SFX_VOLUME).toBeLessThanOrEqual(0.12);
  });
});

describe('voiceLevels on a real file', () => {
  let dir: string;
  let file: string;
  beforeAll(async () => {
    dir = mkdtempSync(join(tmpdir(), 'editkai-voice-'));
    file = join(dir, 'giọng thử.mp4');
    // 1 s of a loud tone, then 1 s of silence
    await runFfmpeg(['-y', '-f', 'lavfi', '-i', 'color=c=black:s=160x120:r=30:d=2', '-f', 'lavfi', '-i', "sine=frequency=300:sample_rate=16000:duration=2,volume=0.5:enable='lt(t,1)',volume=0:enable='gte(t,1)'",
      '-c:v', 'libx264', '-pix_fmt', 'yuv420p', '-c:a', 'aac', '-shortest', file]);
  });
  afterAll(() => rmSync(dir, { recursive: true, force: true }));
  it('measures the loud second and the quiet second apart', async () => {
    const levels = await voiceLevels(file);
    expect(levels.length).toBeGreaterThanOrEqual(19);
    expect(levelAround(levels, 0.5, 0.1, 0.2)!).toBeGreaterThan(-35); // the tone is about -27 dB
    expect(levelAround(levels, 1.6, 0.1, 0.2)!).toBeLessThan(-60);
  }, 60000);
});
