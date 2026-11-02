import React, { useState } from 'react';
import { AbsoluteFill, Img, OffthreadVideo, useCurrentFrame, useVideoConfig } from 'remotion';
import { assetUrl } from '../assetUrl';
import { clamp01, enterExit } from '../motion';
import type { LayerComponent } from '../registry';

const IMAGE = /\.(png|jpe?g|webp|gif|svg)(\?.*)?$/i;
const isImage = (src: string) => IMAGE.test(src) || /^data:image\//.test(src);

export const Footage: LayerComponent = ({ layer, theme, assetBase }) => {
  const [failed, setFailed] = useState(false);
  const frame = useCurrentFrame();
  const { fps, width, height, durationInFrames } = useVideoConfig();
  const { enter, exit, visible } = enterExit(frame, durationInFrames, theme.motion, fps);
  const p = (layer.props ?? {}) as { src?: string; fit?: 'cover' | 'contain' };
  const src = p.src ?? '';
  const url = assetUrl(assetBase ?? '', src);
  const card = p.fit === 'contain';
  const media: React.CSSProperties = { width: '100%', height: '100%', objectFit: p.fit ?? 'cover' };

  if (failed || !src) {
    return (
      <AbsoluteFill style={{ background: theme.colors.black ?? theme.colors.navy ?? '#111', alignItems: 'center', justifyContent: 'center',
        color: theme.colors.white, fontFamily: theme.fonts.body, fontSize: 36, textAlign: 'center', padding: 60, opacity: visible }}>
        Không tải được footage{src ? `: ${src}` : ''}
      </AbsoluteFill>
    );
  }
  const content = isImage(src)
    ? <Img src={url} style={media} maxRetries={0} onError={() => setFailed(true)} />
    : <OffthreadVideo src={url} style={media} onError={() => setFailed(true)} />;

  return (
    <AbsoluteFill style={{ opacity: visible }}>
      {card ? (
        // a card floating over the dimmed speaker: springs in, rises slightly and shrinks away on exit
        <div style={{ position: 'absolute', left: width * 0.08, right: width * 0.08, top: height * 0.18, bottom: height * 0.18, borderRadius: 28, overflow: 'hidden',
          boxShadow: '0 30px 80px rgba(0,0,0,0.55)', background: 'rgba(0,0,0,0.35)',
          transform: `translateY(${(1 - clamp01(enter)) * 40 - exit * 20}px) scale(${0.9 + 0.1 * clamp01(enter) - 0.04 * exit})` }}>
          {content}
        </div>
      ) : content}
    </AbsoluteFill>
  );
};
