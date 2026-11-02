import { existsSync, readFileSync } from 'node:fs';
import { join } from 'node:path';

export interface Theme {
  name: string;
  colors: Record<string, string>;
  fonts: { heading: string; body: string };
  captionSize: number;
  radius: number;
  animMs: number;
  limits: {
    maxCaptionWords: number;
    minSceneSec: number;
    safeZone: { top: number; bottom: number; left: number; right: number };
  };
}

export function loadTheme(styleDir: string): Theme {
  const file = join(styleDir, 'theme.json');
  if (!existsSync(file)) throw new Error(`Không tìm thấy phong cách: ${styleDir}`);
  return JSON.parse(readFileSync(file, 'utf8')) as Theme;
}
