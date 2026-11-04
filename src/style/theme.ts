import { existsSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import type { CaptionEmphasis } from '../plan/captionProps';
import { DEFAULT_DIRECTOR, type Director } from './director';
import { DEFAULT_MOTION, type Motion } from './motion';

export { DEFAULT_MOTION, type Motion };
export { DEFAULT_DIRECTOR, type Director };

export interface Theme {
  name: string;
  colors: Record<string, string>;
  fonts: { heading: string; body: string };
  captionSize: number;
  radius: number;
  animMs: number;
  motion: Motion;
  director: Director;
  captionEmphasis: CaptionEmphasis;
  captionBigScale: number;
  limits: {
    maxCaptionWords: number;
    minSceneSec: number;
    safeZone: { top: number; bottom: number; left: number; right: number };
  };
}

export function loadTheme(styleDir: string): Theme {
  const file = join(styleDir, 'theme.json');
  if (!existsSync(file)) throw new Error(`Không tìm thấy phong cách: ${styleDir}`);
  const raw = JSON.parse(readFileSync(file, 'utf8'));
  // themes written before the motion pass have no motion block: fill what is missing from the defaults
  return {
    captionEmphasis: 'box',
    captionBigScale: 2,
    ...raw,
    motion: { ...DEFAULT_MOTION, ...raw.motion, spring: { ...DEFAULT_MOTION.spring, ...raw.motion?.spring } },
    // same for the director block; captionMix is merged field by field, allowedInserts is replaced as a whole
    director: { ...DEFAULT_DIRECTOR, ...raw.director, captionMix: { ...DEFAULT_DIRECTOR.captionMix, ...raw.director?.captionMix } },
  } as Theme;
}
