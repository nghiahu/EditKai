// Browser-safe (no node imports): the counter insert and its tests share these two functions.

/** The number shown at `progress` (0-1, clamped) of a count from `from` to `to`, rounded to `decimals` so it never shows more digits than asked. */
export function counterValue(progress: number, from: number, to: number, decimals: number): number {
  const p = Math.min(1, Math.max(0, progress));
  const factor = 10 ** decimals;
  return Math.round((from + (to - from) * p) * factor) / factor;
}

/** Vietnamese number format: dot between thousands, comma before the decimals, always `decimals` digits after it. */
export function formatCount(value: number, decimals: number): string {
  return new Intl.NumberFormat('vi-VN', { minimumFractionDigits: decimals, maximumFractionDigits: decimals, useGrouping: true }).format(value);
}
