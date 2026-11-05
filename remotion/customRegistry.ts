import type React from 'react';

/** What a project component receives (the contract in the custom-component design). */
export interface CustomComponentProps {
  frame: number;
  fps: number;
  /** seconds since the start of the layer */
  t: number;
  width: number;
  height: number;
  /** size unit: the short side of the frame / 1080 */
  u: number;
  durationInFrames: number;
  theme: import('../src/style/theme').Theme;
  data: Record<string, unknown>;
  assetBase?: string;
}

/** Project components by name; the bundle entry of a project fills it (see the project loader). */
export const customComponents: Record<string, React.FC<CustomComponentProps>> = {};
