import type { Plan } from './types';

/** Keep every locked layer of `existing`; take the rest from `regenerated`, minus layers that collide with a locked one. */
export function mergeRegenerated(existing: Plan, regenerated: Plan): Plan {
  const locked = existing.layers.filter(l => l.locked);
  const free = regenerated.layers.filter(
    l => !locked.some(k => k.id === l.id || (k.track === l.track && l.start < k.end && k.start < l.end)),
  );
  return { ...regenerated, layers: [...locked, ...free] };
}
