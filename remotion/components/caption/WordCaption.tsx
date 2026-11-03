import React from 'react';
import { AbsoluteFill, useCurrentFrame, useVideoConfig } from 'remotion';
import type { ResolvedCaption } from '../../../src/plan/captionProps';
import { clamp01, drawProgress, easeOut, enterExit, wordProgress } from '../../motion';
import type { LayerComponent } from '../../registry';
import { captionBox } from './layout';

const WIPE_SEC = 0.25; // m1: how long the yellow box takes to sweep under a key word
const UNDERLINE_FRAMES = 10; // s1: how long the underline takes to draw

/** The original per-word caption: each word pops in when it is spoken. */
export const WordCaption: React.FC<Parameters<LayerComponent>[0] & { resolved: ResolvedCaption }> = ({ layer, theme, resolved }) => {
  const frame = useCurrentFrame();
  const { fps, width, height, durationInFrames } = useVideoConfig();
  const m1 = theme.name === 'm1';
  const accent = m1 ? theme.colors.yellow : theme.colors.teal;
  const tSec = layer.start + frame / fps;
  const { visible } = enterExit(frame, durationInFrames, theme.motion, fps);

  return (
    <AbsoluteFill>
      <div
        style={{
          ...captionBox(resolved.position, theme, width, height),
          fontFamily: theme.fonts.body,
          fontWeight: m1 ? 800 : 600,
          fontSize: theme.captionSize,
          lineHeight: 1.25,
          color: theme.colors.white,
        }}
      >
        <div>{/* one flex child, so the words stay on one flowing line when the box is a centred flex column */}
        {(layer.words ?? []).map((w, i) => {
          const p = wordProgress(w, tSec, theme.motion);
          const active = tSec >= w.s && tSec <= Math.max(w.e, w.s + 0.12);
          const opacity = clamp01(p) * visible * (active ? 1 : 0.88);
          // hidden words keep their place in the line (so the caption does not re-centre as words arrive) but draw nothing
          const wipe = w.hl ? easeOut((tSec - w.s) / WIPE_SEC) : 0;
          const underline = w.hl && !m1 ? drawProgress(frame, (w.s - layer.start) * fps, UNDERLINE_FRAMES) : 0;
          return (
            <span
              key={i}
              style={{
                position: 'relative',
                display: 'inline-block',
                marginRight: 10,
                opacity,
                transform: `translateY(${(1 - clamp01(p)) * 14}px) scale(${0.6 + 0.4 * p})`,
                textShadow: opacity > 0 && !(w.hl && m1) ? '0 2px 8px rgba(0,0,0,0.6)' : 'none',
                color: w.hl ? (m1 ? (wipe > 0.35 ? theme.colors.black : theme.colors.white) : accent) : theme.colors.white,
              }}
            >
              {w.hl && m1 ? (
                <span
                  style={{
                    position: 'absolute', zIndex: -1, left: -12, top: 0, bottom: 0, right: -12,
                    background: accent, borderRadius: theme.radius,
                    transformOrigin: 'left center', transform: `scaleX(${wipe})`,
                  }}
                />
              ) : null}
              {w.t}
              {underline > 0 ? (
                <span
                  style={{
                    position: 'absolute', left: 0, right: 0, bottom: -4, height: 4, borderRadius: 2,
                    background: accent, transformOrigin: 'left center', transform: `scaleX(${underline})`,
                  }}
                />
              ) : null}
            </span>
          );
        })}
        </div>
      </div>
    </AbsoluteFill>
  );
};
