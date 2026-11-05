import React from 'react';
import { AbsoluteFill, useCurrentFrame, useVideoConfig } from 'remotion';
import { resolveCallout } from '../../src/plan/insertTypes';
import { clamp01, drawProgress, enterExit } from '../motion';
import type { LayerComponent } from '../registry';

const STROKE = 9;
const LEAD_FRAMES = 2;
const RING_DRAW_FRAMES = 14;
const ARROW_DRAW_FRAMES = 12;
const HEAD_AFTER = 0.8; // the arrowhead appears when the shaft is this much drawn
const LABEL_FONT = 34;
const MARGIN = 24;

/** A hand-drawn ring: an ellipse with a little wobble that starts and ends a bit past itself, like a marker. */
function ringPath(cx: number, cy: number, rx: number, ry: number): string {
  const points: string[] = [];
  const steps = 72;
  const start = -Math.PI * 0.65;
  const turn = Math.PI * 2 * 1.06;
  for (let i = 0; i <= steps; i++) {
    const t = start + (turn * i) / steps;
    const wobble = 1 + 0.035 * Math.sin(3 * t + 0.7) + 0.025 * Math.sin(5 * t + 2.1) + 0.04 * (i / steps); // drifts outwards, as a hand does
    points.push(`${i === 0 ? 'M' : 'L'}${(cx + rx * wobble * Math.cos(t)).toFixed(1)} ${(cy + ry * wobble * Math.sin(t)).toFixed(1)}`);
  }
  return points.join(' ');
}

/** A circle (ring) or an arrow (arrow) drawn on the picture at a point, with an optional small label: for pointing at something in footage. */
export const Callout: LayerComponent = ({ layer, theme }) => {
  const frame = useCurrentFrame();
  const { fps, width, height, durationInFrames } = useVideoConfig();
  const r = resolveCallout(layer.props);
  const accent = theme.name === 'm1' ? theme.colors.yellow : theme.colors.teal;
  const ink = r.color === 'white' ? '#FFFFFF' : accent;
  const { visible } = enterExit(frame, durationInFrames, theme.motion, fps);
  const px = r.x * width;
  const py = r.y * height;
  const size = r.size * width;

  let shape: React.ReactNode;
  let label: { x: number; y: number } | undefined;
  if (r.kind === 'ring') {
    const rx = size / 2;
    const ry = rx * 0.8;
    const d = ringPath(px, py, rx, ry);
    const p = drawProgress(frame, LEAD_FRAMES, RING_DRAW_FRAMES);
    shape = [['#000', STROKE + 6, 0.45], [ink, STROKE, 1]].map(([color, w, o], i) => (
      <path key={i} d={d} fill="none" stroke={color as string} strokeWidth={w as number} strokeOpacity={o as number} strokeLinecap="round" strokeLinejoin="round" pathLength={1} strokeDasharray={1} strokeDashoffset={1 - p} />
    ));
    label = { x: px, y: py + ry + 44 };
  } else {
    const a = (r.angle * Math.PI) / 180;
    const dirX = Math.cos(a);
    const dirY = -Math.sin(a); // up on the screen is negative y
    const tailX = px + dirX * size;
    const tailY = py + dirY * size;
    const cx = (tailX + px) / 2 - dirY * size * 0.12; // a slight bend, like a drawn arrow
    const cy = (tailY + py) / 2 + dirX * size * 0.12;
    const d = `M${tailX.toFixed(1)} ${tailY.toFixed(1)} Q${cx.toFixed(1)} ${cy.toFixed(1)} ${px.toFixed(1)} ${py.toFixed(1)}`;
    const p = drawProgress(frame, LEAD_FRAMES, ARROW_DRAW_FRAMES);
    const tx = px - cx; // the way the shaft is heading at the tip
    const ty = py - cy;
    const head = Math.max(34, size * 0.22);
    const arm = (turn: number) => {
      const ang = Math.atan2(-ty, -tx) + turn; // back along the shaft, turned
      return `M${px.toFixed(1)} ${py.toFixed(1)} L${(px + head * Math.cos(ang)).toFixed(1)} ${(py + head * Math.sin(ang)).toFixed(1)}`;
    };
    const headOpacity = clamp01((p - HEAD_AFTER) / (1 - HEAD_AFTER));
    shape = [['#000', STROKE + 6, 0.45], [ink, STROKE, 1]].map(([color, w, o], i) => (
      <g key={i} fill="none" stroke={color as string} strokeWidth={w as number} strokeOpacity={o as number} strokeLinecap="round" strokeLinejoin="round">
        <path d={d} pathLength={1} strokeDasharray={1} strokeDashoffset={1 - p} />
        <path d={`${arm(0.5)} ${arm(-0.5)}`} opacity={headOpacity} />
      </g>
    ));
    label = { x: tailX + dirX * 48, y: tailY + dirY * 48 };
  }

  const pillW = r.label ? r.label.length * LABEL_FONT * 0.6 + 56 : 0;
  const labelX = label ? Math.min(width - MARGIN - pillW / 2, Math.max(MARGIN + pillW / 2, label.x)) : 0;
  const labelY = label ? Math.min(height - MARGIN - LABEL_FONT, Math.max(MARGIN + LABEL_FONT, label.y)) : 0;
  const labelIn = clamp01((frame - LEAD_FRAMES - 6) / 8);

  return (
    <AbsoluteFill style={{ opacity: visible }}>
      <svg width={width} height={height} viewBox={`0 0 ${width} ${height}`} style={{ position: 'absolute', inset: 0 }}>{shape}</svg>
      {r.label ? (
        <div style={{ position: 'absolute', left: labelX, top: labelY, transform: `translate(-50%, -50%) scale(${0.85 + 0.15 * labelIn})`, opacity: labelIn,
          padding: '10px 26px', borderRadius: 999, fontFamily: theme.fonts.heading, fontSize: LABEL_FONT, fontWeight: 700, whiteSpace: 'nowrap', color: theme.colors.white,
          background: 'rgba(10,10,10,0.88)', border: `2px solid ${ink}` }}>
          {r.label}
        </div>
      ) : null}
    </AbsoluteFill>
  );
};
