import React from 'react';
import { AbsoluteFill, OffthreadVideo, useCurrentFrame, useVideoConfig } from 'remotion';
import { AnimatedIcon } from '../icons';
import { clamp01, drawProgress, enterExit, pop, staggerDelay } from '../motion';
import type { LayerComponent } from '../registry';

/** Horizontal room kept free beside the label/title so the avatar circle (150 px + border) never covers them. */
export const titleInset = (avatar?: boolean): number => (avatar ? 150 + 8 + 24 : 0);

/** Progress values are clamped to 0..100; anything that is not a finite number counts as 0. */
export const clampPercent = (v: number): number => (Number.isFinite(v) ? Math.min(100, Math.max(0, v)) : 0);

type Item = string | { label?: unknown; value?: unknown };
type Props = {
  label?: string; title?: string; avatar?: boolean; mode?: 'full' | 'overlay';
  body?: { kind?: 'list' | 'card' | 'waveform' | 'progress' | 'phone'; items?: Item[] };
};

const labelOf = (it: Item) => (typeof it === 'string' ? it : String(it?.label ?? ''));
const valueOf = (it: Item) => (typeof it === 'string' ? 0 : Number(it?.value));
const BARS = 24;

export const ExplainerScene: LayerComponent = ({ layer, theme, videoSrc }) => {
  const frame = useCurrentFrame();
  const { fps, width, height, durationInFrames } = useVideoConfig();
  const p = (layer.props ?? {}) as Props;
  const m1 = theme.name === 'm1';
  const accent = m1 ? theme.colors.yellow : theme.colors.teal;
  const { safeZone } = theme.limits;
  const { enter, visible } = enterExit(frame, durationInFrames, theme.motion, fps);
  const popAt = (delay: number) => clamp01(pop(frame, fps, theme.motion, delay));
  const items = p.body?.items ?? [];
  const overlay = p.mode === 'overlay';

  const background = overlay
    ? 'transparent'
    : m1
      ? `radial-gradient(circle at ${50 + 30 * Math.sin(frame / 40)}% ${30 + 10 * Math.cos(frame / 55)}%, rgba(255,217,61,0.12), transparent 60%), ${theme.colors.black}`
      : `linear-gradient(${150 + 30 * Math.sin(frame / 50)}deg, ${theme.colors.navy}, #060c1d)`;
  const row: React.CSSProperties = { padding: '22px 28px', borderRadius: theme.radius, background: 'rgba(255,255,255,0.07)', border: `1px solid ${accent}55`, fontSize: 38 };

  const renderBody = () => {
    switch (p.body?.kind) {
      case 'card':
        return <div style={{ ...row, lineHeight: 1.4 }}>{items.map((t, i) => <div key={i}>{labelOf(t)}</div>)}</div>;
      case 'waveform':
        return (
          <div>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8, height: 220 }}>
              {Array.from({ length: BARS }, (_, i) => {
                const a = Math.abs(Math.sin(frame * 0.21 + i * 0.7) * Math.cos(frame * 0.13 + i * 0.31));
                return <div key={i} style={{ flex: 1, height: 30 + 170 * a, borderRadius: 6, background: accent, opacity: 0.55 + 0.45 * a,
                  transform: `scaleY(${popAt(Math.round(i * 0.5))})` }} />;
              })}
            </div>
            {items.length ? <div style={{ marginTop: 18, fontSize: 30, opacity: 0.85 }}>{items.map(labelOf).join(' · ')}</div> : null}
          </div>
        );
      case 'progress':
        return (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 30 }}>
            {items.map((it, i) => {
              const full = clampPercent(valueOf(it));
              const shown = full * drawProgress(frame, staggerDelay(i, theme.motion) + 6, 24);
              return (
                <div key={i}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 34, marginBottom: 10 }}>
                    <span>{labelOf(it)}</span><span style={{ color: accent }}>{Math.round(shown)}%</span>
                  </div>
                  <div style={{ height: 18, borderRadius: 9, background: 'rgba(255,255,255,0.12)', overflow: 'hidden' }}>
                    <div style={{ height: '100%', width: `${shown}%`, borderRadius: 9, background: accent }} />
                  </div>
                </div>
              );
            })}
          </div>
        );
      case 'phone':
        return (
          <div style={{ width: 380, height: 600, margin: '0 auto', borderRadius: 48, border: `6px solid ${accent}`, padding: '48px 22px 22px',
            background: 'rgba(255,255,255,0.05)', display: 'flex', flexDirection: 'column', gap: 14, overflow: 'hidden' }}>
            {items.map((it, i) => {
              const o = popAt(8 + i * 10);
              return <div key={i} style={{ alignSelf: i % 2 ? 'flex-end' : 'flex-start', maxWidth: '82%', padding: '12px 18px', borderRadius: 22,
                background: i % 2 ? accent : 'rgba(255,255,255,0.14)', color: i % 2 ? (m1 ? theme.colors.black : theme.colors.navy) : theme.colors.white,
                fontSize: 26, opacity: o, transform: `translateY(${(1 - o) * 18}px) scale(${0.9 + 0.1 * o})` }}>{labelOf(it)}</div>;
            })}
          </div>
        );
      default:
        return items.map((t, i) => {
          const o = popAt(staggerDelay(i, theme.motion) + 6);
          return (
            <div key={i} style={{ ...row, display: 'flex', alignItems: 'center', gap: 18, marginBottom: 18, opacity: o, transform: `translateX(${(1 - o) * -40}px)` }}>
              <AnimatedIcon name="check" size={40} color={accent} progress={clamp01((frame - staggerDelay(i, theme.motion) - 6) / 14)} />{labelOf(t)}
            </div>
          );
        });
    }
  };

  const content = (
    <>
      {p.avatar ? (
        <div style={{ position: 'absolute', top: overlay ? 20 : height * safeZone.top, right: overlay ? 20 : width * safeZone.right, width: 150, height: 150,
          borderRadius: '50%', overflow: 'hidden', border: `4px solid ${accent}`, background: `${accent}33`,
          transform: `scale(${1 + 0.05 * Math.sin((2 * Math.PI * frame) / 45)})` }}>
          {videoSrc ? <OffthreadVideo src={videoSrc} muted style={{ width: '100%', height: '100%', objectFit: 'cover', objectPosition: 'center 25%' }} /> : null}
        </div>
      ) : null}
      {p.label ? <div style={{ paddingRight: titleInset(p.avatar), fontSize: 26, letterSpacing: 3, color: accent, fontWeight: 700, opacity: popAt(0) }}>{p.label}</div> : null}
      <div style={{ paddingRight: titleInset(p.avatar), fontSize: 76, fontWeight: 800, lineHeight: 1.05, marginTop: 14, color: m1 ? accent : theme.colors.white,
        opacity: popAt(3), transform: `translateY(${(1 - popAt(3)) * 30}px)` }}>{p.title}</div>
      <div style={{ marginTop: 56 }}>{renderBody()}</div>
    </>
  );

  return (
    <AbsoluteFill style={{ background, color: theme.colors.white, fontFamily: theme.fonts.heading, opacity: visible }}>
      {overlay ? (
        <div style={{ position: 'absolute', left: width * safeZone.left, right: width * safeZone.right, top: height * 0.16, padding: 40, borderRadius: 36,
          background: 'rgba(10,10,10,0.82)', border: `2px solid ${accent}`, boxShadow: '0 30px 80px rgba(0,0,0,0.55)',
          transform: `translateY(${(1 - clamp01(enter)) * 40}px) scale(${0.92 + 0.08 * clamp01(enter)})` }}>
          {content}
        </div>
      ) : (
        <div style={{ position: 'absolute', inset: 0, padding: `${height * safeZone.top}px ${width * safeZone.left}px` }}>{content}</div>
      )}
    </AbsoluteFill>
  );
};
