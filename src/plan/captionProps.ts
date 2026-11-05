// Browser-safe (no node imports): Remotion components and the validator both use this.
export const CAPTION_VARIANTS = ['phrase', 'word', 'big', 'label'] as const;
export const CAPTION_POSITIONS = ['top', 'center', 'bottom'] as const;
export const CAPTION_EMPHASES = ['box', 'ink', 'underline'] as const;

export const CAPTION_BACKDROPS = ['none', 'plate'] as const;
/** The colour of the text: `white` (default) or `accent`, the style's own yellow (m1) or teal (s1), always with the dark outline. */
export const CAPTION_INKS = ['white', 'accent'] as const;

export type CaptionVariant = (typeof CAPTION_VARIANTS)[number];
export type CaptionPosition = (typeof CAPTION_POSITIONS)[number];
export type CaptionEmphasis = (typeof CAPTION_EMPHASES)[number];

export type CaptionBackdrop = (typeof CAPTION_BACKDROPS)[number];

export interface ResolvedCaption {
  variant: CaptionVariant;
  position: CaptionPosition;
  emphasis: CaptionEmphasis;
  label?: string;
  handles: boolean;
  backdrop: CaptionBackdrop;
  ink?: 'accent'; // absent: white
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
  return { variant, position, emphasis, ...(label ? { label } : {}), handles: p.handles === true && variant === 'big', backdrop: pick(p.backdrop, CAPTION_BACKDROPS, 'none'), ...(p.ink === 'accent' ? { ink: 'accent' as const } : {}) };
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

const inSet = (v: unknown, allowed: readonly string[]) => typeof v === 'string' && allowed.includes(v);

/** Why a caption layer's props are invalid (Vietnamese message for the validator), or undefined when they are fine. */
export function captionPropsProblem(props: Record<string, unknown> | undefined): string | undefined {
  if (!props) return undefined;
  if (props.variant !== undefined && !inSet(props.variant, CAPTION_VARIANTS)) return `props.variant phải là một trong: ${CAPTION_VARIANTS.join(', ')}`;
  if (props.position !== undefined && !inSet(props.position, CAPTION_POSITIONS)) return `props.position phải là một trong: ${CAPTION_POSITIONS.join(', ')}`;
  if (props.emphasis !== undefined && !inSet(props.emphasis, CAPTION_EMPHASES)) return `props.emphasis phải là một trong: ${CAPTION_EMPHASES.join(', ')}`;
  if (props.backdrop !== undefined && !inSet(props.backdrop, CAPTION_BACKDROPS)) return `props.backdrop phải là một trong: ${CAPTION_BACKDROPS.join(', ')}`;
  if (props.ink !== undefined && !inSet(props.ink, CAPTION_INKS)) return `props.ink phải là một trong: ${CAPTION_INKS.join(', ')}`;
  if (props.label !== undefined && typeof props.label !== 'string') return 'props.label phải là chuỗi';
  if (props.variant === 'label' && !(typeof props.label === 'string' && props.label.length > 0)) return 'variant label cần props.label (chuỗi không rỗng)';
  if (props.handles !== undefined && typeof props.handles !== 'boolean') return 'props.handles phải là true hoặc false';
  if (props.handles === true && props.variant !== 'big') return 'props.handles chỉ dùng với variant big';
  return undefined;
}
