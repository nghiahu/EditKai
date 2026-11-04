import React from 'react';
import { AbsoluteFill, useCurrentFrame, useVideoConfig } from 'remotion';
import { counterValue, formatCount } from '../../src/plan/counter';
import { resolveCounter } from '../../src/plan/insertTypes';
import { clamp01, drawProgress, easeOut, enterExit, pop } from '../motion';
import type { LayerComponent } from '../registry';
import { insertBox } from './insertLayout';

const NUMBER_SIZE = 170;
const FIT_CHARS = 9; // text longer than this shrinks so it stays inside the frame
const LEAD_FRAMES = 6;
const COUNT_SHARE = 0.6; // the count is done by this share of the layer, then the number holds still

/** A big number that counts from `from` to `to` (Vietnamese format), with an optional prefix, suffix and label; no card, it sits on the dimmed picture. */
export const Counter: LayerComponent = ({ layer, theme }) => {
  const frame = useCurrentFrame();
  const { fps, width, height, durationInFrames } = useVideoConfig();
  const r = resolveCounter(layer.props);
  const m1 = theme.name === 'm1';
  const accent = m1 ? theme.colors.yellow : theme.colors.teal;
  const { visible } = enterExit(frame, durationInFrames, theme.motion, fps);
  const scale = 0.85 + 0.15 * clamp01(pop(frame, fps, theme.motion, 0));
  const progress = easeOut(clamp01((frame - LEAD_FRAMES) / Math.max(1, COUNT_SHARE * durationInFrames - LEAD_FRAMES)));
  const text = `${r.prefix ?? ''}${formatCount(counterValue(progress, r.from, r.to, r.decimals), r.decimals)}${r.suffix ?? ''}`;
  const size = text.length > FIT_CHARS ? Math.max(48, (NUMBER_SIZE * FIT_CHARS) / text.length) : NUMBER_SIZE;

  return (
    <AbsoluteFill style={{ opacity: visible }}>
      <div style={{ ...insertBox(r.position, theme, width, height), fontFamily: theme.fonts.heading, color: theme.colors.white, textAlign: 'center' }}>
        <div style={{ transform: `scale(${scale})`, maxWidth: '100%' }}>
          <div style={{ fontSize: size, fontWeight: 900, lineHeight: 1.05, fontVariantNumeric: 'tabular-nums', color: theme.colors.white, textShadow: '0 6px 30px rgba(0,0,0,0.6)', overflowWrap: 'anywhere' }}>{text}</div>
          <div style={{ margin: '14px auto 0', height: 8, width: '45%', borderRadius: 4, background: accent, transformOrigin: 'left center', transform: `scaleX(${drawProgress(frame, LEAD_FRAMES, 14)})` }} />
          {r.label ? <div style={{ marginTop: 22, fontSize: 40, letterSpacing: 4, fontWeight: 700, color: accent, textTransform: 'uppercase', overflowWrap: 'anywhere' }}>{r.label}</div> : null}
        </div>
      </div>
    </AbsoluteFill>
  );
};
