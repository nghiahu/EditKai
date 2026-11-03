import React, { useState } from 'react';
import { AbsoluteFill, Img, useCurrentFrame, useVideoConfig } from 'remotion';
import { resolveLogoBadge } from '../../src/plan/insertTypes';
import { assetUrl } from '../assetUrl';
import { AnimatedIcon } from '../icons';
import { clamp01, enterExit } from '../motion';
import type { LayerComponent } from '../registry';
import { insertBox } from './insertLayout';

const BADGE = 220;
const BURST_FRAMES = 16;
const RAYS = 8;

/** App-icon style badge: springs in with a ray burst, floats gently, optional label pill above and sub-line below. */
export const LogoBadge: LayerComponent = ({ layer, theme, assetBase }) => {
  const [imageFailed, setImageFailed] = useState(false);
  const frame = useCurrentFrame();
  const { fps, width, height, durationInFrames } = useVideoConfig();
  const r = resolveLogoBadge(layer.props);
  const m1 = theme.name === 'm1';
  const accent = m1 ? theme.colors.yellow : theme.colors.teal;
  const ink = theme.colors.black ?? theme.colors.navy ?? '#0A0A0A';
  const { enter, exit, visible } = enterExit(frame, durationInFrames, theme.motion, fps);
  const e = clamp01(enter);
  const bob = Math.sin(frame / 12) * 8 * e;
  const burst = frame > 0 && frame < BURST_FRAMES ? frame / BURST_FRAMES : 0;
  const useImage = r.src !== undefined && !imageFailed;

  return (
    <AbsoluteFill style={{ opacity: visible }}>
      <div style={{ ...insertBox(r.position, theme, width, height), fontFamily: theme.fonts.heading, color: theme.colors.white }}>
        {r.label ? (
          <div style={{ maxWidth: width * 0.88, textAlign: 'center', padding: '10px 24px', borderRadius: 999, marginBottom: 24, fontSize: 34, fontWeight: 700,
            background: m1 ? 'rgba(10,10,10,0.85)' : 'rgba(11,21,48,0.8)', border: `2px solid ${accent}`, opacity: e,
            transform: `translateY(${(1 - e) * -20}px)` }}>
            {r.label}
          </div>
        ) : null}
        <div style={{ position: 'relative', width: BADGE, height: BADGE, transform: `translateY(${bob}px) scale(${0.5 + 0.5 * Math.max(0, enter) + 0.03 * exit})` }}>
          {burst > 0 ? (
            <svg width={BADGE * 2} height={BADGE * 2} viewBox="-100 -100 200 200" style={{ position: 'absolute', left: -BADGE / 2, top: -BADGE / 2, overflow: 'visible' }}>
              {Array.from({ length: RAYS }, (_, k) => {
                const a = (k * 2 * Math.PI) / RAYS;
                const inner = 60 + 40 * burst, outer = inner + 18 * (1 - burst);
                return <line key={k} x1={inner * Math.cos(a)} y1={inner * Math.sin(a)} x2={outer * Math.cos(a)} y2={outer * Math.sin(a)} stroke={accent} strokeWidth={4} strokeLinecap="round" opacity={1 - burst} />;
              })}
            </svg>
          ) : null}
          <div style={{ width: '100%', height: '100%', borderRadius: 52, overflow: 'hidden', display: 'flex', alignItems: 'center', justifyContent: 'center',
            background: useImage ? '#fff' : accent, boxShadow: '0 20px 60px rgba(0,0,0,0.5)' }}>
            {useImage ? (
              <Img src={assetUrl(assetBase ?? '', r.src!)} style={{ width: '100%', height: '100%', objectFit: 'cover' }} maxRetries={0} onError={() => setImageFailed(true)} />
            ) : (
              <AnimatedIcon name={r.icon} size={120} color={ink} progress={clamp01(frame / 18)} />
            )}
          </div>
        </div>
        {r.sub ? <div style={{ maxWidth: width * 0.88, textAlign: 'center', marginTop: 20, fontSize: 26, opacity: 0.85 * e }}>{r.sub}</div> : null}
      </div>
    </AbsoluteFill>
  );
};
