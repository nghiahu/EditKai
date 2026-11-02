import React from 'react';
import { AbsoluteFill, interpolate, useCurrentFrame, useVideoConfig } from 'remotion';
import { Icon } from '../icons';
import type { LayerComponent } from '../registry';

export const TitleCard: LayerComponent = ({ layer, theme }) => {
  const frame = useCurrentFrame();
  const { fps, width, height } = useVideoConfig();
  const p = (layer.props ?? {}) as { icon?: string; title?: string; sub?: string };
  const m1 = theme.name === 'm1';
  const accent = m1 ? theme.colors.yellow : theme.colors.teal;
  const t = interpolate(frame, [0, (theme.animMs / 1000) * fps], [0, 1], { extrapolateRight: 'clamp' });
  const { safeZone } = theme.limits;
  return (
    <AbsoluteFill>
      <div
        style={{
          position: 'absolute',
          top: height * safeZone.top,
          left: width * safeZone.left,
          display: 'flex',
          alignItems: 'center',
          gap: 20,
          padding: '20px 28px',
          borderRadius: theme.radius,
          background: m1 ? 'rgba(10,10,10,0.85)' : 'rgba(11,21,48,0.72)',
          border: `2px solid ${accent}`,
          color: theme.colors.white,
          fontFamily: theme.fonts.heading,
          opacity: t,
          transform: `translateY(${(1 - t) * -24}px)`,
        }}
      >
        <Icon name={p.icon ?? 'check'} size={56} color={accent} />
        <div>
          <div style={{ fontSize: 44, fontWeight: 800, lineHeight: 1.1, color: m1 ? accent : theme.colors.white }}>{p.title}</div>
          {p.sub ? <div style={{ fontSize: 26, opacity: 0.8, marginTop: 6 }}>{p.sub}</div> : null}
        </div>
      </div>
    </AbsoluteFill>
  );
};
