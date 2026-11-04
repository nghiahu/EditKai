// Browser-safe (no node imports): where a caption sits on the picture, shared by the renderer's layout and the brightness check.
import type { CaptionPosition } from './captionProps';
import type { Region } from '../media/luma';

type ThemeBits = { name: string; limits: { safeZone: { top: number; bottom: number; left: number; right: number } } };

const CAPTION_HEIGHT = 0.18; // about two lines of text, as a fraction of the frame height

/** Distance of a bottom caption from the bottom edge, as a fraction of the height (m1 keeps its captions higher). */
export const captionBottomFraction = (theme: ThemeBits): number => (theme.name === 'm1' ? 0.28 : theme.limits.safeZone.bottom);

/** The rectangle a caption at `position` covers, as fractions of the frame. */
export function captionRegion(position: CaptionPosition, theme: ThemeBits): Region {
  const sz = theme.limits.safeZone;
  const x = sz.left;
  const w = 1 - sz.left - sz.right;
  if (position === 'top') return { x, y: sz.top, w, h: CAPTION_HEIGHT };
  if (position === 'center') return { x, y: 0.5 - CAPTION_HEIGHT / 2, w, h: CAPTION_HEIGHT };
  return { x, y: 1 - captionBottomFraction(theme) - CAPTION_HEIGHT, w, h: CAPTION_HEIGHT };
}
