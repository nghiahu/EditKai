import React from 'react';
import { Composition } from 'remotion';
import { DEFAULT_DIRECTOR } from '../src/style/director';
import { DEFAULT_MOTION } from '../src/style/motion';
import { PlanVideo, durationOf, type PlanVideoProps } from './PlanVideo';

const placeholder: PlanVideoProps = {
  plan: { version: 1, meta: { source: '', fps: 30, width: 1080, height: 1920, style: 's1' }, scenes: [], layers: [] },
  theme: { name: 's1', colors: {}, fonts: { heading: 'sans-serif', body: 'sans-serif' }, captionSize: 40, radius: 24, animMs: 300, motion: DEFAULT_MOTION, captionEmphasis: 'box', captionBigScale: 2, director: DEFAULT_DIRECTOR,
    limits: { maxCaptionWords: 8, minSceneSec: 1.5, safeZone: { top: 0.08, bottom: 0.18, left: 0.06, right: 0.06 } } },
  videoSrc: '',
};

export const Root: React.FC = () => (
  <Composition
    id="PlanVideo"
    component={PlanVideo}
    width={1080}
    height={1920}
    fps={30}
    durationInFrames={30}
    defaultProps={placeholder}
    calculateMetadata={({ props }) => ({
      width: props.plan.meta.width,
      height: props.plan.meta.height,
      fps: props.plan.meta.fps,
      durationInFrames: Math.max(1, Math.round(durationOf(props) * props.plan.meta.fps)),
    })}
  />
);
