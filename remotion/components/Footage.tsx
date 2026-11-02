import React, { useState } from 'react';
import { AbsoluteFill, Img, OffthreadVideo } from 'remotion';
import type { LayerComponent } from '../registry';

const IMAGE = /\.(png|jpe?g|webp|gif|svg)(\?.*)?$/i;

export const Footage: LayerComponent = ({ layer, theme, assetBase }) => {
  const [failed, setFailed] = useState(false);
  const p = (layer.props ?? {}) as { src?: string; fit?: 'cover' | 'contain' };
  const src = p.src ?? '';
  const url = /^(https?:|data:|file:)/.test(src) ? src : `${assetBase ?? ''}/${src}`;
  const style: React.CSSProperties = { width: '100%', height: '100%', objectFit: p.fit ?? 'cover' };
  if (failed || !src) {
    return (
      <AbsoluteFill style={{ background: theme.colors.black ?? theme.colors.navy ?? '#111', alignItems: 'center', justifyContent: 'center',
        color: theme.colors.white, fontFamily: theme.fonts.body, fontSize: 36, textAlign: 'center', padding: 60 }}>
        Không tải được footage{src ? `: ${src}` : ''}
      </AbsoluteFill>
    );
  }
  return (
    <AbsoluteFill>
      {IMAGE.test(src)
        ? <Img src={url} style={style} maxRetries={0} onError={() => setFailed(true)} />
        : <OffthreadVideo src={url} style={style} onError={() => setFailed(true)} />}
    </AbsoluteFill>
  );
};
