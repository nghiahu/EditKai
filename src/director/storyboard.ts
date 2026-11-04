import { existsSync, readFileSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import type { Storyboard } from './types';

const FILE = 'storyboard.json';

export function readStoryboard(projectDir: string): Storyboard {
  const file = join(projectDir, FILE);
  if (!existsSync(file)) throw new Error(`Chưa có ${FILE} — chạy analyze trước`);
  try {
    return JSON.parse(readFileSync(file, 'utf8')) as Storyboard;
  } catch (e) {
    throw new Error(`${FILE} không phải JSON hợp lệ: ${(e as Error).message}`);
  }
}

export function writeStoryboard(projectDir: string, sb: Storyboard): void {
  writeFileSync(join(projectDir, FILE), JSON.stringify(sb, null, 2));
}
