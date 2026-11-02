import React from 'react';
import { AbsoluteFill, interpolate, useCurrentFrame, useVideoConfig } from 'remotion';
import { Icon } from '../icons';
import type { LayerComponent } from '../registry';

type Chip = { icon?: string; label: string; sub?: string };

export const ChipStack: LayerComponent = ({ layer, theme }) => {
  const frame = useCurrentFrame();
  const { fps, width, height } = useVideoConfig();
  const chips = ((layer.props ?? {}) as { chips?: Chip[] }).chips ?? [];
  const m1 = theme.name === 'm1';
  const accent = m1 ? theme.colors.yellow : theme.colors.teal;
  const dur = (theme.animMs / 1000) * fps;
  const { safeZone } = theme.limits;
  return (
    <AbsoluteFill>
      <div style={{ position: 'absolute', top: height * safeZone.top, left: width * safeZone.left, display: 'flex', flexDirection: 'column', gap: 14 }}>
        {chips.map((c, i) => {
          const t = interpolate(frame, [i * 4, i * 4 + dur], [0, 1], { extrapolateLeft: 'clamp', extrapolateRight: 'clamp' });
          return (
            <div
              key={i}
              style={{
                display: 'flex', alignItems: 'center', gap: 14, padding: '12px 22px', borderRadius: theme.radius,
                background: 'rgba(10,10,10,0.78)', border: `2px solid ${accent}`, color: theme.colors.white,
                fontFamily: theme.fonts.heading, opacity: t, transform: `translateX(${(1 - t) * -40}px)`, alignSelf: 'flex-start',
              }}
            >
              <Icon name={c.icon ?? 'check'} size={36} color={accent} />
              <div>
                <div style={{ fontSize: 32, fontWeight: 700 }}>{c.label}</div>
                {c.sub ? <div style={{ fontSize: 20, opacity: 0.75 }}>{c.sub}</div> : null}
              </div>
            </div>
          );
        })}
      </div>
    </AbsoluteFill>
  );
};
