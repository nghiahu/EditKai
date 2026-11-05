// Browser-safe (no node imports): props of the graphic inserts (logo-badge here; prompt-box and stat-card are added by later tasks).
import { INSERT_POSITIONS, type InsertPosition } from './insertProps';

const isString = (v: unknown): v is string => typeof v === 'string';
const inPositions = (v: unknown): boolean => typeof v === 'string' && (INSERT_POSITIONS as readonly string[]).includes(v);
const positionOr = (v: unknown, fallback: InsertPosition): InsertPosition => (inPositions(v) ? (v as InsertPosition) : fallback);

export interface ResolvedLogoBadge {
  icon: string;
  src?: string;
  label?: string;
  sub?: string;
  position: InsertPosition;
}

/** Reads logo-badge props with safe defaults (icon `sparkles`, position `center`); never throws. */
export function resolveLogoBadge(props: Record<string, unknown> | undefined): ResolvedLogoBadge {
  const p = props ?? {};
  return {
    icon: isString(p.icon) && p.icon.length > 0 ? p.icon : 'sparkles',
    ...(isString(p.src) && p.src.length > 0 ? { src: p.src } : {}),
    ...(isString(p.label) && p.label.length > 0 ? { label: p.label } : {}),
    ...(isString(p.sub) && p.sub.length > 0 ? { sub: p.sub } : {}),
    position: positionOr(p.position, 'center'),
  };
}

/** Why logo-badge props are invalid (Vietnamese message for the validator), or undefined. Nothing is required. */
export function logoBadgeProblem(props: Record<string, unknown>): string | undefined {
  for (const key of ['icon', 'src', 'label', 'sub']) {
    if (props[key] !== undefined && !isString(props[key])) return `props.${key} phải là chuỗi`;
  }
  if (props.position !== undefined && !inPositions(props.position)) return `props.position phải là một trong: ${INSERT_POSITIONS.join(', ')}`;
  if (props.dim !== undefined && typeof props.dim !== 'boolean') return 'props.dim phải là true hoặc false';
  return undefined;
}

export interface ResolvedPromptBox {
  text: string;
  placeholder?: string;
  strike: boolean;
  position: InsertPosition;
}

/** Reads prompt-box props with safe defaults (position `top`); never throws. */
export function resolvePromptBox(props: Record<string, unknown> | undefined): ResolvedPromptBox {
  const p = props ?? {};
  return {
    text: isString(p.text) ? p.text : '',
    ...(isString(p.placeholder) && p.placeholder.length > 0 ? { placeholder: p.placeholder } : {}),
    strike: p.strike === true,
    position: positionOr(p.position, 'top'),
  };
}

/** Why prompt-box props are invalid (Vietnamese message for the validator), or undefined. `text` is required. */
export function promptBoxProblem(props: Record<string, unknown>): string | undefined {
  if (!isString(props.text) || props.text.length === 0) return 'thiếu props.text (chuỗi không rỗng)';
  if (props.placeholder !== undefined && !isString(props.placeholder)) return 'props.placeholder phải là chuỗi';
  if (props.strike !== undefined && typeof props.strike !== 'boolean') return 'props.strike phải là true hoặc false';
  if (props.position !== undefined && !inPositions(props.position)) return `props.position phải là một trong: ${INSERT_POSITIONS.join(', ')}`;
  if (props.dim !== undefined && typeof props.dim !== 'boolean') return 'props.dim phải là true hoặc false';
  return undefined;
}

export interface StatRow {
  icon?: string;
  value: string;
  caption?: string;
}

export interface ResolvedStatCard {
  title?: string;
  rows: StatRow[];
  position: InsertPosition;
}

const MAX_STAT_ROWS = 4;

/** Reads stat-card props with safe defaults (position `center`, at most 4 rows, bad rows dropped); never throws. */
export function resolveStatCard(props: Record<string, unknown> | undefined): ResolvedStatCard {
  const p = props ?? {};
  const rows: StatRow[] = [];
  for (const raw of Array.isArray(p.rows) ? p.rows : []) {
    if (rows.length === MAX_STAT_ROWS) break;
    if (typeof raw !== 'object' || raw === null || !isString((raw as { value?: unknown }).value)) continue;
    const r = raw as { icon?: unknown; value: string; caption?: unknown };
    rows.push({ value: r.value, ...(isString(r.icon) && r.icon.length > 0 ? { icon: r.icon } : {}), ...(isString(r.caption) && r.caption.length > 0 ? { caption: r.caption } : {}) });
  }
  return { ...(isString(p.title) && p.title.length > 0 ? { title: p.title } : {}), rows, position: positionOr(p.position, 'center') };
}

/** Why stat-card props are invalid (Vietnamese message for the validator), or undefined. `rows` (1-4, each with a non-empty value) is required. */
export function statCardProblem(props: Record<string, unknown>): string | undefined {
  if (!Array.isArray(props.rows) || props.rows.length < 1 || props.rows.length > MAX_STAT_ROWS) return `props.rows phải là mảng từ 1 đến ${MAX_STAT_ROWS} hàng`;
  for (const [i, row] of props.rows.entries()) {
    if (typeof row !== 'object' || row === null) return `props.rows[${i}] phải là một đối tượng { value, icon?, caption? }`;
    const r = row as { value?: unknown; icon?: unknown; caption?: unknown };
    if (!isString(r.value) || r.value.length === 0) return `props.rows[${i}].value phải là chuỗi không rỗng`;
    if (r.icon !== undefined && !isString(r.icon)) return `props.rows[${i}].icon phải là chuỗi`;
    if (r.caption !== undefined && !isString(r.caption)) return `props.rows[${i}].caption phải là chuỗi`;
  }
  if (props.title !== undefined && !isString(props.title)) return 'props.title phải là chuỗi';
  if (props.position !== undefined && !inPositions(props.position)) return `props.position phải là một trong: ${INSERT_POSITIONS.join(', ')}`;
  if (props.dim !== undefined && typeof props.dim !== 'boolean') return 'props.dim phải là true hoặc false';
  return undefined;
}

const MAX_QUOTE_CHARS = 240;
const MAX_DECIMALS = 3;

export interface ResolvedQuoteCard {
  quote: string;
  author?: string;
  position: InsertPosition;
}

/** Reads quote-card props with safe defaults (position `center`, empty quote when missing); never throws. */
export function resolveQuoteCard(props: Record<string, unknown> | undefined): ResolvedQuoteCard {
  const p = props ?? {};
  return { quote: isString(p.quote) ? p.quote : '', ...(isString(p.author) && p.author.length > 0 ? { author: p.author } : {}), position: positionOr(p.position, 'center') };
}

/** Why quote-card props are invalid (Vietnamese message for the validator), or undefined. `quote` (non-empty, at most 240 characters) is required. */
export function quoteCardProblem(props: Record<string, unknown>): string | undefined {
  if (!isString(props.quote) || props.quote.length === 0) return 'props.quote phải là chuỗi không rỗng';
  if (props.quote.length > MAX_QUOTE_CHARS) return `props.quote dài tối đa ${MAX_QUOTE_CHARS} ký tự`;
  if (props.author !== undefined && !isString(props.author)) return 'props.author phải là chuỗi';
  if (props.position !== undefined && !inPositions(props.position)) return `props.position phải là một trong: ${INSERT_POSITIONS.join(', ')}`;
  if (props.dim !== undefined && typeof props.dim !== 'boolean') return 'props.dim phải là true hoặc false';
  return undefined;
}

export interface ResolvedCounter {
  from: number;
  to: number;
  decimals: number;
  prefix?: string;
  suffix?: string;
  label?: string;
  position: InsertPosition;
}

const isFiniteNumber = (v: unknown): v is number => typeof v === 'number' && Number.isFinite(v);

/** Reads counter props with safe defaults (from 0, no decimals, position `center`; a bad number falls back); never throws. */
export function resolveCounter(props: Record<string, unknown> | undefined): ResolvedCounter {
  const p = props ?? {};
  const decimals = typeof p.decimals === 'number' && Number.isInteger(p.decimals) && p.decimals >= 0 && p.decimals <= MAX_DECIMALS ? p.decimals : 0;
  return {
    from: isFiniteNumber(p.from) ? p.from : 0,
    to: isFiniteNumber(p.to) ? p.to : 0,
    decimals,
    ...(isString(p.prefix) && p.prefix.length > 0 ? { prefix: p.prefix } : {}),
    ...(isString(p.suffix) && p.suffix.length > 0 ? { suffix: p.suffix } : {}),
    ...(isString(p.label) && p.label.length > 0 ? { label: p.label } : {}),
    position: positionOr(p.position, 'center'),
  };
}

/** Why counter props are invalid (Vietnamese message for the validator), or undefined. `to` (a finite number) is required. */
export function counterProblem(props: Record<string, unknown>): string | undefined {
  if (!isFiniteNumber(props.to)) return 'props.to phải là một số hữu hạn';
  if (props.from !== undefined && !isFiniteNumber(props.from)) return 'props.from phải là một số hữu hạn';
  if (props.decimals !== undefined && !(typeof props.decimals === 'number' && Number.isInteger(props.decimals) && props.decimals >= 0 && props.decimals <= MAX_DECIMALS)) return `props.decimals phải là số nguyên từ 0 đến ${MAX_DECIMALS}`;
  for (const key of ['prefix', 'suffix', 'label']) {
    if (props[key] !== undefined && !isString(props[key])) return `props.${key} phải là chuỗi`;
  }
  if (props.position !== undefined && !inPositions(props.position)) return `props.position phải là một trong: ${INSERT_POSITIONS.join(', ')}`;
  if (props.dim !== undefined && typeof props.dim !== 'boolean') return 'props.dim phải là true hoặc false';
  return undefined;
}

export const CALLOUT_KINDS = ['ring', 'arrow'] as const;
export const CALLOUT_COLORS = ['accent', 'white'] as const;
const CALLOUT_MIN_SIZE = 0.05;
const CALLOUT_MAX_SIZE = 0.6;
const CALLOUT_MAX_LABEL = 24;

export interface ResolvedCallout {
  kind: (typeof CALLOUT_KINDS)[number];
  x: number;
  y: number;
  size: number; // the ring's width, or the arrow's length, as a share of the frame width
  angle: number; // degrees, counter-clockwise from the right: the direction the arrow comes from (an arrow at 225 comes from the lower left)
  label?: string;
  color: (typeof CALLOUT_COLORS)[number];
}

const inFrame = (v: unknown): v is number => isFiniteNumber(v) && v >= 0 && v <= 1;
const calloutSizeOk = (v: unknown): v is number => isFiniteNumber(v) && v >= CALLOUT_MIN_SIZE && v <= CALLOUT_MAX_SIZE;

/** Reads callout props with safe defaults (a ring in the middle, size 0.18, an arrow from the lower left); a bad value falls back; never throws. */
export function resolveCallout(props: Record<string, unknown> | undefined): ResolvedCallout {
  const p = props ?? {};
  return {
    kind: (CALLOUT_KINDS as readonly unknown[]).includes(p.kind) ? (p.kind as ResolvedCallout['kind']) : 'ring',
    x: inFrame(p.x) ? p.x : 0.5,
    y: inFrame(p.y) ? p.y : 0.5,
    size: calloutSizeOk(p.size) ? p.size : 0.18,
    angle: isFiniteNumber(p.angle) ? p.angle : 225,
    ...(isString(p.label) && p.label.length > 0 && p.label.length <= CALLOUT_MAX_LABEL ? { label: p.label } : {}),
    color: (CALLOUT_COLORS as readonly unknown[]).includes(p.color) ? (p.color as ResolvedCallout['color']) : 'accent',
  };
}

/** Why callout props are invalid (Vietnamese message for the validator), or undefined. `kind`, `x` and `y` are required. */
export function calloutProblem(props: Record<string, unknown>): string | undefined {
  if (!(CALLOUT_KINDS as readonly unknown[]).includes(props.kind)) return `props.kind phải là ${CALLOUT_KINDS.join(' hoặc ')}`;
  if (!inFrame(props.x)) return 'props.x phải là số trong khoảng 0–1 (tỉ lệ chiều rộng khung)';
  if (!inFrame(props.y)) return 'props.y phải là số trong khoảng 0–1 (tỉ lệ chiều cao khung)';
  if (props.size !== undefined && !calloutSizeOk(props.size)) return `props.size phải là số trong khoảng ${CALLOUT_MIN_SIZE}–${CALLOUT_MAX_SIZE}`;
  if (props.angle !== undefined && !isFiniteNumber(props.angle)) return 'props.angle phải là một số (độ)';
  if (props.label !== undefined && !(isString(props.label) && props.label.length > 0 && props.label.length <= CALLOUT_MAX_LABEL)) return `props.label phải là chuỗi không rỗng, tối đa ${CALLOUT_MAX_LABEL} ký tự`;
  if (props.color !== undefined && !(CALLOUT_COLORS as readonly unknown[]).includes(props.color)) return `props.color phải là ${CALLOUT_COLORS.join(' hoặc ')}`;
  return undefined;
}

const STEP_MAX_TITLE = 40;
const STEP_MAX_SUB = 60;

export interface ResolvedStepNumber {
  number: number;
  title?: string;
  sub?: string;
  position: InsertPosition;
}

const stepNumberOk = (v: unknown): v is number => typeof v === 'number' && Number.isInteger(v) && v >= 1 && v <= 99;
const shortText = (v: unknown, max: number): v is string => isString(v) && v.length > 0 && v.length <= max;

/** Reads step-number props with safe defaults (step 1, position `top`); a bad value falls back; never throws. */
export function resolveStepNumber(props: Record<string, unknown> | undefined): ResolvedStepNumber {
  const p = props ?? {};
  return {
    number: stepNumberOk(p.number) ? p.number : 1,
    ...(shortText(p.title, STEP_MAX_TITLE) ? { title: p.title } : {}),
    ...(shortText(p.sub, STEP_MAX_SUB) ? { sub: p.sub } : {}),
    position: positionOr(p.position, 'top'),
  };
}

/** Why step-number props are invalid (Vietnamese message for the validator), or undefined. `number` (a whole number from 1 to 99) is required. */
export function stepNumberProblem(props: Record<string, unknown>): string | undefined {
  if (!stepNumberOk(props.number)) return 'props.number phải là số nguyên từ 1 đến 99';
  if (props.title !== undefined && !shortText(props.title, STEP_MAX_TITLE)) return `props.title phải là chuỗi không rỗng, tối đa ${STEP_MAX_TITLE} ký tự`;
  if (props.sub !== undefined && !shortText(props.sub, STEP_MAX_SUB)) return `props.sub phải là chuỗi không rỗng, tối đa ${STEP_MAX_SUB} ký tự`;
  if (props.position !== undefined && !inPositions(props.position)) return `props.position phải là một trong: ${INSERT_POSITIONS.join(', ')}`;
  return undefined;
}

export const CHART_KINDS = ['bar', 'line'] as const;
const CHART_MIN_POINTS = 2;
const CHART_MAX_POINTS = 6;
const CHART_MAX_LABEL = 16;
const CHART_MAX_UNIT = 12;
const CHART_MAX_TITLE = 40;
const CHART_MAX_SOURCE = 60;

export interface ChartPoint { label: string; value: number }

export interface ResolvedChart {
  kind: (typeof CHART_KINDS)[number];
  points: ChartPoint[];
  unit?: string;
  title?: string;
  source?: string;
  position: InsertPosition;
}

const chartPointOk = (v: unknown): v is ChartPoint =>
  typeof v === 'object' && v !== null && isString((v as ChartPoint).label) && (v as ChartPoint).label.length > 0 && (v as ChartPoint).label.length <= CHART_MAX_LABEL
  && isFiniteNumber((v as ChartPoint).value) && (v as ChartPoint).value >= 0;
const chartText = (v: unknown, max: number): v is string => isString(v) && v.length > 0 && v.length <= max;

/** Reads chart props with safe defaults (a bar chart, position `center`); bad points are dropped, at most 6 kept; never throws. */
export function resolveChart(props: Record<string, unknown> | undefined): ResolvedChart {
  const p = props ?? {};
  return {
    kind: (CHART_KINDS as readonly unknown[]).includes(p.kind) ? (p.kind as ResolvedChart['kind']) : 'bar',
    points: (Array.isArray(p.points) ? p.points : []).filter(chartPointOk).slice(0, CHART_MAX_POINTS).map(({ label, value }) => ({ label, value })),
    ...(chartText(p.unit, CHART_MAX_UNIT) ? { unit: p.unit } : {}),
    ...(chartText(p.title, CHART_MAX_TITLE) ? { title: p.title } : {}),
    ...(chartText(p.source, CHART_MAX_SOURCE) ? { source: p.source } : {}),
    position: positionOr(p.position, 'center'),
  };
}

/** Why chart props are invalid (Vietnamese message for the validator), or undefined. `kind` and `points` (2 to 6 of { label, value >= 0 }) are required. */
export function chartProblem(props: Record<string, unknown>): string | undefined {
  if (!(CHART_KINDS as readonly unknown[]).includes(props.kind)) return `props.kind phải là ${CHART_KINDS.join(' hoặc ')}`;
  const pts = props.points;
  if (!Array.isArray(pts) || pts.length < CHART_MIN_POINTS || pts.length > CHART_MAX_POINTS) return `props.points phải là mảng từ ${CHART_MIN_POINTS} đến ${CHART_MAX_POINTS} điểm { label, value }`;
  for (const [i, pt] of pts.entries()) {
    const q = pt as Partial<ChartPoint> | null;
    if (typeof q !== 'object' || q === null) return `props.points[${i}] phải là một đối tượng { label, value }`;
    if (!isString(q.label) || q.label.length === 0 || q.label.length > CHART_MAX_LABEL) return `props.points[${i}].label phải là chuỗi không rỗng, tối đa ${CHART_MAX_LABEL} ký tự`;
    if (!isFiniteNumber(q.value) || q.value < 0) return `props.points[${i}].value phải là số hữu hạn không âm`;
  }
  if (props.unit !== undefined && !chartText(props.unit, CHART_MAX_UNIT)) return `props.unit phải là chuỗi không rỗng, tối đa ${CHART_MAX_UNIT} ký tự`;
  if (props.title !== undefined && !chartText(props.title, CHART_MAX_TITLE)) return `props.title phải là chuỗi không rỗng, tối đa ${CHART_MAX_TITLE} ký tự`;
  if (props.source !== undefined && !chartText(props.source, CHART_MAX_SOURCE)) return `props.source phải là chuỗi không rỗng, tối đa ${CHART_MAX_SOURCE} ký tự`;
  if (props.position !== undefined && !inPositions(props.position)) return `props.position phải là một trong: ${INSERT_POSITIONS.join(', ')}`;
  return undefined;
}
