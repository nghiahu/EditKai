import React from 'react';
import { AbsoluteFill, useCurrentFrame, useVideoConfig } from 'remotion';
import { resolvePromptBox } from '../../src/plan/insertTypes';
import { clamp01, drawProgress, enterExit } from '../motion';
import { typedText, typingDoneFrame } from '../promptTyping';
import type { LayerComponent } from '../registry';
import { insertBox } from './insertLayout';

const BLINK_FRAMES = 15;
const STRIKE_DELAY_SEC = 0.4;
const STRIKE_FRAMES = 12;

/** Chat-style input pill: the text is typed with a blinking cursor; with `strike` a line is drawn through it afterwards. */
export const PromptBox: LayerComponent = ({ layer, theme }) => {
  const frame = useCurrentFrame();
  const { fps, width, height, durationInFrames } = useVideoConfig();
  const r = resolvePromptBox(layer.props);
  const m1 = theme.name === 'm1';
  const accent = m1 ? theme.colors.yellow : theme.colors.teal;
  const { enter, visible } = enterExit(frame, durationInFrames, theme.motion, fps);
  const e = clamp01(enter);
  const typed = typedText(r.text, frame, fps);
  const done = frame >= typingDoneFrame(r.text, fps);
  const strikeAt = typingDoneFrame(r.text, fps) + Math.round(STRIKE_DELAY_SEC * fps);
  const strike = r.strike ? drawProgress(frame, strikeAt, STRIKE_FRAMES) : 0;
  const cursor = !done && Math.floor(frame / BLINK_FRAMES) % 2 === 0;

  return (
    <AbsoluteFill style={{ opacity: visible }}>
      <div style={{ ...insertBox(r.position, theme, width, height), fontFamily: theme.fonts.body }}>
        <div
          style={{
            width: '100%', minHeight: 110, boxSizing: 'border-box', padding: '28px 32px', display: 'flex', alignItems: 'center', gap: 24,
            background: '#fff', borderRadius: 56, boxShadow: '0 20px 60px rgba(0,0,0,0.45)',
            transform: `translateY(${(1 - e) * -30}px) scale(${0.9 + 0.1 * e})`,
          }}
        >
          <div style={{ position: 'relative', flex: 1, fontSize: 40, lineHeight: 1.3, color: strike > 0.5 ? '#9a9a9a' : '#111', overflowWrap: 'anywhere' }}>
            {typed.length === 0 && r.placeholder ? <span style={{ color: '#9a9a9a' }}>{r.placeholder}</span> : typed}
            {cursor ? <span style={{ display: 'inline-block', width: 3, height: '1.1em', marginLeft: 3, verticalAlign: 'text-bottom', background: '#111' }} /> : null}
            {strike > 0 ? (
              <span style={{ position: 'absolute', left: 0, right: 0, top: '50%', height: 5, borderRadius: 3, background: '#e5383b', transformOrigin: 'left center', transform: `scaleX(${strike})` }} />
            ) : null}
          </div>
          <div style={{ flexShrink: 0, width: 72, height: 72, borderRadius: 36, background: accent, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
            <svg width={36} height={36} viewBox="0 0 24 24" fill="none" stroke={theme.colors.black ?? theme.colors.navy ?? '#0A0A0A'} strokeWidth={3} strokeLinecap="round" strokeLinejoin="round">
              <path d="M12 19V5M5 12l7-7 7 7" />
            </svg>
          </div>
        </div>
      </div>
    </AbsoluteFill>
  );
};
