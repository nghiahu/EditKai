// Browser-safe (no node imports): Remotion components and the validator both read insert props through this module.
export const INSERT_POSITIONS = ['top', 'center', 'bottom'] as const;
export const FOOTAGE_FRAMES = ['none', 'window', 'phone'] as const;
export const FOOTAGE_MOTIONS = ['none', 'zoom-in', 'zoom-out', 'pan-left', 'pan-right'] as const;

export type InsertPosition = (typeof INSERT_POSITIONS)[number];
export type FootageFrame = (typeof FOOTAGE_FRAMES)[number];
export type FootageMotion = (typeof FOOTAGE_MOTIONS)[number];

export interface ResolvedFootage {
  src: string;
  fit: 'cover' | 'contain';
  frame: FootageFrame;
  motion: FootageMotion;
  focus: { x: number; y: number };
  from: number;
  title?: string;
  sound: boolean;
  dim: boolean;
}

const inSet = (v: unknown, allowed: readonly string[]): boolean => typeof v === 'string' && allowed.includes(v);
const unit = (v: unknown): v is number => typeof v === 'number' && Number.isFinite(v) && v >= 0 && v <= 1;
const validFocus = (v: unknown): v is { x: number; y: number } =>
  typeof v === 'object' && v !== null && unit((v as { x?: unknown }).x) && unit((v as { y?: unknown }).y);

/** Reads footage props with safe defaults: a value outside its set (wrong case, wrong type, out of range) falls back instead of throwing. */
export function resolveFootageProps(props: Record<string, unknown> | undefined): ResolvedFootage {
  const p = props ?? {};
  const fit = p.fit === 'contain' ? 'contain' : 'cover';
  const frame = (inSet(p.frame, FOOTAGE_FRAMES) ? p.frame : 'none') as FootageFrame;
  const motion = (inSet(p.motion, FOOTAGE_MOTIONS) ? p.motion : 'none') as FootageMotion;
  const focus = validFocus(p.focus) ? { x: p.focus.x, y: p.focus.y } : { x: 0.5, y: 0.5 };
  const from = typeof p.from === 'number' && Number.isFinite(p.from) && p.from >= 0 ? p.from : 0;
  const title = frame === 'window' && typeof p.title === 'string' && p.title.length > 0 ? p.title : undefined;
  return {
    src: typeof p.src === 'string' ? p.src : '',
    fit, frame, motion, focus, from,
    ...(title ? { title } : {}),
    sound: p.sound === true,
    dim: typeof p.dim === 'boolean' ? p.dim : frame !== 'none' || fit === 'contain',
  };
}

/** Footage is muted (its sound would play over the speaker) unless `sound` is exactly true. */
export const footageMuted = (props: Record<string, unknown> | undefined): boolean => props?.sound !== true;

/** Why footage props are invalid (Vietnamese message for the validator), or undefined when they are fine. */
export function footageProblem(props: Record<string, unknown> | undefined): string | undefined {
  if (!props) return undefined;
  if (props.fit !== undefined && !inSet(props.fit, ['cover', 'contain'])) return 'props.fit phải là cover hoặc contain';
  if (props.frame !== undefined && !inSet(props.frame, FOOTAGE_FRAMES)) return `props.frame phải là một trong: ${FOOTAGE_FRAMES.join(', ')}`;
  if (props.motion !== undefined && !inSet(props.motion, FOOTAGE_MOTIONS)) return `props.motion phải là một trong: ${FOOTAGE_MOTIONS.join(', ')}`;
  if (props.focus !== undefined && !validFocus(props.focus)) return 'props.focus cần x và y trong khoảng 0–1';
  if (props.from !== undefined && !(typeof props.from === 'number' && Number.isFinite(props.from) && props.from >= 0)) return 'props.from phải là số giây ≥ 0';
  if (props.title !== undefined) {
    if (typeof props.title !== 'string') return 'props.title phải là chuỗi';
    if (props.frame !== 'window') return 'props.title chỉ dùng với frame window';
  }
  if (props.sound !== undefined && typeof props.sound !== 'boolean') return 'props.sound phải là true hoặc false';
  if (props.dim !== undefined && typeof props.dim !== 'boolean') return 'props.dim phải là true hoặc false';
  return undefined;
}

/**
 * Whether a layer darkens and blurs the speaker while it is on screen. Defaults: footage cards (frame window/phone or fit contain),
 * stat-card and overlay explainers dim; full-bleed footage, logo-badge and prompt-box do not. A boolean `props.dim` always wins.
 */
export function insertDims(layer: { type?: string; props?: Record<string, unknown> }): boolean {
  const p = layer.props ?? {};
  const explicit = typeof p.dim === 'boolean' ? p.dim : undefined;
  switch (layer.type) {
    case 'footage': return resolveFootageProps(p).dim;
    case 'explainer-scene': return explicit ?? p.mode === 'overlay';
    case 'stat-card': return explicit ?? true;
    case 'logo-badge':
    case 'prompt-box': return explicit ?? false;
    default: return false;
  }
}
