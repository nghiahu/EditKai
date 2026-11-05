import { faceRegion, overlapShare, type Faces } from '../media/faces';
import { FOOTPRINT_TYPES, insertFootprint } from '../plan/insertFootprint';
import { INSERT_POSITIONS, type InsertPosition } from '../plan/insertProps';
import type { Layer } from '../plan/types';

/** A card may cover this share of the face; more than that is "on the face". */
export const OVERLAP_LIMIT = 0.15;

type ThemeBits = { limits: { safeZone: { top: number; bottom: number; left: number; right: number } } };
const ORDER: InsertPosition[] = ['center', ...INSERT_POSITIONS.filter(p => p !== 'center')]; // the default position comes first, so it wins a tie

/**
 * Gives each insert that has no `position` of its own (a card, a counter, a badge, a prompt box) the position that covers the speaker's face least
 * while it is up: the default (centre) when that clears the face, else the best of top and bottom. `faces` must already be in frame coordinates
 * (`mapFacesToFrame`). Layers with a position, other types, and spans with no face are returned as they were.
 */
export function placeAwayFromFaces(layers: Layer[], faces: Faces | undefined, theme: ThemeBits, width: number, height: number): Layer[] {
  if (!faces) return layers;
  return layers.map(l => {
    if (!l.type || !(FOOTPRINT_TYPES as readonly string[]).includes(l.type)) return l;
    if (typeof l.props?.position === 'string') return l;
    const region = faceRegion(faces, l.start, l.end, 0);
    if (!region) return l;
    const covered = (p: InsertPosition) => overlapShare(region, insertFootprint(l.type!, l.props, p, theme, width, height)!);
    if (covered('center') <= OVERLAP_LIMIT) return l;
    const best = ORDER.reduce((a, p) => (covered(p) < covered(a) ? p : a));
    return best === 'center' ? l : { ...l, props: { ...l.props, position: best } };
  });
}
