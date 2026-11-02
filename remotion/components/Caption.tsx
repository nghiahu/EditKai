import React from 'react';
import { AbsoluteFill, useVideoConfig } from 'remotion';
import type { LayerComponent } from '../registry';

export const Caption: LayerComponent = ({ layer, theme }) => {
  const { width, height } = useVideoConfig();
  const m1 = theme.name === 'm1';
  const { safeZone } = theme.limits;
  const accent = m1 ? theme.colors.yellow : theme.colors.teal;
  return (
    <AbsoluteFill>
      <div
        style={{
          position: 'absolute',
          left: width * safeZone.left,
          right: width * safeZone.right,
          bottom: m1 ? height * 0.28 : height * safeZone.bottom,
          textAlign: 'center',
          fontFamily: theme.fonts.body,
          fontWeight: m1 ? 800 : 600,
          fontSize: theme.captionSize,
          lineHeight: 1.25,
          color: theme.colors.white,
          textShadow: '0 2px 8px rgba(0,0,0,0.6)',
        }}
      >
        {(layer.words ?? []).map((w, i) => (
          <span
            key={i}
            style={
              w.hl
                ? m1
                  ? { background: accent, color: theme.colors.black, padding: '0 12px', borderRadius: theme.radius, textShadow: 'none', marginRight: 10 }
                  : { color: accent, marginRight: 10 }
                : { marginRight: 10 }
            }
          >
            {w.t}
          </span>
        ))}
      </div>
    </AbsoluteFill>
  );
};
