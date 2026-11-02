import { existsSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import type { Plan } from './types';

export function readPlan(projectDir: string): Plan {
  const file = join(projectDir, 'plan.json');
  if (!existsSync(file)) throw new Error(`Chưa có plan.json trong ${projectDir}`);
  try { return JSON.parse(readFileSync(file, 'utf8')) as Plan; }
  catch (e) { throw new Error(`plan.json không phải JSON hợp lệ: ${(e as Error).message}`); }
}
