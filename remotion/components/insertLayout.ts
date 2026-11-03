import type React from 'react';
import type { InsertPosition } from '../../src/plan/insertProps';
import type { Theme } from '../../src/style/theme';

/** Full-frame flex column placing its child at the top, centre or bottom of the safe zone (used by the graphic inserts). */
export function insertBox(position: InsertPosition, theme: Theme, width: number, height: number): React.CSSProperties {
  const sz = theme.limits.safeZone;
  const base: React.CSSProperties = {
    position: 'absolute', left: width * sz.left, right: width * sz.right, top: 0, bottom: 0,
    display: 'flex', flexDirection: 'column', alignItems: 'center',
  };
  if (position === 'top') return { ...base, justifyContent: 'flex-start', paddingTop: height * sz.top };
  if (position === 'bottom') return { ...base, justifyContent: 'flex-end', paddingBottom: height * sz.bottom };
  return { ...base, justifyContent: 'center' };
}
