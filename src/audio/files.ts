import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { SOUNDS, sfxFile, synth, wavBytes } from './synth';

export { sfxFile };

/** Writes the sound effects as WAV files into `<project>/sfx/` (the project folder is what the renderer serves). A file that is already right is left alone. */
export function writeSfxFiles(projectDir: string): string[] {
  mkdirSync(join(projectDir, 'sfx'), { recursive: true });
  return SOUNDS.map(sound => {
    const rel = sfxFile(sound);
    const file = join(projectDir, rel);
    const bytes = wavBytes(synth(sound));
    if (!existsSync(file) || !readFileSync(file).equals(bytes)) writeFileSync(file, bytes);
    return rel;
  });
}
