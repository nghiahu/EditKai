import React from 'react';
import { AbsoluteFill, useCurrentFrame, useVideoConfig } from 'remotion';
import { AnimatedIcon } from '../icons';
import { clamp01, drawProgress, enterExit, pop, staggerDelay } from '../motion';
import type { LayerComponent } from '../registry';

type Chip = { icon?: string; label: string; sub?: string };

const SHINE_AFTER = 10; // frames after a chip starts entering
const SHINE_FRAMES = 14;

export const ChipStack: LayerComponent = ({ layer, theme }) => {
  const frame = useCurrentFrame();
  const { fps, width, height, durationInFrames } = useVideoConfig();
  const chips = ((layer.props ?? {}) as { chips?: Chip[] }).chips ?? [];
  const m1 = theme.name === 'm1';
  const accent = m1 ? theme.colors.yellow : theme.colors.teal;
  const { safeZone } = theme.limits;
  const { visible, exit } = enterExit(frame, durationInFrames, theme.motion, fps);

  return (
    <AbsoluteFill>
      <div style={{ position: 'absolute', top: height * safeZone.top, left: width * safeZone.left, display: 'flex', flexDirection: 'column', gap: 14 }}>
        {chips.map((c, i) => {
          const delay = staggerDelay(i, theme.motion);
          const enter = pop(frame, fps, theme.motion, delay);
          const p = clamp01(enter);
          const shine = drawProgress(frame, delay + SHINE_AFTER, SHINE_FRAMES);
          const shining = shine > 0 && shine < 1;
          return (
            <div
              key={i}
              style={{
                position: 'relative', overflow: 'hidden', alignSelf: 'flex-start',
                display: 'flex', alignItems: 'center', gap: 14, padding: '12px 22px', borderRadius: theme.radius,
                background: 'rgba(10,10,10,0.78)', border: `2px solid ${accent}`, color: theme.colors.white,
                fontFamily: theme.fonts.heading,
                opacity: p * visible,
                transform: `translateX(${-(1 - enter) * 50 - exit * 30}px) scale(${0.8 + 0.2 * enter})`,
              }}
            >
              <AnimatedIcon name={c.icon ?? 'check'} size={36} color={accent} progress={clamp01((frame - delay) / 16)} />
              <div>
                <div style={{ fontSize: 32, fontWeight: 700 }}>{c.label}</div>
                {c.sub ? <div style={{ fontSize: 20, opacity: 0.75 }}>{c.sub}</div> : null}
              </div>
              {shining ? (
                <div
                  style={{
                    position: 'absolute', top: 0, bottom: 0, width: '40%', left: `${-40 + 180 * shine}%`,
                    background: 'linear-gradient(100deg, transparent, rgba(255,255,255,0.35), transparent)', pointerEvents: 'none',
                  }}
                />
              ) : null}
            </div>
          );
        })}
      </div>
    </AbsoluteFill>
  );
};
