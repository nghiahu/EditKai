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
