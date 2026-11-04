import { LAYER_TYPES } from '../plan/layerTypes';
import type { Layer } from '../plan/types';
import type { Director } from '../style/director';
import { cameraProblem, insertProblem } from './storyboard';
import type { Storyboard } from './types';

const MIN_LAYER_SEC = 0.3;
const MOVE_GAP_SEC = 0.1;
const KEEP_RATIO = 0.6;

type Dropped = { type: string; at: number; reason: string };

/** Insert layers (ids i1…) from every beat's inserts: invalid entries are dropped, clamped to the video, and same-track collisions moved or dropped. */
export function insertLayers(sb: Storyboard, durationSec: number): { layers: Layer[]; moved: { id: string; from: number; to: number }[]; dropped: Dropped[] } {
  const dropped: Dropped[] = [];
  const moved: { id: string; from: number; to: number }[] = [];
  const layers: Layer[] = [];
  const lastEnd: Record<string, number> = {};

  const specs = sb.beats.flatMap(b => b.treatment.inserts).filter(s => {
    const p = insertProblem(s, durationSec);
    if (p) dropped.push({ type: String(s?.type), at: Number(s?.at), reason: `invalid: ${p}` });
    return !p;
  });
  specs.sort((a, b) => a.at - b.at); // stable: the same start keeps beat order

  for (const s of specs) {
    const track = LAYER_TYPES[s.type].track;
    let start = s.at;
    if (Math.min(s.at + s.duration, durationSec) - start < MIN_LAYER_SEC) { dropped.push({ type: s.type, at: s.at, reason: 'out-of-range' }); continue; }
    const busy = lastEnd[track];
    if (busy !== undefined && start < busy) {
      start = busy + MOVE_GAP_SEC;
      const kept = Math.min(start + s.duration, durationSec) - start;
      if (kept < s.duration * KEEP_RATIO || kept < MIN_LAYER_SEC) { dropped.push({ type: s.type, at: s.at, reason: `collision on track ${track}` }); continue; }
    }
    const end = Math.min(start + s.duration, durationSec);
    const id = `i${layers.length + 1}`;
    if (start !== s.at) moved.push({ id, from: s.at, to: start });
    layers.push({ id, track, type: s.type, start, end, props: s.props });
    lastEnd[track] = end;
  }
  return { layers, moved, dropped };
}

/** Camera layers (track `camera`, ids z1…): invalid entries dropped, punches kept `punchSpacingSec` apart, never overlapping. */
export function cameraLayers(sb: Storyboard, director: Director, durationSec: number): { layers: Layer[]; dropped: Dropped[] } {
  const dropped: Dropped[] = [];
  const layers: Layer[] = [];
  const specs = sb.beats.flatMap(b => b.treatment.camera).filter(s => {
    const p = cameraProblem(s, durationSec);
    if (p) dropped.push({ type: String(s?.type), at: Number(s?.at), reason: `invalid: ${p}` });
    return !p;
  });
  specs.sort((a, b) => a.at - b.at);
  let lastAt = -Infinity;
  let lastEnd = 0;
  for (const s of specs) {
    const end = Math.min(s.at + s.duration, durationSec);
    if (end - s.at < MIN_LAYER_SEC) { dropped.push({ type: s.type, at: s.at, reason: 'out-of-range' }); continue; }
    if (s.at - lastAt < director.punchSpacingSec) { dropped.push({ type: s.type, at: s.at, reason: `closer than ${director.punchSpacingSec}s to the previous camera move` }); continue; }
    if (s.at < lastEnd) { dropped.push({ type: s.type, at: s.at, reason: 'overlaps the previous camera move' }); continue; }
    layers.push({ id: `z${layers.length + 1}`, track: 'camera', type: s.type, start: s.at, end, ...(s.props ? { props: s.props } : {}) });
    lastAt = s.at;
    lastEnd = end;
  }
  return { layers, dropped };
}
