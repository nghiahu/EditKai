import React from 'react';
import { AbsoluteFill, useVideoConfig } from 'remotion';

/** Phone card: 9:19.5, radius 56 px, 10 px dark border and a notch; the media fills the screen. */
export const PhoneFrame: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const { height } = useVideoConfig();
  const h = height * 0.64;
  return (
    <AbsoluteFill style={{ alignItems: 'center', justifyContent: 'center' }}>
      <div
        style={{
          position: 'relative', width: (h * 9) / 19.5, height: h, borderRadius: 56, border: '10px solid #111', background: '#111',
          overflow: 'hidden', boxShadow: '0 30px 80px rgba(0,0,0,0.55)',
        }}
      >
        <div style={{ position: 'absolute', inset: 0, overflow: 'hidden' }}>{children}</div>
        <div style={{ position: 'absolute', top: 10, left: '50%', width: 120, height: 28, marginLeft: -60, borderRadius: 14, background: '#111', zIndex: 2 }} />
      </div>
    </AbsoluteFill>
  );
};
