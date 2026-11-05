import { describe, expect, it } from 'vitest';
import { mkdtempSync, writeFileSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { SAMPLE_RATE, SOUNDS, synth, wavBytes } from '../../src/audio/synth';
import { run } from '../../src/media/ffmpeg';

describe('synth', () => {
  it('has the five sounds, each with the expected length', () => {
    expect([...SOUNDS]).toEqual(['whoosh', 'swell', 'pop', 'tick', 'thud']);
    const secs = (n: (typeof SOUNDS)[number]) => synth(n).length / SAMPLE_RATE;
    expect(secs('whoosh')).toBeCloseTo(0.45, 2);
    expect(secs('swell')).toBeCloseTo(0.6, 2);
    expect(secs('pop')).toBeCloseTo(0.12, 2);
    expect(secs('tick')).toBeCloseTo(0.03, 2);
    expect(secs('thud')).toBeCloseTo(0.2, 2);
  });
  it('is audible but never louder than 0.9, and finite', () => {
    for (const n of SOUNDS) {
      const s = synth(n);
      const peak = s.reduce((m, v) => Math.max(m, Math.abs(v)), 0);
      expect(peak).toBeGreaterThan(0.5);
      expect(peak).toBeLessThanOrEqual(0.9 + 1e-6);
      expect(s.every(Number.isFinite)).toBe(true);
    }
  });
  it('gives the same bytes every time', () => {
    for (const n of SOUNDS) expect(wavBytes(synth(n)).equals(wavBytes(synth(n)))).toBe(true);
  });
  it('starts and ends near silence, so there is no click', () => {
    for (const n of SOUNDS) {
      const s = synth(n);
      expect(Math.abs(s[s.length - 1])).toBeLessThan(0.05);
    }
  });
  it('writes a WAV that ffprobe reads: mono, 44.1 kHz, the right length', async () => {
    const dir = mkdtempSync(join(tmpdir(), 'editkai-wav-'));
    try {
      const f = join(dir, 'pop.wav');
      writeFileSync(f, wavBytes(synth('pop')));
      const j = JSON.parse(await run('ffprobe', ['-v', 'error', '-show_streams', '-show_format', '-of', 'json', f]));
      expect(j.streams[0]).toMatchObject({ codec_type: 'audio', channels: 1, sample_rate: '44100' });
      expect(Number(j.format.duration)).toBeCloseTo(0.12, 1);
    } finally { rmSync(dir, { recursive: true, force: true }); }
  });
});
