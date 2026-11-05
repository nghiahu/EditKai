import React from 'react';
import { AbsoluteFill, useCurrentFrame, useVideoConfig } from 'remotion';
import { resolveStepNumber } from '../../src/plan/insertTypes';
import { breathe, clamp01, easeOut, enterExit, pop } from '../motion';
import type { LayerComponent } from '../registry';
import { insertBox } from './insertLayout';

const NUMERAL = 250;
const TITLE_AT = 6; // frames after the numeral lands
const SUB_AT = 11;
const SLIDE_FRAMES = 10;

/** A step of a list: a huge slanted numeral that slams in from large and settles, then the title and a sub-line slide in beside it. */
export const StepNumber: LayerComponent = ({ layer, theme }) => {
  const frame = useCurrentFrame();
  const { fps, width, height, durationInFrames } = useVideoConfig();
  const r = resolveStepNumber(layer.props);
  const accent = theme.name === 'm1' ? theme.colors.yellow : theme.colors.teal;
  const { visible } = enterExit(frame, durationInFrames, theme.motion, fps);
  const land = pop(frame, fps, theme.motion, 0);
  const side = r.position === 'left' || r.position === 'right';
  const slide = (at: number) => clamp01(easeOut((frame - at) / SLIDE_FRAMES));

  return (
    <AbsoluteFill style={{ opacity: visible }}>
      <div style={{ ...insertBox(r.position, theme, width, height), fontFamily: theme.fonts.heading, color: theme.colors.white }}>
        <div style={{ display: 'flex', flexDirection: side ? 'column' : 'row', alignItems: 'center', gap: side ? 4 : 32, maxWidth: '100%', textAlign: side ? 'center' : 'left' }}>
          <div style={{
            flex: 'none', fontSize: NUMERAL, lineHeight: 1, fontWeight: 900, fontStyle: 'italic', color: accent,
            transform: `scale(${(1 + (1 - clamp01(land)) * 0.9) * breathe(frame, fps)}) rotate(${-4 - (1 - clamp01(land)) * 6}deg)`, opacity: clamp01(land * 2),
            WebkitTextStroke: '5px rgba(0,0,0,0.55)', paintOrder: 'stroke fill', textShadow: '0 10px 40px rgba(0,0,0,0.6)',
          }}>
            {r.number}
          </div>
          {r.title || r.sub ? (
            <div style={{ minWidth: 0, textShadow: '0 4px 24px rgba(0,0,0,0.75)' }}>
              {r.title ? (
                <div style={{ fontSize: 54, lineHeight: 1.1, fontWeight: 800, overflowWrap: 'anywhere', opacity: slide(TITLE_AT), transform: `translateX(${(1 - slide(TITLE_AT)) * 40}px)` }}>{r.title}</div>
              ) : null}
              {r.sub ? (
                <div style={{ marginTop: 10, fontSize: 30, fontWeight: 700, opacity: 0.9 * slide(SUB_AT), overflowWrap: 'anywhere', transform: `translateX(${(1 - slide(SUB_AT)) * 40}px)` }}>{r.sub}</div>
              ) : null}
            </div>
          ) : null}
        </div>
      </div>
    </AbsoluteFill>
  );
};
