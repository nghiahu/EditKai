import { footageProblem } from './insertProps';
import { customProblem } from './custom';
import { sceneProblem } from './scene';
import { calloutProblem, chartProblem, counterProblem, logoBadgeProblem, promptBoxProblem, quoteCardProblem, statCardProblem, stepNumberProblem } from './insertTypes';
import type { Track } from './types';

/** Kinds of the transition layer: zoom, blur, slide, push, whip, dip act on the base video; flash draws a white pulse. */
export const TRANSITION_KINDS = ['zoom', 'blur', 'slide', 'push', 'flash', 'whip', 'dip'];

export interface LayerTypeSpec { track: Track; check: (props: Record<string, unknown>) => string | undefined }

const inUnit = (v: unknown) => typeof v === 'number' && v >= 0 && v <= 1;
const str = (v: unknown) => typeof v === 'string' && v.length > 0;

/** Layer types a plan may use (caption layers have no type). Must match remotion/registry.ts. */
export const LAYER_TYPES: Record<string, LayerTypeSpec> = {
  'title-card': { track: 'title', check: p => (str(p.title) ? undefined : 'thiếu props.title') },
  'chip-stack': {
    track: 'graphic',
    check: p => (Array.isArray(p.chips) && p.chips.length > 0 && p.chips.every((c: any) => c && str(c.label)) ? undefined : 'cần props.chips (mảng, mỗi chip có label)'),
  },
  'explainer-scene': {
    track: 'graphic',
    check: p => {
      if (!str(p.title)) return 'thiếu props.title';
      if (p.mode !== undefined && p.mode !== 'full' && p.mode !== 'overlay') return 'props.mode phải là full hoặc overlay';
      const body = p.body as { kind?: unknown; items?: unknown } | null | undefined;
      if (body === undefined) return undefined;
      if (body === null || typeof body !== 'object' || Array.isArray(body)) return 'props.body phải là một đối tượng { kind, items }';
      if (!['list', 'card', 'waveform', 'progress', 'phone'].includes(body.kind as string)) return 'props.body.kind phải là list, card, waveform, progress hoặc phone';
      if (body.items !== undefined && !Array.isArray(body.items)) return 'props.body.items phải là một mảng';
      if (body.kind === 'progress' && !(Array.isArray(body.items) && body.items.every((i: any) => i && str(i.label) && typeof i.value === 'number')))
        return 'body progress cần items dạng [{ label, value }]';
      return undefined;
    },
  },
  'zoom-punch': {
    track: 'camera',
    check: p => {
      if (p.scale !== undefined && !(typeof p.scale === 'number' && p.scale > 1 && p.scale <= 1.5)) return 'props.scale phải là số trong khoảng (1, 1.5]';
      const f = p.focus as { x?: unknown; y?: unknown } | undefined;
      if (f !== undefined && !(f && inUnit(f.x) && inUnit(f.y))) return 'props.focus cần x và y trong khoảng 0–1';
      return undefined;
    },
  },
  shake: {
    track: 'camera',
    check: p => (p.intensity === undefined || (typeof p.intensity === 'number' && p.intensity >= 1 && p.intensity <= 3) ? undefined : 'props.intensity phải trong khoảng 1–3'),
  },
  'logo-badge': { track: 'graphic', check: p => logoBadgeProblem(p) },
  'prompt-box': { track: 'graphic', check: p => promptBoxProblem(p) },
  'stat-card': { track: 'graphic', check: p => statCardProblem(p) },
  'quote-card': { track: 'graphic', check: p => quoteCardProblem(p) },
  counter: { track: 'graphic', check: p => counterProblem(p) },
  callout: { track: 'graphic', check: p => calloutProblem(p) },
  'step-number': { track: 'graphic', check: p => stepNumberProblem(p) },
  chart: { track: 'graphic', check: p => chartProblem(p) },
  scene: { track: 'graphic', check: p => sceneProblem(p) },
  custom: { track: 'graphic', check: p => customProblem(p) }, // a component the AI wrote for this project (projects/<tên>/components/<component>.tsx)
  freeze: { track: 'camera', check: () => undefined }, // holds the picture still (the sound goes on); no props
  footage: { track: 'footage', check: p => footageProblem(p) }, // props.src is reported by the missing-file rule
  transition: { track: 'graphic', check: p => (TRANSITION_KINDS.includes(p.kind as string) ? undefined : 'props.kind phải là zoom, blur, slide, push, flash, whip hoặc dip') },
};
