import React from 'react';
import { AbsoluteFill, OffthreadVideo, Sequence } from 'remotion';
import type { Plan } from '../src/plan/types';
import type { Theme } from '../src/style/theme';
import { registry } from './registry';
import { applyOverride } from './theme-utils';

export type PlanVideoProps = { plan: Plan; theme: Theme; videoSrc: string; durationSec?: number };

export const durationOf = (p: PlanVideoProps): number =>
  p.durationSec ?? Math.max(0.1, ...p.plan.layers.map(l => l.end), ...p.plan.scenes.map(s => s.end));

export const PlanVideo: React.FC<PlanVideoProps> = ({ plan, theme, videoSrc }) => {
  const { fps } = plan.meta;
  return (
    <AbsoluteFill style={{ background: theme.colors.navy ?? theme.colors.black ?? '#000' }}>
      {videoSrc ? <OffthreadVideo src={videoSrc} /> : null}
      {plan.layers.map(l => {
        const Component = registry[l.type ?? l.track];
        if (!Component) return null;
        return (
          <Sequence key={l.id} from={Math.round(l.start * fps)} durationInFrames={Math.max(1, Math.round((l.end - l.start) * fps))}>
            <Component layer={l} theme={applyOverride(theme, l.override)} />
          </Sequence>
        );
      })}
    </AbsoluteFill>
  );
};
