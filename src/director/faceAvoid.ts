import { faceRegion, overlapShare, type FaceBox, type Faces } from '../media/faces';
import { captionRegion } from '../plan/captionRegion';
import { FOOTPRINT_TYPES, insertFootprint } from '../plan/insertFootprint';
import { INSERT_POSITIONS, type InsertPosition } from '../plan/insertProps';
import type { Layer } from '../plan/types';

/** A card may cover this share of the face; more than that is "on the face". */
export const OVERLAP_LIMIT = 0.15;
/** A caption may cover more: it sits at chin height, so the lower part of the face box is its normal place; above this it covers the mouth. */
export const CAPTION_OVERLAP_LIMIT = 0.35;

type ThemeBits = { name: string; limits: { safeZone: { top: number; bottom: number; left: number; right: number } } };
const CAPTION_WEIGHT = 0.5; // sitting on the captions costs half as much as sitting on the face
const ORDER: InsertPosition[] = ['center', ...INSERT_POSITIONS.filter(p => p !== 'center')]; // the default position comes first, so it wins a tie

/** The position for a `type` insert whose face region is `region`: the one that covers the face least, counting the bottom captions it would sit on (ties go to the default order). */
export function bestPosition(type: string, props: Record<string, unknown> | undefined, region: FaceBox, theme: ThemeBits, width: number, height: number): InsertPosition {
  const footprint = (p: InsertPosition) => insertFootprint(type, props, p, theme, width, height)!;
  const captions = captionRegion('bottom', theme);
  const cost = (p: InsertPosition) => overlapShare(region, footprint(p)) + CAPTION_WEIGHT * overlapShare(footprint(p), captions);
  return ORDER.reduce((a, p) => (cost(p) < cost(a) ? p : a));
}

/**
 * Gives each insert that has no `position` of its own (a card, a counter, a badge, a prompt box) the position that covers the speaker's face least
 * while it is up: the default (centre) when that clears the face, else the best of top and bottom, where covering the bottom captions also counts. `faces` must already be in frame coordinates
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
    const best = bestPosition(l.type, l.props, region, theme, width, height);
    return best === 'center' ? l : { ...l, props: { ...l.props, position: best } };
  });
}
