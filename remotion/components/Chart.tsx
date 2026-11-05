import React from 'react';
import { AbsoluteFill, useCurrentFrame, useVideoConfig } from 'remotion';
import { formatCount } from '../../src/plan/counter';
import { resolveChart } from '../../src/plan/insertTypes';
import { breathe, clamp01, drawProgress, easeOut, enterExit, staggerDelay } from '../motion';
import type { LayerComponent } from '../registry';
import { insertBox } from './insertLayout';

const PLOT_PX = 280;
const PADDING = 36;
const LEAD_FRAMES = 4;
const GROW_FRAMES = 16;
const DIM = 'rgba(255,255,255,0.35)';

const fmt = (value: number, unit?: string) => `${formatCount(value, Number.isInteger(value) ? 0 : 1)}${unit ? ` ${unit}` : ''}`;

/** A dark card with a chart of a few numbers that draws itself in (bars grow one after another, or a line is drawn through dots); the source is printed on it. */
export const Chart: LayerComponent = ({ layer, theme }) => {
  const frame = useCurrentFrame();
  const { fps, width, height, durationInFrames } = useVideoConfig();
  const r = resolveChart(layer.props);
  const m1 = theme.name === 'm1';
  const accent = m1 ? theme.colors.yellow : theme.colors.teal;
  const { enter, visible } = enterExit(frame, durationInFrames, theme.motion, fps);
  const e = clamp01(enter);
  const max = Math.max(1, ...r.points.map(p => p.value));
  const top = r.points.reduce((best, p, i) => (p.value > r.points[best].value ? i : best), 0);
  const sz = theme.limits.safeZone;
  const plotW = width * (1 - sz.left - sz.right) - PADDING * 2;
  const n = r.points.length;
  const progress = (i: number) => easeOut(clamp01((frame - LEAD_FRAMES - staggerDelay(i, theme.motion)) / GROW_FRAMES));
  const label = (i: number) => clamp01((progress(i) - 0.6) / 0.4);
  const xAt = (i: number) => (plotW * (i + 0.5)) / Math.max(1, n);
  const yAt = (v: number) => PLOT_PX - (v / max) * (PLOT_PX - 40);
  const lineD = r.points.map((p, i) => `${i === 0 ? 'M' : 'L'}${xAt(i).toFixed(1)} ${yAt(p.value).toFixed(1)}`).join(' ');
  const lineP = drawProgress(frame, LEAD_FRAMES, GROW_FRAMES * 2);

  return (
    <AbsoluteFill style={{ opacity: visible }}>
      <div style={{ ...insertBox(r.position, theme, width, height), fontFamily: theme.fonts.heading, color: theme.colors.white }}>
        <div style={{
          width: '100%', boxSizing: 'border-box', padding: PADDING, borderRadius: 36, background: m1 ? 'rgba(10,10,10,0.92)' : 'rgba(11,21,48,0.92)',
          border: `2px solid ${accent}`, boxShadow: '0 30px 80px rgba(0,0,0,0.55)', transform: `translateY(${(1 - e) * 40}px) scale(${(0.94 + 0.06 * e) * breathe(frame, fps)})`,
        }}>
          {r.title ? <div style={{ fontSize: 28, letterSpacing: 3, fontWeight: 700, color: accent, textTransform: 'uppercase', overflowWrap: 'anywhere', marginBottom: 18 }}>{r.title}</div> : null}
          {r.kind === 'bar' ? (
            <div style={{ display: 'flex', alignItems: 'flex-end', gap: 16, height: PLOT_PX }}>
              {r.points.map((p, i) => (
                <div key={i} style={{ flex: 1, minWidth: 0, height: '100%', display: 'flex', flexDirection: 'column', justifyContent: 'flex-end', alignItems: 'center' }}>
                  <div style={{ fontSize: 30, fontWeight: 800, opacity: label(i), marginBottom: 8, whiteSpace: 'nowrap' }}>{fmt(p.value, r.unit)}</div>
                  <div style={{ width: '100%', height: Math.max(4, ((PLOT_PX - 60) * p.value) / max) * progress(i), borderRadius: 12, background: i === top ? accent : DIM }} />
                </div>
              ))}
            </div>
          ) : (
            <svg width={plotW} height={PLOT_PX} viewBox={`0 0 ${plotW} ${PLOT_PX}`} style={{ display: 'block', overflow: 'visible' }}>
              <path d={lineD} fill="none" stroke={accent} strokeWidth={8} strokeLinecap="round" strokeLinejoin="round" pathLength={1} strokeDasharray={1} strokeDashoffset={1 - lineP} />
              {r.points.map((p, i) => (
                <g key={i} opacity={clamp01(lineP * n - i)}>
                  <circle cx={xAt(i)} cy={yAt(p.value)} r={i === top ? 14 : 10} fill={i === top ? accent : '#fff'} />
                  <text x={xAt(i)} y={yAt(p.value) - 24} textAnchor="middle" fontSize={30} fontWeight={800} fill={theme.colors.white} fontFamily={theme.fonts.heading}>{fmt(p.value, r.unit)}</text>
                </g>
              ))}
            </svg>
          )}
          <div style={{ display: 'flex', gap: r.kind === 'bar' ? 16 : 0, marginTop: 14 }}>
            {r.points.map((p, i) => (
              <div key={i} style={{ flex: 1, minWidth: 0, textAlign: 'center', fontSize: 26, fontWeight: 700, opacity: 0.85, overflowWrap: 'anywhere' }}>{p.label}</div>
            ))}
          </div>
          {r.source ? <div style={{ marginTop: 18, fontSize: 22, opacity: 0.7, textAlign: 'right', overflowWrap: 'anywhere' }}>Nguồn: {r.source}</div> : null}
        </div>
      </div>
    </AbsoluteFill>
  );
};
