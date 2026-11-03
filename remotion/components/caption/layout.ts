import type React from 'react';
import type { CaptionPosition } from '../../../src/plan/captionProps';
import type { Theme } from '../../../src/style/theme';

/** Absolute box for a caption at `position`: left/right follow the safe zone; `bottom` keeps the offsets captions always used. */
export function captionBox(position: CaptionPosition, theme: Theme, width: number, height: number): React.CSSProperties {
  const sz = theme.limits.safeZone;
  const base: React.CSSProperties = { position: 'absolute', left: width * sz.left, right: width * sz.right, textAlign: 'center' };
  if (position === 'top') return { ...base, top: height * sz.top };
  if (position === 'center') return { ...base, top: 0, bottom: 0, display: 'flex', flexDirection: 'column', justifyContent: 'center', alignItems: 'center' };
  return { ...base, bottom: theme.name === 'm1' ? height * 0.28 : height * sz.bottom };
}
