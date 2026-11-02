const clamp01 = (x: number) => Math.min(1, Math.max(0, Number.isFinite(x) ? x : 0));

/** Cubic ease-in-out on [0,1]; input outside the range is clamped. */
export function easeInOut(x: number): number {
  const t = clamp01(x);
  return t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2;
}

/** Cubic ease-out on [0,1]. */
export function easeOut(x: number): number {
  return 1 - Math.pow(1 - clamp01(x), 3);
}

export { clamp01 };
