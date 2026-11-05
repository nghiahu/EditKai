// Browser-safe (no node imports). Roughly where an insert with a `position` sits on the frame, for keeping it off the speaker's face.
import type { FaceBox } from '../media/faces';
import { SIDE_SHARE, type InsertPosition } from './insertProps';
import { resolveCounter, resolveLogoBadge, resolvePromptBox, resolveQuoteCard, resolveStatCard } from './insertTypes';

type ThemeBits = { limits: { safeZone: { top: number; bottom: number; left: number; right: number } } };

/** Insert types whose box depends on a `position` prop. */
export const FOOTPRINT_TYPES = ['logo-badge', 'stat-card', 'quote-card', 'counter', 'prompt-box'] as const;

// The components are laid out in pixels (a 220 px badge, 28 px captions...), so heights below are pixels from their layout code, rounded up.
const BADGE_PX = 220;
const LABEL_PX = 100; // the pill above a badge
const SUB_PX = 66;
const STAT_BASE_PX = 72;
const STAT_TITLE_PX = 56;
const STAT_ROW_PX = 130;
const QUOTE_PX = 380;
const COUNTER_PX = 340;
const COUNTER_WIDTH = 0.7; // of the safe zone
const BADGE_WIDTH_PX = 360;
const PROMPT_PX = 200;

function size(type: string, props: Record<string, unknown>, safeW: number): { w: number; hPx: number } | undefined {
  switch (type) {
    case 'logo-badge': { const r = resolveLogoBadge(props); return { w: Math.min(safeW, BADGE_WIDTH_PX), hPx: BADGE_PX + (r.label ? LABEL_PX : 0) + (r.sub ? SUB_PX : 0) }; }
    case 'stat-card': { const r = resolveStatCard(props); return { w: safeW, hPx: STAT_BASE_PX + (r.title ? STAT_TITLE_PX : 0) + r.rows.length * STAT_ROW_PX }; }
    case 'quote-card': resolveQuoteCard(props); return { w: safeW, hPx: QUOTE_PX };
    case 'counter': resolveCounter(props); return { w: safeW * COUNTER_WIDTH, hPx: COUNTER_PX };
    case 'prompt-box': resolvePromptBox(props); return { w: safeW, hPx: PROMPT_PX };
    default: return undefined;
  }
}

/** The rectangle (shares of the frame) an insert of `type` takes at `position`, or undefined for a type that has no position. */
export function insertFootprint(type: string, props: Record<string, unknown> | undefined, position: InsertPosition, theme: ThemeBits, width: number, height: number): FaceBox | undefined {
  const sz = theme.limits.safeZone;
  const safeW = width * (1 - sz.left - sz.right);
  const side = position === 'left' || position === 'right';
  const columnW = side ? width * SIDE_SHARE : safeW; // a card is as wide as its column; one at a side is squeezed into the side column
  const s = size(type, props ?? {}, columnW);
  if (!s) return undefined;
  const h = s.hPx / height;
  const y = position === 'top' ? sz.top : position === 'bottom' ? 1 - sz.bottom - h : 0.5 - h / 2;
  const w = s.w / width;
  const column = columnW / width;
  if (side) return { x: (position === 'left' ? sz.left : 1 - sz.right - column) + (column - w) / 2, y: 0.5 - h / 2, w, h };
  return { x: sz.left + (1 - sz.left - sz.right - w) / 2, y, w, h };
}
