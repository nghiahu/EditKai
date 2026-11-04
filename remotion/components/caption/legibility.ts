import type React from 'react';

/** A dark ring of 8 hard shadows (`widthPx` out, all around) plus a soft one: light text stays readable on a light picture, such as a white panel. */
export function legibleShadow(widthPx = 3): string {
  const w = widthPx;
  const ring = [[-w, 0], [w, 0], [0, -w], [0, w], [-w, -w], [w, -w], [-w, w], [w, w]].map(([x, y]) => `${x}px ${y}px 0 rgba(0, 0, 0, 0.9)`);
  return [...ring, '0 3px 10px rgba(0, 0, 0, 0.55)'].join(', ');
}

/** Dark translucent plate behind a whole caption (backdrop `plate`); nothing for `none`. */
export function backdropStyle(backdrop: 'none' | 'plate', radius: number): React.CSSProperties {
  if (backdrop !== 'plate') return {};
  return { background: 'rgba(14, 14, 20, 0.72)', borderRadius: radius + 6, padding: '10px 26px' };
}
