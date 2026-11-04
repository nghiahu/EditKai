import type { Layer, Plan } from '../plan/types';
import type { Storyboard } from './types';

type Scene = Plan['scenes'][number];

/** Scenes from beats: `insert` where a footage layer overlaps the beat, `explainer` for an explainer-scene layer, else talking-head. Contiguous over [0, durationSec]. */
export function buildScenes(sb: Storyboard, layers: Layer[], limits: { minSceneSec: number }, durationSec: number): Scene[] {
  const beats = [...sb.beats].sort((a, b) => a.start - b.start);
  if (beats.length === 0 || durationSec <= 0) return [{ id: 's1', start: 0, end: durationSec, role: 'talking-head' }];

  const roleOf = (start: number, end: number): Scene['role'] => {
    const hits = (type: string) => layers.some(l => l.type === type && l.start < end && l.end > start);
    return hits('footage') ? 'insert' : hits('explainer-scene') ? 'explainer' : 'talking-head';
  };
  // boundaries sit in the middle of the pause between two beats
  const cuts = beats.slice(1).map((b, i) => Math.min(durationSec, Math.max(0, (beats[i].end + b.start) / 2)));
  let scenes: Scene[] = beats
    .map((b, i) => ({
      id: '',
      start: i === 0 ? 0 : cuts[i - 1],
      end: i === beats.length - 1 ? durationSec : cuts[i],
      role: roleOf(b.start, b.end),
    }))
    .filter(s => s.end > s.start);
  if (scenes.length === 0) return [{ id: 's1', start: 0, end: durationSec, role: 'talking-head' }];
  scenes[0].start = 0;
  scenes[scenes.length - 1].end = durationSec;

  const mergeEqual = () => {
    scenes = scenes.reduce<Scene[]>((acc, s) => {
      const prev = acc[acc.length - 1];
      if (prev && prev.role === s.role) prev.end = s.end;
      else acc.push({ ...s });
      return acc;
    }, []);
  };
  mergeEqual();
  for (let i = 0; i < scenes.length && scenes.length > 1; ) {
    const s = scenes[i];
    if (s.end - s.start >= limits.minSceneSec) { i++; continue; }
    if (i > 0) { scenes[i - 1].end = s.end; scenes.splice(i, 1); }
    else { scenes[1].start = s.start; scenes.splice(0, 1); }
    mergeEqual();
    i = 0;
  }
  return scenes.map((s, i) => ({ ...s, id: `s${i + 1}` }));
}
