import { faceRegion, overlapShare, type FaceBox, type Faces } from '../media/faces';
import { captionRegion } from '../plan/captionRegion';
import { FOOTPRINT_TYPES, insertFootprint } from '../plan/insertFootprint';
import type { InsertPosition } from '../plan/insertProps';
import type { Layer } from '../plan/types';

/** A card may cover this share of the face; more than that is "on the face". */
export const OVERLAP_LIMIT = 0.15;
/** A caption may cover more: it sits at chin height, so the lower part of the face box is its normal place; above this it covers the mouth. */
export const CAPTION_OVERLAP_LIMIT = 0.35;

type ThemeBits = { name: string; limits: { safeZone: { top: number; bottom: number; left: number; right: number } } };
const CAPTION_WEIGHT = 0.5; // sitting on the captions costs half as much as sitting on the face
const ORDER: InsertPosition[] = ['center', 'top', 'bottom']; // the default position comes first, so it wins a tie
const SIDES: InsertPosition[] = ['left', 'right'];
const WIDE_FRAME_PX = 1500; // a counter's digits are about 840 px wide and a stat card needs about 700: they fit a side column only in a wide frame
const SIDE_WHEN_WIDE = ['counter', 'stat-card'];
const CAPTION_TEXT_SHARE = 0.6; // captions are centred and wrap early: their text takes the middle of the band, not all of it

/** The positions a `type` insert may take: a badge may go to a side; a counter or a stat card too in a wide frame; the other cards stay on the vertical axis (a long quote would wrap too much). */
function positionsFor(type: string, width: number): InsertPosition[] {
  if (type === 'logo-badge' || (SIDE_WHEN_WIDE.includes(type) && width >= WIDE_FRAME_PX)) return [...ORDER, ...SIDES];
  return ORDER;
}

/** The position for a `type` insert whose face region is `region`: the one that covers the face least, counting the bottom captions it would sit on (ties go to the default order). */
export function bestPosition(type: string, props: Record<string, unknown> | undefined, region: FaceBox, theme: ThemeBits, width: number, height: number): InsertPosition {
  const footprint = (p: InsertPosition) => insertFootprint(type, props, p, theme, width, height)!;
  const band = captionRegion('bottom', theme);
  const captions = { ...band, x: band.x + (band.w * (1 - CAPTION_TEXT_SHARE)) / 2, w: band.w * CAPTION_TEXT_SHARE };
  const cost = (p: InsertPosition) => overlapShare(region, footprint(p)) + CAPTION_WEIGHT * overlapShare(footprint(p), captions);
  return positionsFor(type, width).reduce((a, p) => (cost(p) < cost(a) ? p : a));
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

/**
 * Moves a `big` caption (centred by default, so right on the speaker) to the top or the bottom, whichever covers the face less, when the centre
 * covers more than CAPTION_OVERLAP_LIMIT of it. Other captions (they sit low, at chin height) and captions with a `position` are left as they are.
 */
export function placeCaptionsAwayFromFaces(layers: Layer[], faces: Faces | undefined, theme: ThemeBits): Layer[] {
  if (!faces) return layers;
  return layers.map(l => {
    if (l.track !== 'caption' || l.props?.variant !== 'big' || typeof l.props.position === 'string') return l;
    const region = faceRegion(faces, l.start, l.end, 0);
    if (!region) return l;
    const covered = (p: 'top' | 'center' | 'bottom') => overlapShare(region, captionRegion(p, theme));
    if (covered('center') <= CAPTION_OVERLAP_LIMIT) return l;
    const best = covered('top') <= covered('bottom') ? 'top' : 'bottom';
    return { ...l, props: { ...l.props, position: best } };
  });
}
