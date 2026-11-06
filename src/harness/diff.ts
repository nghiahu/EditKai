import type { Plan, Layer } from '../plan/types';

export interface PropertyChange {
  path: string;
  oldVal: unknown;
  newVal: unknown;
}

export interface LayerUpdate {
  id: string;
  track: string;
  type?: string;
  changes: PropertyChange[];
}

export interface PlanDiff {
  hasChanges: boolean;
  added: Layer[];
  removed: Layer[];
  updated: LayerUpdate[];
  metaChanged: boolean;
}

function compareObjects(
  prefix: string,
  oldObj: Record<string, unknown> | undefined,
  newObj: Record<string, unknown> | undefined,
  changes: PropertyChange[],
): void {
  const allKeys = new Set([
    ...Object.keys(oldObj ?? {}),
    ...Object.keys(newObj ?? {}),
  ]);

  for (const k of allKeys) {
    const oVal = oldObj ? oldObj[k] : undefined;
    const nVal = newObj ? newObj[k] : undefined;
    const path = prefix ? `${prefix}.${k}` : k;

    if (JSON.stringify(oVal) !== JSON.stringify(nVal)) {
      changes.push({ path, oldVal: oVal, newVal: nVal });
    }
  }
}

function compareLayers(oldLayer: Layer, newLayer: Layer): PropertyChange[] {
  const changes: PropertyChange[] = [];

  if (oldLayer.track !== newLayer.track) {
    changes.push({ path: 'track', oldVal: oldLayer.track, newVal: newLayer.track });
  }
  if (oldLayer.type !== newLayer.type) {
    changes.push({ path: 'type', oldVal: oldLayer.type, newVal: newLayer.type });
  }
  if (oldLayer.start !== newLayer.start) {
    changes.push({ path: 'start', oldVal: oldLayer.start, newVal: newLayer.start });
  }
  if (oldLayer.end !== newLayer.end) {
    changes.push({ path: 'end', oldVal: oldLayer.end, newVal: newLayer.end });
  }

  compareObjects('props', oldLayer.props, newLayer.props, changes);
  compareObjects('override', oldLayer.override, newLayer.override, changes);

  if (JSON.stringify(oldLayer.words) !== JSON.stringify(newLayer.words)) {
    changes.push({ path: 'words', oldVal: oldLayer.words, newVal: newLayer.words });
  }

  return changes;
}

export function diffPlan(original: Plan, draft: Plan): PlanDiff {
  const origMap = new Map<string, Layer>(original.layers.map(l => [l.id, l]));
  const draftMap = new Map<string, Layer>(draft.layers.map(l => [l.id, l]));

  const added: Layer[] = [];
  const removed: Layer[] = [];
  const updated: LayerUpdate[] = [];

  for (const [id, draftLayer] of draftMap.entries()) {
    const origLayer = origMap.get(id);
    if (!origLayer) {
      added.push(draftLayer);
    } else {
      const changes = compareLayers(origLayer, draftLayer);
      if (changes.length > 0) {
        updated.push({
          id,
          track: draftLayer.track,
          type: draftLayer.type,
          changes,
        });
      }
    }
  }

  for (const [id, origLayer] of origMap.entries()) {
    if (!draftMap.has(id)) {
      removed.push(origLayer);
    }
  }

  const metaChanged = JSON.stringify(original.meta) !== JSON.stringify(draft.meta);
  const hasChanges = added.length > 0 || removed.length > 0 || updated.length > 0 || metaChanged;

  return {
    hasChanges,
    added,
    removed,
    updated,
    metaChanged,
  };
}

export function describePlanDiff(diff: PlanDiff): string[] {
  if (!diff.hasChanges) return ['Không có thay đổi'];

  const lines: string[] = [];

  for (const a of diff.added) {
    const typeLabel = a.type ? ` ${a.type}` : '';
    lines.push(`+ Thêm layer${typeLabel} "${a.id}" (${a.track}) tại ${a.start}s – ${a.end}s`);
  }

  for (const r of diff.removed) {
    const typeLabel = r.type ? ` ${r.type}` : '';
    lines.push(`- Xóa layer${typeLabel} "${r.id}" (${r.track})`);
  }

  for (const u of diff.updated) {
    const changeStrs = u.changes.map(c => {
      const o = typeof c.oldVal === 'string' ? `"${c.oldVal}"` : JSON.stringify(c.oldVal);
      const n = typeof c.newVal === 'string' ? `"${c.newVal}"` : JSON.stringify(c.newVal);
      return `${c.path}: ${o} → ${n}`;
    });
    lines.push(`~ Sửa layer "${u.id}": ${changeStrs.join(', ')}`);
  }

  if (diff.metaChanged) {
    lines.push('~ Cập nhật metadata của kế hoạch dựng (meta)');
  }

  return lines;
}

