import type { Layer, Plan } from '../../../src/plan/types';

export interface EditorState { plan: Plan; past: Plan[]; future: Plan[]; selectedId?: string; dirty: boolean }

export type Action =
  | { type: 'move'; id: string; start: number }
  | { type: 'resize'; id: string; edge: 'start' | 'end'; time: number }
  | { type: 'split'; id: string; time: number }
  | { type: 'update'; id: string; patch: Partial<Pick<Layer, 'props' | 'override' | 'words'>> }
  | { type: 'add'; layer: Layer }
  | { type: 'delete'; id: string }
  | { type: 'select'; id?: string }
  | { type: 'undo' }
  | { type: 'redo' }
  | { type: 'saved' }
  | { type: 'reload'; plan: Plan };

const MIN_LEN = 0.1;

export const initState = (plan: Plan): EditorState => ({ plan, past: [], future: [], dirty: false });

/** Record `next` as a new edit: previous plan goes to history, redo is cleared. */
function commit(s: EditorState, next: Plan): EditorState {
  return { ...s, plan: next, past: [...s.past, s.plan], future: [], dirty: true };
}

function mapLayer(plan: Plan, id: string, fn: (l: Layer) => Layer): Plan | undefined {
  if (!plan.layers.some(l => l.id === id)) return undefined;
  return { ...plan, layers: plan.layers.map(l => (l.id === id ? { ...fn(l), locked: true } : l)) };
}

export function reduce(s: EditorState, a: Action): EditorState {
  switch (a.type) {
    case 'select': return { ...s, selectedId: a.id };
    case 'saved': return { ...s, dirty: false };
    case 'reload': return { ...initState(a.plan), selectedId: s.selectedId };
    case 'undo': {
      if (!s.past.length) return s;
      return { ...s, plan: s.past[s.past.length - 1], past: s.past.slice(0, -1), future: [s.plan, ...s.future], dirty: true };
    }
    case 'redo': {
      if (!s.future.length) return s;
      return { ...s, plan: s.future[0], past: [...s.past, s.plan], future: s.future.slice(1), dirty: true };
    }
    case 'move': {
      const next = mapLayer(s.plan, a.id, l => {
        const start = Math.max(0, a.start);
        return { ...l, start, end: start + (l.end - l.start) };
      });
      return next ? commit(s, next) : s;
    }
    case 'resize': {
      const next = mapLayer(s.plan, a.id, l => a.edge === 'start'
        ? { ...l, start: Math.max(0, Math.min(a.time, l.end - MIN_LEN)) }
        : { ...l, end: Math.max(a.time, l.start + MIN_LEN) });
      return next ? commit(s, next) : s;
    }
    case 'update': {
      const next = mapLayer(s.plan, a.id, l => ({
        ...l,
        ...(a.patch.props ? { props: { ...l.props, ...a.patch.props } } : {}),
        ...(a.patch.override ? { override: { ...l.override, ...a.patch.override } } : {}),
        ...(a.patch.words ? { words: a.patch.words } : {}),
      }));
      return next ? commit(s, next) : s;
    }
    case 'split': {
      const l = s.plan.layers.find(x => x.id === a.id);
      if (!l || a.time <= l.start || a.time >= l.end) return s;
      let newId = `${l.id}-b`;
      for (let i = 2; s.plan.layers.some(x => x.id === newId); i++) newId = `${l.id}-b${i}`;
      const first: Layer = { ...l, end: a.time, locked: true, ...(l.words ? { words: l.words.filter(w => w.s < a.time) } : {}) };
      const second: Layer = { ...l, id: newId, start: a.time, locked: true, ...(l.words ? { words: l.words.filter(w => w.s >= a.time) } : {}) };
      return commit(s, { ...s.plan, layers: s.plan.layers.flatMap(x => (x.id === l.id ? [first, second] : [x])) });
    }
    case 'add': return commit(s, { ...s.plan, layers: [...s.plan.layers, { ...a.layer, locked: true }] });
    case 'delete': {
      if (!s.plan.layers.some(l => l.id === a.id)) return s;
      const next = commit(s, { ...s.plan, layers: s.plan.layers.filter(l => l.id !== a.id) });
      return s.selectedId === a.id ? { ...next, selectedId: undefined } : next;
    }
  }
}
