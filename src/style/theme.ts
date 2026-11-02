import { existsSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import { DEFAULT_MOTION, type Motion } from './motion';

export { DEFAULT_MOTION, type Motion };

export interface Theme {
  name: string;
  colors: Record<string, string>;
  fonts: { heading: string; body: string };
  captionSize: number;
  radius: number;
  animMs: number;
  motion: Motion;
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
  return { ...raw, motion: { ...DEFAULT_MOTION, ...raw.motion, spring: { ...DEFAULT_MOTION.spring, ...raw.motion?.spring } } } as Theme;
}
