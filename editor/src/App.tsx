import { useCallback, useEffect, useReducer, useRef, useState } from 'react';
import type { PlayerRef } from '@remotion/player';
import { durationOf } from '../../remotion/PlanVideo';
import type { Issue, Plan } from '../../src/plan/types';
import type { Theme } from '../../src/style/theme';
import { API, getIssues, getPlan, getTheme, onPlanChanged, renderVideo, savePlan } from './api';
import { LayerList } from './LayerList';
import { Preview } from './Preview';
import { PropertiesPanel } from './PropertiesPanel';
import { Timeline } from './Timeline';
import { initState, reduce } from './state/editorState';

export function App() {
  const [boot, setBoot] = useState<{ plan: Plan; theme: Theme } | { error: string } | null>(null);
  useEffect(() => {
    Promise.all([getPlan(), getTheme()]).then(([plan, theme]) => setBoot({ plan, theme }), e => setBoot({ error: (e as Error).message }));
  }, []);
  if (!boot) return <div style={{ padding: 20 }}>Đang tải…</div>;
  if ('error' in boot) return <div style={{ padding: 20 }}>Không mở được project: {boot.error}</div>;
  return <Editor initial={boot.plan} initialTheme={boot.theme} />;
}

function Editor({ initial, initialTheme }: { initial: Plan; initialTheme: Theme }) {
  const [state, dispatch] = useReducer(reduce, initial, initState);
  const [theme, setTheme] = useState(initialTheme);
  const [pps, setPps] = useState(90);
  const [frame, setFrame] = useState(0);
  const [videoDur, setVideoDur] = useState<number>();
  const [showSafe, setShowSafe] = useState(true);
  const [showFace, setShowFace] = useState(false);
  const [notice, setNotice] = useState<{ kind: 'info' | 'err'; text: string } | null>(null);
  const [disk, setDisk] = useState(false);
  const [issues, setIssues] = useState<Issue[]>([]);
  const [busy, setBusy] = useState(false);
  const playerRef = useRef<PlayerRef | null>(null);
  const { plan } = state;
  const fps = plan.meta.fps;
  const durationSec = videoDur ?? durationOf({ plan, theme, videoSrc: '' });
  const time = frame / fps;

  useEffect(() => {
    const v = document.createElement('video');
    v.src = `${API}/media/${plan.meta.source}`;
    v.onloadedmetadata = () => setVideoDur(v.duration);
  }, [plan.meta.source]);

  useEffect(() => {
    const p = playerRef.current;
    if (!p) return;
    const h = (e: { detail: { frame: number } }) => setFrame(e.detail.frame);
    p.addEventListener('frameupdate', h);
    return () => p.removeEventListener('frameupdate', h);
  }, []);

  const reload = useCallback(async () => {
    const [p, t] = await Promise.all([getPlan(), getTheme()]);
    setTheme(t); dispatch({ type: 'reload', plan: p }); setDisk(false);
  }, []);
  const dirtyRef = useRef(state.dirty);
  dirtyRef.current = state.dirty;
  useEffect(() => onPlanChanged(() => { if (dirtyRef.current) setDisk(true); else void reload(); }), [reload]);

  const seek = useCallback((t: number) => playerRef.current?.seekTo(Math.round(t * fps)), [fps]);
  /** Saves plan.json; resolves true only when the server accepted it. Validator problems are shown but do not block saving. */
  const save = useCallback(async (): Promise<boolean> => {
    const r = await savePlan(state.plan);
    if (!r.ok) { setIssues(r.issues); setNotice({ kind: 'err', text: 'Không lưu được, plan chưa hợp lệ' }); return false; }
    dispatch({ type: 'saved' });
    const found = await getIssues().catch(() => []);
    setIssues(found);
    const errors = found.filter(i => i.severity === 'error').length;
    setNotice(errors
      ? { kind: 'err', text: `Đã lưu plan.json, nhưng còn ${errors} lỗi sẽ chặn render` }
      : { kind: 'info', text: found.length ? `Đã lưu plan.json (${found.length} cảnh báo)` : 'Đã lưu plan.json' });
    return true;
  }, [state.plan]);
  const render = async () => {
    if (state.dirty && !(await save())) return; // never render a stale plan.json
    setBusy(true); setNotice({ kind: 'info', text: 'Đang render…' });
    const r = await renderVideo();
    setBusy(false);
    setNotice(r.error ? { kind: 'err', text: r.error } : { kind: 'info', text: `Đã render: ${r.out}` });
  };
  const addText = () => dispatch({
    type: 'add',
    layer: { id: `l${Date.now().toString(36)}`, track: 'title', type: 'title-card', start: time, end: time + 2, props: { icon: 'check', title: 'Chữ mới' } },
  });

  useEffect(() => {
    const key = (e: KeyboardEvent) => {
      const typing = ['INPUT', 'TEXTAREA', 'SELECT'].includes((e.target as HTMLElement).tagName);
      if (e.ctrlKey && e.key === 'z') { e.preventDefault(); dispatch({ type: 'undo' }); }
      else if (e.ctrlKey && (e.key === 'y' || (e.shiftKey && e.key === 'Z'))) { e.preventDefault(); dispatch({ type: 'redo' }); }
      else if (e.ctrlKey && e.key === 's') { e.preventDefault(); void save(); }
      else if (!typing && e.key === 'Delete' && state.selectedId) dispatch({ type: 'delete', id: state.selectedId });
      else if (!typing && e.key === ' ') { e.preventDefault(); playerRef.current?.toggle(); }
    };
    window.addEventListener('keydown', key);
    return () => window.removeEventListener('keydown', key);
  }, [save, state.selectedId]);

  const selected = plan.layers.find(l => l.id === state.selectedId);
  return (
    <div className="app">
      <div className="toolbar">
        <button onClick={() => dispatch({ type: 'undo' })} disabled={!state.past.length}>↶ Hoàn tác</button>
        <button onClick={() => dispatch({ type: 'redo' })} disabled={!state.future.length}>↷ Làm lại</button>
        <small>Lịch sử: {state.past.length} bước</small>
        <button className="primary" onClick={addText}>+ Thêm chữ</button>
        <label><input type="checkbox" checked={showSafe} onChange={e => setShowSafe(e.target.checked)} /> Vùng an toàn</label>
        <label><input type="checkbox" checked={showFace} onChange={e => setShowFace(e.target.checked)} /> Vùng mặt</label>
        <label>Zoom <input type="range" min={30} max={240} value={pps} onChange={e => setPps(Number(e.target.value))} /></label>
        <span style={{ flex: 1 }} />
        <small>{plan.meta.style} · {plan.meta.width}×{plan.meta.height}{state.dirty ? ' · chưa lưu' : ''}</small>
        <button className="primary" onClick={() => void save()} disabled={!state.dirty}>Lưu</button>
        <button onClick={() => void render()} disabled={busy}>Render</button>
      </div>
      {disk && (
        <div className="banner">
          plan.json đã đổi trên đĩa trong khi bạn có thay đổi chưa lưu.
          <button onClick={() => setDisk(false)}>Giữ bản của tôi</button>
          <button onClick={() => void reload()}>Tải bản trên đĩa</button>
        </div>
      )}
      {notice && (
        <div className={`banner${notice.kind === 'err' ? ' err' : ''}`}>
          <span style={{ whiteSpace: 'pre-wrap' }}>{notice.text}</span>
          {issues.map((i, k) => <small key={k}>{i.code}: {i.message}</small>)}
          <button onClick={() => { setNotice(null); setIssues([]); }}>Đóng</button>
        </div>
      )}
      <LayerList plan={plan} selectedId={state.selectedId} onPick={l => { dispatch({ type: 'select', id: l.id }); seek(l.start); }} />
      <div className="panel preview">
        <Preview plan={plan} theme={theme} durationSec={durationSec} playerRef={playerRef} showSafe={showSafe} showFace={showFace} />
        <small>{time.toFixed(2)}s / {durationSec.toFixed(2)}s · Space: phát/dừng · Ctrl+Z/Y: hoàn tác · Ctrl+S: lưu</small>
      </div>
      <PropertiesPanel layer={selected} theme={theme} time={time} dispatch={dispatch} />
      <Timeline plan={plan} selectedId={state.selectedId} pps={pps} durationSec={durationSec} time={time}
        onSelect={id => dispatch({ type: 'select', id })} onSeek={seek}
        onMove={(id, start) => dispatch({ type: 'move', id, start })}
        onResize={(id, edge, t) => dispatch({ type: 'resize', id, edge, time: t })} />
    </div>
  );
}
