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

/**
 * Why an insert entry cannot become a layer (unknown type, a camera type, bad time, props its layer type rejects,
 * a footage whose `src` is missing or — when `fileExists` is given — not on disk), or undefined when it can.
 */
export function insertProblem(spec: InsertSpec, durationSec: number, fileExists?: (path: string) => boolean): string | undefined {
  const lt = LAYER_TYPES[spec?.type];
  if (!lt) return `type "${spec?.type}" không có`;
  if (lt.track === 'camera') return `type "${spec.type}" là camera, đặt trong camera[] chứ không phải inserts[]`;
  const t = timeProblem(spec.at, spec.duration, durationSec);
  if (t) return t;
  const props = (spec.props ?? {}) as Record<string, unknown>;
  const p = lt.check(props);
  if (p) return `props: ${p}`;
  if (spec.type === 'footage') {
    if (typeof props.src !== 'string' || props.src.length === 0) return 'footage thiếu props.src';
    if (fileExists && !fileExists(props.src)) return `không tìm thấy footage ${props.src}`;
  }
  return undefined;
}

const isObject = (v: unknown): v is Record<string, unknown> => v !== null && typeof v === 'object' && !Array.isArray(v);
const VARIANTS = ['phrase', 'label', 'big'];

/**
 * A hand-edited storyboard of any shape → one the other functions can read without throwing. Missing or wrongly typed
 * pieces get safe defaults, entries that cannot be repaired are dropped (a beat without integer word indexes entirely),
 * and every repair is an issue line starting with the beat id.
 */
export function normalizeStoryboard(raw: unknown): { sb: Storyboard; issues: string[] } {
  const issues: string[] = [];
  const style = isObject(raw) && typeof raw.style === 'string' ? raw.style : '';
  if (!isObject(raw) || !Array.isArray(raw.beats)) {
    issues.push(`${FILE}: thiếu mảng beats, không có nhịp nào để dựng`);
    return { sb: { version: 1, style, beats: [] }, issues };
  }
  const beats: Storyboard['beats'] = [];
  raw.beats.forEach((rb, n) => {
    if (!isObject(rb)) { issues.push(`nhịp thứ ${n + 1}: không phải đối tượng, bỏ qua`); return; }
    const id = typeof rb.id === 'string' && rb.id ? rb.id : `#${n + 1}`;
    const say = (m: string) => issues.push(`${id}: ${m}`);
    if (!Number.isInteger(rb.firstWord) || !Number.isInteger(rb.lastWord)) { say(`firstWord/lastWord phải là số nguyên (đang là ${JSON.stringify(rb.firstWord)}, ${JSON.stringify(rb.lastWord)}), bỏ qua nhịp`); return; }
    let t: Record<string, unknown> = {};
    if (isObject(rb.treatment)) t = rb.treatment;
    else say('thiếu treatment, dùng mặc định');
    let c: Record<string, unknown> = {};
    if (isObject(t.caption)) c = t.caption;
    else say('thiếu caption, dùng phrase mặc định');
    let hl: unknown[] = [];
    if (Array.isArray(c.hl)) hl = c.hl;
    else if (c.hl !== undefined) say('hl phải là mảng, bỏ qua');
    let br: [number, number] | null = null;
    if (Array.isArray(c.bigRange) && c.bigRange.length === 2) br = c.bigRange as [number, number];
    else if (c.bigRange != null) say('bigRange phải là [từ đầu, từ cuối], bỏ qua');
    const list = (key: 'inserts' | 'camera'): Record<string, unknown>[] => {
      const v = t[key];
      if (!Array.isArray(v)) { if (v !== undefined) say(`${key} phải là mảng, dùng mảng rỗng`); return []; }
      return v.filter(e => isObject(e) || (say(`${key} có mục không phải đối tượng, bỏ qua`), false));
    };
    beats.push({
      ...(rb as object),
      id,
      start: typeof rb.start === 'number' ? rb.start : 0,
      end: typeof rb.end === 'number' ? rb.end : 0,
      firstWord: rb.firstWord as number,
      lastWord: rb.lastWord as number,
      text: typeof rb.text === 'string' ? rb.text : '',
      cues: Array.isArray(rb.cues) ? rb.cues.filter(isObject) : [],
      reviewed: rb.reviewed === true,
      treatment: {
        ...t,
        caption: { ...c, variant: VARIANTS.includes(c.variant as string) ? c.variant : 'phrase', hl, bigRange: br },
        inserts: list('inserts'),
        camera: list('camera'),
      },
    } as unknown as Storyboard['beats'][number]);
  });
  return { sb: { ...(raw as object), version: 1, style, beats } as Storyboard, issues };
}

export function cameraProblem(spec: CameraSpec, durationSec: number): string | undefined {
  if (!CAMERA_TYPES.includes(spec?.type)) return `camera type "${spec?.type}" không có`;
  const t = timeProblem(spec.at, spec.duration, durationSec);
  if (t) return t;
  const p = LAYER_TYPES[spec.type].check((spec.props ?? {}) as Record<string, unknown>);
  return p ? `props: ${p}` : undefined;
}

/** Everything in a hand-edited storyboard that compose would skip, each line starting with the beat id. */
export function validateStoryboard(sb: Storyboard, wordCount: number, durationSec: number, fileExists?: (path: string) => boolean): string[] {
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
    for (const ins of b.treatment.inserts) { const p = insertProblem(ins, durationSec, fileExists); if (p) say(`insert ${ins?.type}: ${p}`); }
    for (const cam of b.treatment.camera) { const p = cameraProblem(cam, durationSec); if (p) say(`camera ${cam?.type}: ${p}`); }
  }
  return out;
}
