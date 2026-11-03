import React, { useState } from 'react';
import { AbsoluteFill, Img, OffthreadVideo, useCurrentFrame, useVideoConfig } from 'remotion';
import { footageMuted, resolveFootageProps } from '../../src/plan/insertProps';
import { assetUrl } from '../assetUrl';
import { footageMotion } from '../footageMotion';
import { clamp01, enterExit } from '../motion';
import type { LayerComponent } from '../registry';
import { PhoneFrame } from './footage/PhoneFrame';
import { WindowFrame } from './footage/WindowFrame';

const IMAGE = /\.(png|jpe?g|webp|gif|svg)(\?.*)?$/i;
const isImage = (src: string) => IMAGE.test(src) || /^data:image\//.test(src);

export const Footage: LayerComponent = ({ layer, theme, assetBase }) => {
  const [failed, setFailed] = useState(false);
  const frame = useCurrentFrame();
  const { fps, width, height, durationInFrames } = useVideoConfig();
  const { enter, exit, visible } = enterExit(frame, durationInFrames, theme.motion, fps);
  const r = resolveFootageProps(layer.props);
  const url = assetUrl(assetBase ?? '', r.src);
  const progress = durationInFrames > 1 ? frame / (durationInFrames - 1) : 0;
  const framed = r.frame !== 'none';
  const fit = framed ? 'cover' : r.fit;
  const media: React.CSSProperties = { width: '100%', height: '100%', objectFit: fit };

  const body = failed || !r.src ? (
    <div style={{ position: 'absolute', inset: 0, background: theme.colors.black ?? theme.colors.navy ?? '#111', display: 'flex', alignItems: 'center', justifyContent: 'center',
      color: theme.colors.white, fontFamily: theme.fonts.body, fontSize: 36, textAlign: 'center', padding: 60 }}>
      Không tải được footage{r.src ? `: ${r.src}` : ''}
    </div>
  ) : isImage(r.src) ? (
    <Img src={url} style={media} maxRetries={0} onError={() => setFailed(true)} />
  ) : (
    <OffthreadVideo src={url} style={media} startFrom={Math.round(r.from * fps)} muted={footageMuted(layer.props)} onError={() => setFailed(true)} />
  );
  // the motion acts on the media only, so a frame or card stays put while the picture drifts inside it
  const moving = <div style={{ position: 'absolute', inset: 0, overflow: 'hidden', ...footageMotion(r.motion, progress, r.focus) }}>{body}</div>;
  const cardTransform = `translateY(${(1 - clamp01(enter)) * 40 - exit * 20}px) scale(${0.9 + 0.1 * clamp01(enter) - 0.04 * exit})`;

  return (
    <AbsoluteFill style={{ opacity: visible }}>
      {r.frame === 'window' ? (
        <div style={{ position: 'absolute', inset: 0, transform: cardTransform }}><WindowFrame title={r.title}>{moving}</WindowFrame></div>
      ) : r.frame === 'phone' ? (
        <div style={{ position: 'absolute', inset: 0, transform: cardTransform }}><PhoneFrame>{moving}</PhoneFrame></div>
      ) : r.fit === 'contain' ? (
        // a card floating over the dimmed speaker: springs in, rises slightly and shrinks away on exit
        <div style={{ position: 'absolute', left: width * 0.08, right: width * 0.08, top: height * 0.18, bottom: height * 0.18, borderRadius: 28, overflow: 'hidden',
          boxShadow: '0 30px 80px rgba(0,0,0,0.55)', background: 'rgba(0,0,0,0.35)', transform: cardTransform }}>
          {moving}
        </div>
      ) : moving}
    </AbsoluteFill>
  );
};
