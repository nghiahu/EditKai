// Browser-safe (no node imports): the animation of a scene's nodes, as pure functions.
import type { Anchor, Ease, Enter, Highlight, Keyframe, Keys, SceneNode } from './scene';

export type Rgba = [number, number, number, number];
export type Palette = Record<string, string>;

const clamp01 = (v: number) => Math.min(1, Math.max(0, v));

/** 0 → 1 for progress 0 → 1. `spring` swings a little past 1 on the way (at most about 10%). */
export function easeValue(p: number, ease: Ease): number {
  const x = clamp01(p);
  if (x === 0 || x === 1) return x;
  switch (ease) {
    case 'linear': return x;
    case 'out': return 1 - (1 - x) ** 3;
    case 'inOut': return x < 0.5 ? 4 * x ** 3 : 1 - ((-2 * x + 2) ** 3) / 2;
    case 'spring': return 1 - Math.exp(-7 * x) * Math.cos(9 * x);
  }
}

/** `#rrggbb`, `rgba(r,g,b,a)` or a token of the palette, as [r, g, b, a]; a colour that cannot be read is transparent. */
export function parseColor(color: string, palette: Palette): Rgba {
  const c = palette[color] ?? color;
  const hex = /^#([0-9a-fA-F]{6})$/.exec(c);
  if (hex) return [parseInt(hex[1].slice(0, 2), 16), parseInt(hex[1].slice(2, 4), 16), parseInt(hex[1].slice(4, 6), 16), 1];
  const rgba = /^rgba?\(\s*(\d+)\s*,\s*(\d+)\s*,\s*(\d+)\s*(?:,\s*([\d.]+)\s*)?\)$/.exec(c);
  if (rgba) return [Number(rgba[1]), Number(rgba[2]), Number(rgba[3]), rgba[4] === undefined ? 1 : Number(rgba[4])];
  return [0, 0, 0, 0];
}

export function mixColor(a: Rgba, b: Rgba, t: number): Rgba {
  return [0, 1, 2, 3].map(i => a[i] + (b[i] - a[i]) * t) as Rgba;
}

const rgbaString = (c: Rgba) => `rgba(${Math.round(c[0])},${Math.round(c[1])},${Math.round(c[2])},${Math.round(c[3] * 1000) / 1000})`;

const seconds = (a: Anchor | undefined): number => (typeof a === 'number' ? a : 0); // a word anchor is resolved by compose before this

/** The value of an animated property at `t` seconds: the first value before the first keyframe, the last after the last, and between two the later keyframe's ease. Colours come back as rgba(). */
export function valueAt(keys: Keyframe[], t: number, palette: Palette): number | string | undefined {
  if (keys.length === 0) return undefined;
  const at = (k: Keyframe) => seconds(k.at);
  const isColor = typeof keys[0].v === 'string';
  const out = (k: Keyframe) => (isColor ? rgbaString(parseColor(String(k.v), palette)) : (k.v as number));
  if (t <= at(keys[0])) return out(keys[0]);
  for (let i = 1; i < keys.length; i++) {
    if (t <= at(keys[i])) {
      const a = keys[i - 1];
      const b = keys[i];
      const span = at(b) - at(a);
      const e = easeValue(span <= 0 ? 1 : (t - at(a)) / span, b.ease ?? 'out');
      if (isColor) return rgbaString(mixColor(parseColor(String(a.v), palette), parseColor(String(b.v), palette), e));
      return (a.v as number) + ((b.v as number) - (a.v as number)) * e;
    }
  }
  return out(keys[keys.length - 1]);
}

export interface ExpandContext { durationSec: number; fps: number; staggerFrames: number; exitFrames: number }

const ENTER_SEC: Record<Enter['kind'], number> = { fade: 0.3, rise: 0.4, pop: 0.35, 'slide-left': 0.4, 'slide-right': 0.4, draw: 0.5 };
const RAMP_SEC = 0.12; // how fast a highlight comes and goes

function enterKeys(e: Enter, delaySec: number): Keys {
  const t0 = seconds(e.at) + delaySec;
  const t1 = t0 + (e.duration ?? ENTER_SEC[e.kind]);
  const fade: Keyframe[] = [{ at: t0, v: 0 }, { at: t1, v: 1 }];
  switch (e.kind) {
    case 'fade': return { opacity: fade };
    case 'rise': return { opacity: fade, y: [{ at: t0, v: 40 }, { at: t1, v: 0 }] };
    case 'pop': return { opacity: [{ at: t0, v: 0 }, { at: t0 + (t1 - t0) * 0.4, v: 1 }], scale: [{ at: t0, v: 0.7 }, { at: t1, v: 1, ease: 'spring' }] };
    case 'slide-left': return { opacity: fade, x: [{ at: t0, v: -80 }, { at: t1, v: 0 }] };
    case 'slide-right': return { opacity: fade, x: [{ at: t0, v: 80 }, { at: t1, v: 0 }] };
    case 'draw': return { progress: [{ at: t0, v: 0 }, { at: t1, v: 1, ease: 'inOut' }] };
  }
}

const NUMBER_BASE: Record<string, number> = { opacity: 1, scale: 1, x: 0, y: 0, rotate: 0, strokeWidth: 0, progress: 1 };

function highlightKeys(h: Highlight, node: SceneNode): Keys {
  const a = seconds(h.at);
  const b = seconds(h.until);
  const out: Keys = {};
  for (const [prop, to] of Object.entries(h.to)) {
    const own = (node as unknown as Record<string, unknown>)[prop];
    const base = typeof to === 'string' ? (typeof own === 'string' ? own : 'rgba(0,0,0,0)') : typeof own === 'number' ? own : NUMBER_BASE[prop] ?? 0;
    (out as Record<string, Keyframe[]>)[prop] = [{ at: a - RAMP_SEC, v: base }, { at: a, v: to }, { at: b, v: to }, { at: b + RAMP_SEC, v: base }];
  }
  return out;
}

function mergeInto(target: Keys, extra: Keys): void {
  for (const [prop, list] of Object.entries(extra) as [keyof Keys, Keyframe[]][]) {
    const merged = [...(target[prop] ?? []), ...list];
    target[prop] = merged.map((k, i) => ({ k, i })).sort((x, y) => seconds(x.k.at) - seconds(y.k.at) || x.i - y.i).map(x => x.k);
  }
}

/**
 * The scene with every preset (`enter`, `exit`, `highlight`, `stagger`) turned into plain keyframes in each node's `keys`; explicit `keys` for a
 * property replace the presets for it. With `stagger` on a container, its `enter` goes to the children (the container itself stays still), the
 * i-th one `stagger` frames later than the one before; a child with an `enter` of its own keeps it. Times in `at` must already be seconds.
 */
export function expandScene(root: SceneNode, ctx: ExpandContext): SceneNode {
  const exitSec = ctx.exitFrames / ctx.fps;
  const walk = (node: SceneNode, inherited?: { enter: Enter; delay: number }): SceneNode => {
    const keys: Keys = {};
    const enter = node.enter ?? inherited?.enter;
    const delay = node.enter ? 0 : inherited?.delay ?? 0;
    const staggersChildren = node.stagger !== undefined && node.stagger > 0 && node.enter !== undefined;
    if (enter && !staggersChildren) mergeInto(keys, enterKeys(enter, delay));
    if (node.highlight) for (const h of Array.isArray(node.highlight) ? node.highlight : [node.highlight]) mergeInto(keys, highlightKeys(h, node));
    if (node.exit) {
      const t0 = typeof node.exit === 'object' && node.exit.at !== undefined ? seconds(node.exit.at) : ctx.durationSec - exitSec;
      mergeInto(keys, { opacity: [{ at: t0, v: 1 }, { at: t0 + exitSec, v: 0 }] });
    }
    for (const [prop, list] of Object.entries(node.keys ?? {}) as [keyof Keys, Keyframe[]][]) keys[prop] = list;
    const step = (node.stagger ?? 0) / ctx.fps;
    const children = node.children?.map((c, i) => walk(c, staggersChildren ? { enter: node.enter!, delay: i * step } : undefined));
    const rest: Record<string, unknown> = { ...node };
    for (const k of ['highlight', 'enter', 'exit', 'stagger', 'keys', 'children']) delete rest[k];
    return { ...(rest as unknown as SceneNode), ...(children ? { children } : {}), ...(Object.keys(keys).length ? { keys } : {}) };
  };
  return walk(root);
}
