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
