import React from 'react';
import { AbsoluteFill, useCurrentFrame, useVideoConfig } from 'remotion';
import { easeInOut } from '../motion/ease';
import type { LayerComponent } from '../registry';

/** zoom/blur/slide/push act on the base video (PlanVideo applies transitionStyle); only `flash` draws something: a white pulse. */
export const Transition: LayerComponent = ({ layer }) => {
  const frame = useCurrentFrame();
  const { durationInFrames } = useVideoConfig();
  if (layer.props?.kind !== 'flash') return null;
  const p = durationInFrames > 1 ? frame / (durationInFrames - 1) : 1;
  return <AbsoluteFill style={{ background: '#fff', opacity: easeInOut(1 - Math.abs(2 * p - 1)) }} />;
};
