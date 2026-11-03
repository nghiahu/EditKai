import React from 'react';
import { resolveCaptionProps } from '../../src/plan/captionProps';
import type { LayerComponent } from '../registry';
import { PhraseCaption } from './caption/PhraseCaption';
import { WordCaption } from './caption/WordCaption';

/** Picks the renderer for the layer variant; big and label get their own renderers in a later task and use the phrase one until then. */
export const Caption: LayerComponent = props => {
  const resolved = resolveCaptionProps(props.layer.props, props.theme);
  return resolved.variant === 'word' ? <WordCaption {...props} resolved={resolved} /> : <PhraseCaption {...props} resolved={resolved} />;
};
