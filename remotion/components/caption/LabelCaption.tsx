import React from 'react';
import type { ResolvedCaption } from '../../../src/plan/captionProps';
import type { LayerComponent } from '../../registry';
import { PhraseCaption } from './PhraseCaption';

/** A small line above the main phrase; without label text it is just a phrase. */
export const LabelCaption: React.FC<Parameters<LayerComponent>[0] & { resolved: ResolvedCaption }> = props => (
  <PhraseCaption {...props} label={props.resolved.label} />
);
