import type { Layer } from '../../src/plan/types';
import type { Theme } from '../../src/style/theme';
import type { Action } from './state/editorState';

interface Props { layer?: Layer; theme: Theme; time: number; dispatch: (a: Action) => void }

const num = (v: string) => (v === '' || Number.isNaN(Number(v)) ? undefined : Number(v));

export function PropertiesPanel({ layer, theme, time, dispatch }: Props) {
  if (!layer) return <div className="panel"><small>Chọn một lớp trên timeline hoặc danh sách để sửa.</small></div>;
  const accentKey = theme.name === 'm1' ? 'yellow' : 'teal';
  const setWords = (words: NonNullable<Layer['words']>) => dispatch({ type: 'update', id: layer.id, patch: { words } });
  return (
    <div className="panel">
      <div className="field"><b>{layer.id}</b><small>{layer.track}{layer.type ? ` · ${layer.type}` : ''}</small></div>
      <div className="field">
        <label>Bắt đầu (s)</label>
        <input type="number" step="0.1" value={layer.start.toFixed(2)} onChange={e => { const v = num(e.target.value); if (v !== undefined) dispatch({ type: 'resize', id: layer.id, edge: 'start', time: v }); }} />
        <label>Kết thúc (s)</label>
        <input type="number" step="0.1" value={layer.end.toFixed(2)} onChange={e => { const v = num(e.target.value); if (v !== undefined) dispatch({ type: 'resize', id: layer.id, edge: 'end', time: v }); }} />
      </div>
      {layer.track === 'caption' && (layer.words ?? []).map((w, i) => (
        <div key={i} className="field" style={{ flexDirection: 'row', gap: 6 }}>
          <input type="text" value={w.t} onChange={e => setWords(layer.words!.map((x, j) => (j === i ? { ...x, t: e.target.value } : x)))} />
          <label title="Tô nổi bật"><input type="checkbox" checked={w.hl} onChange={e => setWords(layer.words!.map((x, j) => (j === i ? { ...x, hl: e.target.checked } : x)))} /> ★</label>
        </div>
      ))}
      {Object.entries(layer.props ?? {}).filter(([, v]) => typeof v === 'string').map(([k, v]) => (
        <div key={k} className="field">
          <label>{k}</label>
          <input type="text" value={v as string} onChange={e => dispatch({ type: 'update', id: layer.id, patch: { props: { [k]: e.target.value } } })} />
        </div>
      ))}
      <div className="field">
        <label>Cỡ chữ (ghi đè)</label>
        <input type="number" value={Number(layer.override?.captionSize ?? theme.captionSize)} onChange={e => { const v = num(e.target.value); if (v) dispatch({ type: 'update', id: layer.id, patch: { override: { captionSize: v } } }); }} />
        <label>Màu nhấn (ghi đè)</label>
        <input type="color" value={(layer.override?.colors as Record<string, string> | undefined)?.[accentKey] ?? theme.colors[accentKey]} onChange={e => dispatch({ type: 'update', id: layer.id, patch: { override: { colors: { [accentKey]: e.target.value } } } })} />
        <label>Font (ghi đè)</label>
        <input type="text" placeholder={theme.fonts.body} value={(layer.override?.fonts as { body?: string } | undefined)?.body ?? ''} onChange={e => dispatch({ type: 'update', id: layer.id, patch: { override: { fonts: { heading: e.target.value || theme.fonts.heading, body: e.target.value || theme.fonts.body } } } })} />
      </div>
      <div style={{ display: 'flex', gap: 6 }}>
        <button onClick={() => dispatch({ type: 'split', id: layer.id, time })}>Tách tại đầu phát</button>
        <button onClick={() => dispatch({ type: 'delete', id: layer.id })}>Xóa</button>
      </div>
    </div>
  );
}
