import type React from 'react';
import type { Layer } from '../src/plan/types';
import type { Theme } from '../src/style/theme';
import { Caption } from './components/Caption';
import { TitleCard } from './components/TitleCard';
import { ChipStack } from './components/ChipStack';
import { ExplainerScene } from './components/ExplainerScene';
import { Footage } from './components/Footage';
import { Transition } from './components/Transition';
import { Camera } from './components/Camera';
import { LogoBadge } from './components/LogoBadge';
import { PromptBox } from './components/PromptBox';
import { StatCard } from './components/StatCard';

export type LayerComponent = React.FC<{ layer: Layer; theme: Theme; videoSrc?: string; assetBase?: string }>;

/** Keyed by layer `type`; caption layers have no type, so they use their track name. */
export const registry: Record<string, LayerComponent> = {
  caption: Caption,
  'title-card': TitleCard,
  'chip-stack': ChipStack,
  'explainer-scene': ExplainerScene,
  footage: Footage,
  transition: Transition,
  'logo-badge': LogoBadge,
  'prompt-box': PromptBox,
  'stat-card': StatCard,
  'zoom-punch': Camera,
  shake: Camera,
};
