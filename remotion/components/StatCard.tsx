import React from 'react';
import { AbsoluteFill, useCurrentFrame, useVideoConfig } from 'remotion';
import { resolveStatCard } from '../../src/plan/insertTypes';
import { AnimatedIcon } from '../icons';
import { breathe, clamp01, enterExit, pop, staggerDelay } from '../motion';
import type { LayerComponent } from '../registry';
import { insertBox } from './insertLayout';

const VALUE_SIZE = 84;
const FIT_CHARS = 12; // values longer than this shrink so they stay inside the card

/** Dark card of 1-4 rows (icon, big value, small caption); rows arrive one after another. */
export const StatCard: LayerComponent = ({ layer, theme }) => {
  const frame = useCurrentFrame();
  const { fps, width, height, durationInFrames } = useVideoConfig();
  const r = resolveStatCard(layer.props);
  const m1 = theme.name === 'm1';
  const accent = m1 ? theme.colors.yellow : theme.colors.teal;
  const { enter, visible } = enterExit(frame, durationInFrames, theme.motion, fps);
  const e = clamp01(enter);

  return (
    <AbsoluteFill style={{ opacity: visible }}>
      <div style={{ ...insertBox(r.position, theme, width, height), fontFamily: theme.fonts.heading, color: theme.colors.white }}>
        <div
          style={{
            width: '100%', boxSizing: 'border-box', padding: 36, borderRadius: 36, display: 'flex', flexDirection: 'column', gap: 28,
            background: m1 ? 'rgba(10,10,10,0.92)' : 'rgba(11,21,48,0.92)', border: `2px solid ${accent}`, boxShadow: '0 30px 80px rgba(0,0,0,0.55)',
            transform: `translateY(${(1 - e) * 40}px) scale(${(0.94 + 0.06 * e) * breathe(frame, fps)})`,
          }}
        >
          {r.title ? <div style={{ fontSize: 28, letterSpacing: 3, fontWeight: 700, color: accent, textTransform: 'uppercase', overflowWrap: 'anywhere' }}>{r.title}</div> : null}
          {r.rows.map((row, i) => {
            const delay = staggerDelay(i, theme.motion) + 4;
            const o = clamp01(pop(frame, fps, theme.motion, delay));
            const size = row.value.length > FIT_CHARS ? Math.max(32, (VALUE_SIZE * FIT_CHARS) / row.value.length) : VALUE_SIZE;
            return (
              <div key={i} style={{ display: 'flex', alignItems: 'center', gap: 28, opacity: o, transform: `translateX(${(1 - o) * -40}px)` }}>
                {row.icon ? <AnimatedIcon name={row.icon} size={72} color={accent} progress={clamp01((frame - delay) / 16)} /> : null}
                <div style={{ minWidth: 0, flex: 1 }}>
                  <div style={{ fontSize: size, fontWeight: 800, lineHeight: 1.05, overflowWrap: 'anywhere' }}>{row.value}</div>
                  {row.caption ? <div style={{ fontSize: 28, opacity: 0.8, marginTop: 8, overflowWrap: 'anywhere' }}>{row.caption}</div> : null}
                </div>
              </div>
            );
          })}
        </div>
      </div>
    </AbsoluteFill>
  );
};
