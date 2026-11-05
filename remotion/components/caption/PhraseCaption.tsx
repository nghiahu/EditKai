import React from 'react';
import { AbsoluteFill, useCurrentFrame, useVideoConfig } from 'remotion';
import { groupRuns, type ResolvedCaption } from '../../../src/plan/captionProps';
import { clamp01, drawProgress, easeOut, enterExit, pop } from '../../motion';
import type { LayerComponent } from '../../registry';
import { captionBox } from './layout';
import { backdropStyle, legibleShadow } from './legibility';

const BOX_DELAY_SEC = 0.15; // the emphasis box lands a moment after the text
const BOX_SEC = 0.25;
const UNDERLINE_START = 4;
const UNDERLINE_FRAMES = 10;
const BLUR_PX = 6;
const LABEL_LEAD_FRAMES = 4; // the label shows this long before the main line
const HANDLE = 14;

type Props = Parameters<LayerComponent>[0] & {
  resolved: ResolvedCaption;
  sizeScale?: number; // font size multiplier (big)
  springIn?: boolean; // enter with the theme spring from scale 0.5 instead of a blur-in (big)
  handles?: boolean; // four corner squares around the text (big)
  label?: string; // small line above the main one (label variant)
};

/** Whole phrase at once (blur-in, pop), emphasised runs painted over it, whole phrase blurs out at the end. */
export const PhraseCaption: React.FC<Props> = ({ layer, theme, resolved, sizeScale = 1, springIn = false, handles = false, label }) => {
  const frame = useCurrentFrame();
  const { fps, width, height, durationInFrames } = useVideoConfig();
  const m1 = theme.name === 'm1';
  const accent = m1 ? theme.colors.yellow : theme.colors.teal;
  const { enter, exit, visible } = enterExit(frame, durationInFrames, theme.motion, fps);
  const e = clamp01(enter);
  // with a label the main line starts a few frames later; its own spring drives its scale/blur/opacity
  const mainIn = label ? clamp01(pop(frame, fps, theme.motion, LABEL_LEAD_FRAMES)) : 1;
  const words = layer.words ?? [];
  const runs = groupRuns(words);
  const wipe = easeOut((frame - Math.round(BOX_DELAY_SEC * fps)) / Math.max(1, Math.round(BOX_SEC * fps)));
  const underline = drawProgress(frame, UNDERLINE_START, UNDERLINE_FRAMES);
  const ink = resolved.ink === 'accent' ? accent : theme.colors.white; // yellow text keeps the dark outline, a little thicker
  const shadow = legibleShadow(resolved.ink === 'accent' ? 4 : 3);
  const scale = springIn ? 0.5 + 0.5 * Math.max(0, enter) + 0.03 * exit : 0.92 + 0.08 * e + 0.03 * exit;
  const blur = springIn ? BLUR_PX * exit : BLUR_PX * (1 - e) + BLUR_PX * exit;

  return (
    <AbsoluteFill>
      <div
        style={{
          ...captionBox(resolved.position, theme, width, height),
          fontFamily: theme.fonts.body,
          fontWeight: m1 ? 800 : 600,
          fontSize: theme.captionSize * sizeScale,
          lineHeight: 1.3,
          color: ink,
        }}
      >
        <div style={{ position: 'relative', display: 'inline-block', padding: handles ? 24 : 0, transform: `scale(${scale})`, filter: `blur(${blur.toFixed(2)}px)`, ...backdropStyle(resolved.backdrop, theme.radius) }}>
          {label ? (
            <div style={{ fontSize: '0.55em', opacity: 0.75 * visible * e, marginBottom: 6, textShadow: shadow }}>{label}</div>
          ) : null}
          <div style={{ opacity: visible * mainIn }}>
            {runs.map((run, i) => {
              const text = words.slice(run.start, run.end + 1).map(w => w.t).join(' ');
              if (!run.hl) return <span key={i} style={{ textShadow: shadow }}>{text} </span>;
              if (resolved.emphasis === 'box') {
                return (
                  <span key={i} style={{ position: 'relative', display: 'inline-block', padding: '0 14px', margin: '0 6px', color: wipe > 0.35 ? (theme.colors.black ?? '#0A0A0A') : theme.colors.white }}>
                    <span style={{ position: 'absolute', zIndex: -1, inset: 0, background: accent, borderRadius: theme.radius, transformOrigin: 'left center', transform: `scaleX(${wipe})` }} />
                    {text}
                  </span>
                );
              }
              return (
                <span key={i} style={{ position: 'relative', display: 'inline-block', color: accent, textShadow: shadow, marginRight: 8 }}>
                  {text}
                  {resolved.emphasis === 'underline' ? (
                    <span style={{ position: 'absolute', left: 0, right: 0, bottom: -4, height: 4, borderRadius: 2, background: accent, transformOrigin: 'left center', transform: `scaleX(${underline})` }} />
                  ) : null}
                </span>
              );
            })}
          </div>
          {handles
            ? [[-1, -1], [1, -1], [-1, 1], [1, 1]].map(([x, y], i) => (
                <span key={`h${i}`} style={{ position: 'absolute', width: HANDLE, height: HANDLE, background: accent, opacity: visible * e,
                  [x < 0 ? 'left' : 'right']: -HANDLE / 2 + 8, [y < 0 ? 'top' : 'bottom']: -HANDLE / 2 + 8 }} />
              ))
            : null}
        </div>
      </div>
    </AbsoluteFill>
  );
};
