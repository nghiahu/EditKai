import React from 'react';
import { useCurrentFrame, useVideoConfig } from 'remotion';
import type { CustomProps } from '../../src/plan/custom';
import { customComponents } from '../customRegistry';
import type { LayerComponent } from '../registry';

/** Draws a component the AI wrote for this project, looked up by `props.component`. A name that is not registered stops the render with a clear message. */
export const Custom: LayerComponent = ({ layer, theme, assetBase }) => {
  const frame = useCurrentFrame();
  const { fps, width, height } = useVideoConfig();
  const props = layer.props as unknown as CustomProps;
  const Component = customComponents[props.component];
  if (!Component) throw new Error(`Không tìm thấy thành phần riêng "${props.component}" (projects/<tên>/components/${props.component}.tsx)`);
  return <Component frame={frame} fps={fps} t={frame / fps} width={width} height={height} u={Math.min(width, height) / 1080} durationInFrames={Math.max(1, Math.round((layer.end - layer.start) * fps))} theme={theme} data={props.data ?? {}} assetBase={assetBase} />;
};
