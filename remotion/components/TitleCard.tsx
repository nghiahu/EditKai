import React from 'react';
import { AbsoluteFill, useCurrentFrame, useVideoConfig } from 'remotion';
import { AnimatedIcon } from '../icons';
import { clamp01, drawProgress, enterExit, pop } from '../motion';
import type { LayerComponent } from '../registry';

const ICON_FRAMES = 18; // icon draws itself and pops
const SPARKLE_FRAMES = 14;
const TITLE_DELAY = 4; // title slides up this many frames after the icon starts
const UNDERLINE_START = 8;
const UNDERLINE_FRAMES = 12;
const SUB_DELAY = 12;

export const TitleCard: LayerComponent = ({ layer, theme }) => {
  const frame = useCurrentFrame();
  const { fps, width, height, durationInFrames } = useVideoConfig();
  const p = (layer.props ?? {}) as { icon?: string; title?: string; sub?: string };
  const m1 = theme.name === 'm1';
  const accent = m1 ? theme.colors.yellow : theme.colors.teal;
  const { safeZone } = theme.limits;
  const { enter, exit, visible } = enterExit(frame, durationInFrames, theme.motion, fps);
  const title = clamp01(pop(frame, fps, theme.motion, TITLE_DELAY));
  const sub = clamp01(pop(frame, fps, theme.motion, SUB_DELAY));
  const underline = drawProgress(frame, UNDERLINE_START, UNDERLINE_FRAMES);
  const sparkle = frame > 0 && frame < SPARKLE_FRAMES ? frame / SPARKLE_FRAMES : 0;

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
          opacity: visible,
          transform: `translateY(${-(1 - clamp01(enter)) * 24 - exit * 16}px) scale(${0.94 + 0.06 * clamp01(enter)})`,
        }}
      >
        <AnimatedIcon name={p.icon ?? 'check'} size={56} color={accent} progress={clamp01(frame / ICON_FRAMES)} sparkle={sparkle} />
        <div>
          <div style={{ overflow: 'hidden', paddingBottom: 6 }}>
            <div style={{ position: 'relative', display: 'inline-block', fontSize: 44, fontWeight: 800, lineHeight: 1.1, color: m1 ? accent : theme.colors.white,
              transform: `translateY(${(1 - title) * 100}%)` }}>
              {p.title}
              <span style={{ position: 'absolute', left: 0, right: 0, bottom: -4, height: 4, borderRadius: 2, background: accent,
                transformOrigin: 'left center', transform: `scaleX(${underline})` }} />
            </div>
          </div>
          {p.sub ? (
            <div style={{ fontSize: 26, opacity: 0.8 * sub, marginTop: 10, transform: `translateY(${(1 - sub) * 10}px)` }}>{p.sub}</div>
          ) : null}
        </div>
      </div>
    </AbsoluteFill>
  );
};
