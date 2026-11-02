import { useEffect, useRef, useState } from 'react';
import type { Layer, Plan, Track } from '../../src/plan/types';

const GUTTER = 70;
const ROWS: { track: Track; label: string }[] = [
  { track: 'scene', label: 'Cảnh' }, { track: 'caption', label: 'Phụ đề' }, { track: 'title', label: 'Chữ' },
  { track: 'graphic', label: 'Graphic' }, { track: 'footage', label: 'Footage' },
];

interface Props {
  plan: Plan; selectedId?: string; pps: number; durationSec: number; time: number;
  onSelect: (id?: string) => void; onMove: (id: string, start: number) => void;
  onResize: (id: string, edge: 'start' | 'end', t: number) => void; onSeek: (t: number) => void;
}

const labelOf = (l: Layer) =>
  l.track === 'caption' ? (l.words ?? []).map(w => w.t).join(' ')
  : String(l.props?.title ?? l.props?.src ?? l.type ?? l.id);

export function Timeline({ plan, selectedId, pps, durationSec, time, onSelect, onMove, onResize, onSeek }: Props) {
  const [drag, setDrag] = useState<{ id: string; mode: 'move' | 'l' | 'r'; x0: number; layer: Layer } | null>(null);
  const [dt, setDt] = useState(0);
  const dtRef = useRef(0);

  useEffect(() => {
    if (!drag) return;
    const move = (e: PointerEvent) => { dtRef.current = (e.clientX - drag.x0) / pps; setDt(dtRef.current); };
    const up = () => {
      const d = dtRef.current, l = drag.layer;
      if (Math.abs(d) * pps > 2) {
        if (drag.mode === 'move') onMove(l.id, l.start + d);
        else if (drag.mode === 'l') onResize(l.id, 'start', l.start + d);
        else onResize(l.id, 'end', l.end + d);
      }
      dtRef.current = 0; setDt(0); setDrag(null);
    };
    window.addEventListener('pointermove', move);
    window.addEventListener('pointerup', up);
    return () => { window.removeEventListener('pointermove', move); window.removeEventListener('pointerup', up); };
  }, [drag, pps, onMove, onResize]);

  const geom = (l: Layer) => {
    let { start, end } = l;
    if (drag?.id === l.id) {
      if (drag.mode === 'move') { start += dt; end += dt; } else if (drag.mode === 'l') start += dt; else end += dt;
    }
    return { left: GUTTER + Math.max(0, start) * pps, width: Math.max(6, (end - start) * pps) };
  };
  const begin = (e: React.PointerEvent, l: Layer, mode: 'move' | 'l' | 'r') => {
    e.stopPropagation(); onSelect(l.id); setDrag({ id: l.id, mode, x0: e.clientX, layer: l });
  };

  const total = GUTTER + (durationSec + 3) * pps;
  const step = pps >= 60 ? 1 : pps >= 30 ? 2 : 5;
  const sceneAsLayers: Layer[] = plan.scenes.map(s => ({ id: s.id, track: 'scene', start: s.start, end: s.end, props: { title: s.role } }));
  return (
    <div className="panel timeline">
      <div style={{ width: total, position: 'relative' }}>
        <div className="ruler" onClick={e => onSeek(Math.max(0, (e.clientX - e.currentTarget.getBoundingClientRect().left - GUTTER) / pps))}>
          {Array.from({ length: Math.ceil(durationSec / step) + 1 }, (_, i) => (
            <div key={i} className="tick" style={{ left: GUTTER + i * step * pps }}>{i * step}s</div>
          ))}
        </div>
        {ROWS.map(r => (
          <div key={r.track} className={`row t-${r.track}`}>
            <div className="rowlabel">{r.label}</div>
            {(r.track === 'scene' ? sceneAsLayers : plan.layers.filter(l => l.track === r.track)).map(l => (
              <div key={l.id} className={`block${l.id === selectedId ? ' sel' : ''}${l.locked ? ' locked' : ''}`} style={geom(l)} title={labelOf(l)}
                onPointerDown={r.track === 'scene' ? undefined : e => begin(e, l, 'move')}>
                {r.track !== 'scene' && <div className="h l" onPointerDown={e => begin(e, l, 'l')} />}
                {labelOf(l)}
                {r.track !== 'scene' && <div className="h r" onPointerDown={e => begin(e, l, 'r')} />}
              </div>
            ))}
          </div>
        ))}
        <div className="playhead" style={{ left: GUTTER + time * pps }} />
      </div>
    </div>
  );
}
