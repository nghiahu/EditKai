import { useState } from 'react';
import type { Layer, Plan } from '../../src/plan/types';

interface Props { plan: Plan; selectedId?: string; onPick: (l: Layer) => void }

export function LayerList({ plan, selectedId, onPick }: Props) {
  const [q, setQ] = useState('');
  const [track, setTrack] = useState('all');
  const text = (l: Layer) => (l.track === 'caption' ? (l.words ?? []).map(w => w.t).join(' ') : String(l.props?.title ?? l.props?.src ?? l.type ?? ''));
  const items = [...plan.layers]
    .filter(l => (track === 'all' || l.track === track) && (!q || text(l).toLowerCase().includes(q.toLowerCase())))
    .sort((a, b) => a.start - b.start);
  return (
    <div className="panel">
      <div className="field"><input type="text" placeholder="Tìm chữ…" value={q} onChange={e => setQ(e.target.value)} /></div>
      <div className="field">
        <select value={track} onChange={e => setTrack(e.target.value)}>
          <option value="all">Tất cả track</option>
          {['caption', 'title', 'graphic', 'footage', 'camera'].map(t => <option key={t} value={t}>{t}</option>)}
        </select>
      </div>
      {items.map(l => (
        <div key={l.id} className={`item${l.id === selectedId ? ' sel' : ''}`} onClick={() => onPick(l)}>
          <div>{text(l) || l.id}</div>
          <small>{l.track} · {l.start.toFixed(2)}–{l.end.toFixed(2)}s{l.locked ? ' · 🔒' : ''}</small>
        </div>
      ))}
      {items.length === 0 && <small>Không có lớp nào.</small>}
    </div>
  );
}
