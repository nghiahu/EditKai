import React from 'react';
import { useVideoConfig } from 'remotion';

const BAR = 44;

/** App-window card: rounded, with a 44 px title bar (three dots and an optional centred title) above a 16:10 media area. */
export const WindowFrame: React.FC<{ title?: string; children: React.ReactNode }> = ({ title, children }) => {
  const { width, height } = useVideoConfig();
  return (
    <div
      style={{
        // a landscape window (16:10 body) in the upper part of the frame, like the demo's app windows
        position: 'absolute', left: width * 0.08, width: width * 0.84, top: height * 0.2, height: width * 0.84 * 0.625 + BAR,
        borderRadius: 20, overflow: 'hidden', background: '#111', boxShadow: '0 30px 80px rgba(0,0,0,0.55)',
        display: 'flex', flexDirection: 'column',
      }}
    >
      <div style={{ position: 'relative', height: BAR, flexShrink: 0, background: '#1e1e1e', display: 'flex', alignItems: 'center', padding: '0 16px', gap: 8 }}>
        {['#ff5f57', '#febc2e', '#28c840'].map(c => <span key={c} style={{ width: 12, height: 12, borderRadius: 6, background: c }} />)}
        {title ? (
          <span style={{ position: 'absolute', left: 80, right: 80, textAlign: 'center', fontSize: 18, color: '#bbb', fontFamily: 'sans-serif', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{title}</span>
        ) : null}
      </div>
      <div style={{ position: 'relative', flex: 1, overflow: 'hidden' }}>{children}</div>
    </div>
  );
};
