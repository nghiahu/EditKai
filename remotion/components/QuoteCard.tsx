import React from 'react';
import { AbsoluteFill, useCurrentFrame, useVideoConfig } from 'remotion';
import { resolveQuoteCard } from '../../src/plan/insertTypes';
import { breathe, clamp01, enterExit } from '../motion';
import type { LayerComponent } from '../registry';
import { insertBox } from './insertLayout';

const LEAD_FRAMES = 8; // the first word starts this long after the card
const WORD_FADE_FRAMES = 6;
const MAX_STEP_FRAMES = 4; // frames between two words at most
const REVEAL_SHARE = 0.55; // all words are in by this share of the layer
const BIG_MARK = 150;

/** Font size by length: a short saying is big, a long one still fits. */
const quoteSize = (chars: number) => (chars <= 60 ? 56 : chars <= 120 ? 46 : 38);

/** A saying in a dark card with a big quotation mark: the words arrive one after another, then the author's name. */
export const QuoteCard: LayerComponent = ({ layer, theme }) => {
  const frame = useCurrentFrame();
  const { fps, width, height, durationInFrames } = useVideoConfig();
  const r = resolveQuoteCard(layer.props);
  const m1 = theme.name === 'm1';
  const accent = m1 ? theme.colors.yellow : theme.colors.teal;
  const { enter, visible } = enterExit(frame, durationInFrames, theme.motion, fps);
  const e = clamp01(enter);
  const words = r.quote.split(/\s+/).filter(Boolean);
  const step = Math.min(MAX_STEP_FRAMES, Math.max(1, Math.floor((REVEAL_SHARE * durationInFrames - LEAD_FRAMES) / Math.max(1, words.length))));
  const authorAt = LEAD_FRAMES + words.length * step + 4;

  return (
    <AbsoluteFill style={{ opacity: visible }}>
      <div style={{ ...insertBox(r.position, theme, width, height), fontFamily: theme.fonts.heading, color: theme.colors.white }}>
        <div
          style={{
            width: '100%', boxSizing: 'border-box', padding: '28px 44px 40px', borderRadius: 36, background: m1 ? 'rgba(10,10,10,0.92)' : 'rgba(11,21,48,0.92)',
            border: `2px solid ${accent}`, boxShadow: '0 30px 80px rgba(0,0,0,0.55)', transform: `translateY(${(1 - e) * 40}px) scale(${(0.94 + 0.06 * e) * breathe(frame, fps)})`,
          }}
        >
          <div style={{ fontSize: BIG_MARK, lineHeight: 0.8, height: BIG_MARK * 0.55, color: accent, fontWeight: 900, opacity: e }}>{'“'}</div>
          <div style={{ fontSize: quoteSize(r.quote.length), lineHeight: 1.3, fontWeight: 700, overflowWrap: 'anywhere' }}>
            {words.map((w, i) => (
              <span key={i} style={{ opacity: clamp01((frame - LEAD_FRAMES - i * step) / WORD_FADE_FRAMES) }}>{w}{i < words.length - 1 ? ' ' : ''}</span>
            ))}
          </div>
          {r.author ? (
            <div style={{ marginTop: 22, display: 'flex', alignItems: 'center', gap: 16, opacity: clamp01((frame - authorAt) / WORD_FADE_FRAMES) }}>
              <span style={{ width: 48, height: 4, borderRadius: 2, background: accent, flex: 'none' }} />
              <span style={{ fontSize: 30, letterSpacing: 2, color: accent, fontWeight: 700, overflowWrap: 'anywhere' }}>{r.author}</span>
            </div>
          ) : null}
        </div>
      </div>
    </AbsoluteFill>
  );
};
