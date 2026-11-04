import { lumaGrid } from '../media/luma';
import { resolveCaptionProps, type CaptionPosition } from '../plan/captionProps';
import { captionRegion } from '../plan/captionRegion';
import type { Layer } from '../plan/types';
import type { Theme } from '../style/theme';

const FPS = 4;
const COLS = 48;
const GLYPH_WIDTH = 0.55; // average character width as a fraction of the font size (bold Vietnamese text)
const MARGIN = 0.06; // the text may sit a little wider than estimated, and a panel right next to it hurts too
export const BRIGHT_COLUMN = 0.8; // a column this bright is close to white (skin and lamps stay well below)

/** Share of the frame width a caption's text takes (it wraps at the safe zone, so never more than `max`). */
function textWidthFraction(layer: Layer, theme: Theme, frameWidth: number, max: number): number {
  const variant = resolveCaptionProps(layer.props, theme).variant;
  const size = theme.captionSize * (variant === 'big' ? theme.captionBigScale : 1);
  const chars = (layer.words ?? []).reduce((n, w) => n + w.t.length + 1, 0);
  return Math.min(max, (chars * size * GLYPH_WIDTH) / frameWidth);
}

/**
 * How much of the text sits on a near-white picture, by caption layer id: the largest share (0-1), over the time the caption is up, of the
 * columns under the text (centred in the safe zone, width estimated from the text, plus a margin) that are at least BRIGHT_COLUMN bright.
 * White text vanishes on such a picture. A white panel at the far side of the frame does not count against a short caption.
 * `frameWidth` is the width the font size is relative to (the plan's width). Layers that start after the video ends are left out.
 */
export async function measureCaptionBright(video: string, captions: Layer[], theme: Theme, frameWidth = 1080): Promise<Map<string, number>> {
  const positions = new Set<CaptionPosition>(captions.map(l => resolveCaptionProps(l.props, theme).position));
  const grids = new Map<CaptionPosition, number[][]>();
  for (const p of positions) grids.set(p, await lumaGrid(video, captionRegion(p, theme), COLS, FPS));
  const out = new Map<string, number>();
  for (const l of captions) {
    const position = resolveCaptionProps(l.props, theme).position;
    const region = captionRegion(position, theme);
    const grid = grids.get(position)!;
    const from = Math.max(0, Math.floor(l.start * FPS));
    if (from > grid.length - 1) continue;
    const to = Math.min(grid.length - 1, Math.max(from, Math.ceil(l.end * FPS) - 1));
    const half = textWidthFraction(l, theme, frameWidth, region.w) / 2 + MARGIN;
    const centre = region.x + region.w / 2;
    const covered = Array.from({ length: COLS }, (_, c) => c).filter(c => {
      const left = region.x + (c / COLS) * region.w;
      const right = region.x + ((c + 1) / COLS) * region.w;
      return right > centre - half && left < centre + half;
    });
    out.set(l.id, Math.max(...grid.slice(from, to + 1).map(row => covered.filter(c => row[c] >= BRIGHT_COLUMN).length / covered.length)));
  }
  return out;
}
