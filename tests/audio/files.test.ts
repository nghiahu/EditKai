import { describe, expect, it } from 'vitest';
import { existsSync, mkdtempSync, readFileSync, statSync, utimesSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { sfxFile, writeSfxFiles } from '../../src/audio/files';
import { SOUNDS, synth, wavBytes } from '../../src/audio/synth';

describe('writeSfxFiles', () => {
  it('writes one WAV per sound under sfx/ and returns the relative paths', () => {
    const dir = mkdtempSync(join(tmpdir(), 'editkai-sfx-'));
    const paths = writeSfxFiles(dir);
    expect(paths).toEqual(SOUNDS.map(s => `sfx/${s}.wav`));
    for (const s of SOUNDS) expect(readFileSync(join(dir, sfxFile(s)))).toEqual(wavBytes(synth(s)));
  });
  it('leaves a file that is already right alone, and repairs one that is not', () => {
    const dir = mkdtempSync(join(tmpdir(), 'editkai-sfx-'));
    writeSfxFiles(dir);
    const f = join(dir, 'sfx', 'pop.wav');
    const old = new Date('2020-01-01');
    utimesSync(f, old, old);
    writeSfxFiles(dir);
    expect(statSync(f).mtime.getFullYear()).toBe(2020);
    writeFileSync(f, 'broken');
    writeSfxFiles(dir);
    expect(readFileSync(f)).toEqual(wavBytes(synth('pop')));
    expect(existsSync(join(dir, 'sfx', 'whoosh.wav'))).toBe(true);
  });
});
