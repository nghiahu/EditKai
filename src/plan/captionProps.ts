// Browser-safe (no node imports): Remotion components and the validator both use this.
export const CAPTION_VARIANTS = ['phrase', 'word', 'big', 'label'] as const;
export const CAPTION_POSITIONS = ['top', 'center', 'bottom'] as const;
export const CAPTION_EMPHASES = ['box', 'ink', 'underline'] as const;

export type CaptionVariant = (typeof CAPTION_VARIANTS)[number];
export type CaptionPosition = (typeof CAPTION_POSITIONS)[number];
export type CaptionEmphasis = (typeof CAPTION_EMPHASES)[number];

export interface ResolvedCaption {
  variant: CaptionVariant;
  position: CaptionPosition;
  emphasis: CaptionEmphasis;
  label?: string;
  handles: boolean;
}

const pick = <T extends string>(value: unknown, allowed: readonly T[], fallback: T): T =>
  typeof value === 'string' && (allowed as readonly string[]).includes(value) ? (value as T) : fallback;

/** Reads a caption layer's props with safe defaults: a value outside its set (wrong case, wrong type) falls back instead of throwing. */
export function resolveCaptionProps(props: Record<string, unknown> | undefined, theme: { captionEmphasis: CaptionEmphasis }): ResolvedCaption {
  const p = props ?? {};
  const variant = pick(p.variant, CAPTION_VARIANTS, 'phrase');
  const position = pick(p.position, CAPTION_POSITIONS, variant === 'big' ? 'center' : 'bottom');
  const emphasis = pick(p.emphasis, CAPTION_EMPHASES, theme.captionEmphasis);
  const label = typeof p.label === 'string' && p.label.length > 0 ? p.label : undefined;
  return { variant, position, emphasis, ...(label ? { label } : {}), handles: p.handles === true && variant === 'big' };
}

/** Maximal runs of equal `hl` as inclusive word indexes, so adjacent highlighted words form one run. */
export function groupRuns(words: { hl: boolean }[]): { start: number; end: number; hl: boolean }[] {
  const runs: { start: number; end: number; hl: boolean }[] = [];
  words.forEach((w, i) => {
    const last = runs[runs.length - 1];
    if (last && last.hl === w.hl) last.end = i;
    else runs.push({ start: i, end: i, hl: w.hl });
  });
  return runs;
}
