import React from 'react';
import { AbsoluteFill, Audio, Freeze, OffthreadVideo, Sequence, useCurrentFrame } from 'remotion';
import type { Plan } from '../src/plan/types';
import type { Theme } from '../src/style/theme';
import './fonts'; // loads Be Vietnam Pro before the first frame (the render and the editor both import this file)
import { registry } from './registry';
import { applyOverride } from './theme-utils';
import { baseDim, mergeStyles } from './baseDim';
import { cameraStyle } from './camera';
import { transitionStyle } from './transition';
import { framingStyle, resolveFraming } from '../src/plan/framing';
import { sfxCues } from '../src/audio/cues';
import { sfxFile } from '../src/audio/synth';
import { assetUrl } from './assetUrl';

export const SFX_VOLUME = 0.25;

const FILL = { width: '100%', height: '100%' } as const;

export type PlanVideoProps = { plan: Plan; theme: Theme; videoSrc: string; durationSec?: number; assetBase?: string };

export const durationOf = (p: PlanVideoProps): number =>
  p.durationSec ?? Math.max(0.1, ...p.plan.layers.map(l => l.end), ...p.plan.scenes.map(s => s.end));

export const PlanVideo: React.FC<PlanVideoProps> = ({ plan, theme, videoSrc, assetBase }) => {
  const { fps } = plan.meta;
  const frame = useCurrentFrame();
  const framing = resolveFraming(plan.meta);
  return (
    <AbsoluteFill style={{ background: theme.colors.navy ?? theme.colors.black ?? '#000' }}>
      <AbsoluteFill style={mergeStyles(transitionStyle(plan.layers, frame / fps), cameraStyle(plan.layers, frame / fps, theme.motion), baseDim(plan.layers, frame / fps, theme.motion))}>
        {videoSrc ? <OffthreadVideo src={videoSrc} style={{ ...FILL, ...framingStyle(framing) }} /> : null}
        {/* a freeze: a muted copy of the picture held at the frame where the layer starts, over the video that keeps playing, so the sound does not stop */}
        {videoSrc ? plan.layers.filter(l => l.type === 'freeze').map(l => (
          <Sequence key={l.id} from={Math.round(l.start * fps)} durationInFrames={Math.max(1, Math.round((l.end - l.start) * fps))}>
            <Freeze frame={0}><OffthreadVideo src={videoSrc} muted startFrom={Math.round(l.start * fps)} style={{ ...FILL, ...framingStyle(framing) }} /></Freeze>
          </Sequence>
        )) : null}
      </AbsoluteFill>
      {plan.layers.map(l => {
        const Component = registry[l.type ?? l.track];
        if (!Component) return null;
        return (
          <Sequence key={l.id} from={Math.round(l.start * fps)} durationInFrames={Math.max(1, Math.round((l.end - l.start) * fps))}>
            <Component layer={l} theme={applyOverride(theme, l.override)} videoSrc={videoSrc} assetBase={assetBase} />
          </Sequence>
        );
      })}
      {assetBase ? sfxCues(plan).map((c, i) => (
        <Sequence key={`sfx${i}`} from={Math.round(c.t * fps)} durationInFrames={Math.round(1 * fps)}>
          <Audio src={assetUrl(assetBase, sfxFile(c.sound))} volume={(plan.meta.sfx?.volume ?? SFX_VOLUME) * c.gain} />
        </Sequence>
      )) : null}
    </AbsoluteFill>
  );
};
