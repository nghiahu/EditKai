import { existsSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import { LAYER_TYPES, TRANSITION_KINDS } from '../plan/layerTypes';

/** One way to show a situation: an insert (`type`) with props from a template, or one of the built-in builders that need the cue's list items. */
export interface Recipe {
  id: string;
  type: string; // a key of LAYER_TYPES
  duration: number;
  props?: Record<string, unknown>; // template: {text}, {TEXT}, {label}, {icon}
  builder?: 'template' | 'chips' | 'explainer-list' | 'counter';
}

export interface Variety {
  rotate: boolean; // inside one situation the recipe used longest ago goes next
  maxShare: Record<string, number>; // largest share of all inserts one insert type may have (0-1)
  sameTypeGapSec: number; // two inserts of the same type start at least this long after the previous one ends
}

export interface Playbook {
  situations: Record<string, Recipe[]>; // tool, number, section, cta, list
  variety: Variety;
  transitions: string[]; // kinds of the transition put on every join of a condensed video, in turn (empty: none)
}

const r = (id: string, type: string, duration: number, props?: Record<string, unknown>, builder?: Recipe['builder']): Recipe => ({ id, type, duration, ...(props ? { props } : {}), ...(builder ? { builder } : {}) });

/** Used by a style without playbook.json, and for the situations and fields a style's file leaves out. */
export const DEFAULT_PLAYBOOK: Playbook = {
  situations: {
    tool: [r('tool-badge', 'logo-badge', 2, { label: '{text}', icon: 'sparkles' }), r('tool-title', 'title-card', 2.4, { icon: 'sparkles', title: '{TEXT}', sub: '{label}' })],
    number: [r('number-stat', 'stat-card', 3.5, { rows: [{ value: '{text}', icon: '{icon}' }] }), r('number-title', 'title-card', 2.6, { icon: 'zap', title: '{TEXT}' }), r('number-counter', 'counter', 3.5, undefined, 'counter')],
    section: [r('section-title', 'title-card', 2.6, { icon: 'layers', title: '{TEXT}' }), r('section-badge', 'logo-badge', 2, { label: '{text}', icon: 'layers' })],
    cta: [r('cta-title', 'title-card', 2.6, { icon: 'rocket', title: '{TEXT}' }), r('cta-badge', 'logo-badge', 2, { label: '{text}', icon: 'rocket' })],
    // a stretch with no insert at all gets one of these (see suggest.ts): the text is built from the beat's own words
    filler: [r('filler-title', 'title-card', 2.4, { icon: 'lightbulb', title: '{TEXT}' }), r('filler-badge', 'logo-badge', 2, { label: '{text}', icon: 'sparkles' })],
    list: [r('list-chips', 'chip-stack', 4, undefined, 'chips'), r('list-explainer', 'explainer-scene', 5, undefined, 'explainer-list')],
  },
  variety: { rotate: true, maxShare: { 'title-card': 0.7 }, sameTypeGapSec: 5 },
  // flash (a full white frame) is left out of the rotation: too harsh to repeat
  transitions: ['zoom', 'whip', 'blur', 'dip', 'push', 'slide'],
};

const fail = (m: string): never => { throw new Error(`playbook.json: ${m}`); };

/** The playbook of a style: `<styleDir>/playbook.json` laid over the default (a situation in the file replaces that situation; variety fields are merged one by one). */
export function loadPlaybook(styleDir: string): Playbook {
  const file = join(styleDir, 'playbook.json');
  if (!existsSync(file)) return DEFAULT_PLAYBOOK;
  let raw: { situations?: Record<string, Recipe[]>; variety?: Partial<Variety>; transitions?: unknown };
  try { raw = JSON.parse(readFileSync(file, 'utf8')) ?? {}; } catch (e) { throw new Error(`playbook.json không phải JSON hợp lệ: ${(e as Error).message}`); }
  const pb: Playbook = {
    situations: { ...DEFAULT_PLAYBOOK.situations, ...(raw.situations ?? {}) },
    variety: { ...DEFAULT_PLAYBOOK.variety, ...(raw.variety ?? {}), maxShare: { ...DEFAULT_PLAYBOOK.variety.maxShare, ...(raw.variety?.maxShare ?? {}) } },
    transitions: DEFAULT_PLAYBOOK.transitions,
  };
  if (raw.transitions !== undefined) {
    if (!Array.isArray(raw.transitions)) fail('transitions phải là một mảng các kiểu chuyển cảnh');
    for (const k of raw.transitions as unknown[]) if (typeof k !== 'string' || !TRANSITION_KINDS.includes(k)) fail(`kiểu chuyển cảnh "${String(k)}" không có; chọn trong: ${TRANSITION_KINDS.join(', ')}`);
    pb.transitions = raw.transitions as string[];
  }
  const seen = new Set<string>();
  for (const [situation, recipes] of Object.entries(pb.situations)) {
    if (!Array.isArray(recipes)) fail(`tình huống "${situation}" phải là một mảng công thức`);
    for (const rec of recipes) {
      if (typeof rec?.id !== 'string' || !rec.id) fail(`một công thức của "${situation}" thiếu id`);
      if (seen.has(rec.id)) fail(`id công thức "${rec.id}" bị trùng`);
      seen.add(rec.id);
      if (!LAYER_TYPES[rec.type]) fail(`công thức "${rec.id}": type "${rec.type}" không có`);
      if (!(typeof rec.duration === 'number' && rec.duration > 0)) fail(`công thức "${rec.id}": duration phải lớn hơn 0`);
    }
  }
  return pb;
}

/** Template → props: {text}, {label}, {TEXT} (upper case) in strings at any depth; a prop that is exactly {icon} (or {label}) is dropped when there is no icon (or label). */
export function fillProps(template: Record<string, unknown>, vars: { text: string; label?: string; icon?: string }): Record<string, unknown> {
  const fill = (v: unknown): unknown => {
    if (typeof v === 'string') return v.replace(/\{TEXT\}/g, vars.text.toUpperCase()).replace(/\{text\}/g, vars.text).replace(/\{label\}/g, vars.label ?? '').replace(/\{icon\}/g, vars.icon ?? '');
    if (Array.isArray(v)) return v.map(fill);
    if (v && typeof v === 'object') {
      const out: Record<string, unknown> = {};
      for (const [k, x] of Object.entries(v)) { if ((x === '{icon}' && !vars.icon) || (x === '{label}' && !vars.label)) continue; out[k] = fill(x); }
      return out;
    }
    return v;
  };
  return fill(template) as Record<string, unknown>;
}
