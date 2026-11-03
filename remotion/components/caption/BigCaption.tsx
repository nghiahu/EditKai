import React from 'react';
import type { ResolvedCaption } from '../../../src/plan/captionProps';
import type { LayerComponent } from '../../registry';
import { PhraseCaption } from './PhraseCaption';

/** One large word or short phrase: font size captionSize x captionBigScale, springs in from scale 0.5, optional corner handles. */
export const BigCaption: React.FC<Parameters<LayerComponent>[0] & { resolved: ResolvedCaption }> = props => (
  <PhraseCaption {...props} sizeScale={props.theme.captionBigScale} springIn handles={props.resolved.handles} />
);
