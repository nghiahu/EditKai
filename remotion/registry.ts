import type React from 'react';
import type { Layer } from '../src/plan/types';
import type { Theme } from '../src/style/theme';
import { Caption } from './components/Caption';

export type LayerComponent = React.FC<{ layer: Layer; theme: Theme }>;

/** Keyed by layer `type`; caption layers have no type, so they use their track name. */
export const registry: Record<string, LayerComponent> = {
  caption: Caption,
};
