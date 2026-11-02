import React from 'react';
import { AbsoluteFill, OffthreadVideo, interpolate, useCurrentFrame, useVideoConfig } from 'remotion';
import { Icon } from '../icons';
import type { LayerComponent } from '../registry';

type Props = { label?: string; title?: string; body?: { kind: 'list' | 'card'; items: string[] }; avatar?: boolean };

export const ExplainerScene: LayerComponent = ({ layer, theme, videoSrc }) => {
  const frame = useCurrentFrame();
  const { fps, width, height } = useVideoConfig();
  const p = (layer.props ?? {}) as Props;
  const m1 = theme.name === 'm1';
  const accent = m1 ? theme.colors.yellow : theme.colors.teal;
  const dur = (theme.animMs / 1000) * fps;
  const { safeZone } = theme.limits;
  const items = p.body?.items ?? [];
  const row = { padding: '22px 28px', borderRadius: theme.radius, background: 'rgba(255,255,255,0.07)', border: `1px solid ${accent}55`, fontSize: 38 };
  return (
    <AbsoluteFill style={{
      background: m1 ? theme.colors.black : `linear-gradient(180deg, ${theme.colors.navy}, #060c1d)`,
      color: theme.colors.white, fontFamily: theme.fonts.heading,
      padding: `${height * safeZone.top}px ${width * safeZone.left}px`,
    }}>
      {p.avatar ? (
        <div style={{ position: 'absolute', top: height * safeZone.top, right: width * safeZone.right, width: 150, height: 150, borderRadius: '50%',
          overflow: 'hidden', border: `4px solid ${accent}`, background: `${accent}33` }}>
          {videoSrc ? <OffthreadVideo src={videoSrc} muted style={{ width: '100%', height: '100%', objectFit: 'cover', objectPosition: 'center 25%' }} /> : null}
        </div>
      ) : null}
      {p.label ? <div style={{ fontSize: 26, letterSpacing: 3, color: accent, fontWeight: 700 }}>{p.label}</div> : null}
      <div style={{ fontSize: 76, fontWeight: 800, lineHeight: 1.05, marginTop: 14, color: m1 ? accent : theme.colors.white }}>{p.title}</div>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 18, marginTop: 56 }}>
        {p.body?.kind === 'card' ? (
          <div style={{ ...row, lineHeight: 1.4 }}>{items.map((t, i) => <div key={i}>{t}</div>)}</div>
        ) : items.map((t, i) => {
          const o = interpolate(frame, [i * 6, i * 6 + dur], [0, 1], { extrapolateLeft: 'clamp', extrapolateRight: 'clamp' });
          return (
            <div key={i} style={{ ...row, display: 'flex', alignItems: 'center', gap: 18, opacity: o, transform: `translateY(${(1 - o) * 24}px)` }}>
              <Icon name="check" size={40} color={accent} />{t}
            </div>
          );
        })}
      </div>
    </AbsoluteFill>
  );
};
