import { existsSync, readFileSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { LAYER_TYPES } from '../plan/layerTypes';
import type { CameraSpec, InsertSpec, Storyboard } from './types';

const FILE = 'storyboard.json';
const CAMERA_TYPES = ['zoom-punch', 'shake'];
const MAX_BIG_WORDS = 3;

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

const timeProblem = (at: unknown, duration: unknown, durationSec: number): string | undefined => {
  if (typeof at !== 'number' || !Number.isFinite(at) || at < 0 || at > durationSec) return `at ${String(at)} nằm ngoài video (0–${durationSec}s)`;
  if (typeof duration !== 'number' || !Number.isFinite(duration) || duration <= 0) return `duration ${String(duration)} phải lớn hơn 0`;
  return undefined;
};

/** Why an insert entry cannot become a layer (unknown type, bad time, props its layer type rejects), or undefined when it can. */
export function insertProblem(spec: InsertSpec, durationSec: number): string | undefined {
  const lt = LAYER_TYPES[spec?.type];
  if (!lt) return `type "${spec?.type}" không có`;
  const t = timeProblem(spec.at, spec.duration, durationSec);
  if (t) return t;
  const p = lt.check((spec.props ?? {}) as Record<string, unknown>);
  return p ? `props: ${p}` : undefined;
}

export function cameraProblem(spec: CameraSpec, durationSec: number): string | undefined {
  if (!CAMERA_TYPES.includes(spec?.type)) return `camera type "${spec?.type}" không có`;
  const t = timeProblem(spec.at, spec.duration, durationSec);
  if (t) return t;
  const p = LAYER_TYPES[spec.type].check((spec.props ?? {}) as Record<string, unknown>);
  return p ? `props: ${p}` : undefined;
}

/** Everything in a hand-edited storyboard that compose would skip, each line starting with the beat id. */
export function validateStoryboard(sb: Storyboard, wordCount: number, durationSec: number): string[] {
  const out: string[] = [];
  for (const b of sb.beats) {
    const say = (m: string) => out.push(`${b.id}: ${m}`);
    const inRange = Number.isInteger(b.firstWord) && Number.isInteger(b.lastWord) && b.firstWord >= 0 && b.lastWord < wordCount && b.firstWord <= b.lastWord;
    if (!inRange) say(`từ ${b.firstWord}–${b.lastWord} nằm ngoài lời (có ${wordCount} từ)`);
    const { hl, bigRange } = b.treatment.caption;
    if (inRange) {
      for (const i of hl ?? []) if (!(Number.isInteger(i) && i >= b.firstWord && i <= b.lastWord)) say(`hl ${i} nằm ngoài nhịp`);
      if (bigRange) {
        const [a, z] = bigRange;
        if (!(Number.isInteger(a) && Number.isInteger(z) && a >= b.firstWord && z <= b.lastWord && a <= z)) say(`bigRange [${a}, ${z}] nằm ngoài nhịp`);
        else if (z - a + 1 > MAX_BIG_WORDS) say(`bigRange dài ${z - a + 1} từ, tối đa ${MAX_BIG_WORDS}`);
      }
    }
    for (const ins of b.treatment.inserts) { const p = insertProblem(ins, durationSec); if (p) say(`insert ${ins?.type}: ${p}`); }
    for (const cam of b.treatment.camera) { const p = cameraProblem(cam, durationSec); if (p) say(`camera ${cam?.type}: ${p}`); }
  }
  return out;
}
