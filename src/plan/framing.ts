// Browser-safe (no node imports): how the base video sits in the frame; the renderer, the validator and `init` all read it through here.
export const FIT_MODES = ['cover', 'contain'] as const;
export type FitMode = (typeof FIT_MODES)[number];

export interface Framing {
  fit: FitMode; // cover: fill the frame, cropping the overflow; contain: the whole picture, centred, with bars
  focus: { x: number; y: number }; // which point of the picture stays in view when it is cropped (0-1, 0.5 = the middle)
}

const unit = (v: unknown): v is number => typeof v === 'number' && Number.isFinite(v) && v >= 0 && v <= 1;
const validFocus = (v: unknown): v is { x: number; y: number } => typeof v === 'object' && v !== null && unit((v as { x?: unknown }).x) && unit((v as { y?: unknown }).y);

/** Reads `meta.fit` and `meta.focus` with safe defaults (cover, the middle); never throws. */
export function resolveFraming(meta: { fit?: unknown; focus?: unknown } | undefined): Framing {
  const fit = (FIT_MODES as readonly unknown[]).includes(meta?.fit) ? (meta!.fit as FitMode) : 'cover';
  const focus = validFocus(meta?.focus) ? { x: meta!.focus.x, y: meta!.focus.y } : { x: 0.5, y: 0.5 };
  return { fit, focus };
}

/** Why `meta.fit` or `meta.focus` is invalid (Vietnamese message for the validator), or undefined. */
export function framingProblem(meta: { fit?: unknown; focus?: unknown }): string | undefined {
  if (meta.fit !== undefined && !(FIT_MODES as readonly unknown[]).includes(meta.fit)) return `meta.fit phải là một trong: ${FIT_MODES.join(', ')}`;
  if (meta.focus !== undefined && !validFocus(meta.focus)) return 'meta.focus cần x và y trong khoảng 0–1';
  return undefined;
}

/** CSS for the picture element: cover crops around the focus point; contain keeps it whole and centred. */
export function framingStyle(f: Framing): { objectFit: 'cover' | 'contain'; objectPosition: string } {
  return f.fit === 'cover'
    ? { objectFit: 'cover', objectPosition: `${Math.round(f.focus.x * 100)}% ${Math.round(f.focus.y * 100)}%` }
    : { objectFit: 'contain', objectPosition: '50% 50%' };
}

const SIMILAR = 0.05; // aspect ratios closer than this (relative) count as the same shape

const SHAPES: [number, string][] = [[16 / 9, '16:9'], [9 / 16, '9:16'], [1, '1:1'], [4 / 3, '4:3'], [3 / 4, '3:4'], [4 / 5, '4:5']];
const shapeName = (w: number, h: number): string => {
  const r = w / h;
  return SHAPES.find(([s]) => Math.abs(s - r) / s < SIMILAR)?.[1] ?? `${w}x${h}`;
};

/** A note for `init` when the source is not the shape of the frame: what will happen and how to change it. Undefined when the shapes match. */
export function aspectNote(srcW: number, srcH: number, frameW: number, frameH: number): string | undefined {
  if (Math.abs(srcW / srcH - frameW / frameH) / (frameW / frameH) < SIMILAR) return undefined;
  return `Nguồn ${shapeName(srcW, srcH)} nhưng khung ${shapeName(frameW, frameH)}: video sẽ được cắt cho đầy khung (fit cover, giữa khung). Xem lại bằng preview rồi đổi vị trí giữ lại bằng meta.focus, hoặc giữ nguyên cả hình (có khoảng đen) bằng meta.fit contain.`;
}
