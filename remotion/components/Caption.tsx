import React from 'react';
import { resolveCaptionProps } from '../../src/plan/captionProps';
import type { LayerComponent } from '../registry';
import { BigCaption } from './caption/BigCaption';
import { LabelCaption } from './caption/LabelCaption';
import { PhraseCaption } from './caption/PhraseCaption';
import { WordCaption } from './caption/WordCaption';

/** Picks the renderer for the layer variant. */
export const Caption: LayerComponent = props => {
  const resolved = resolveCaptionProps(props.layer.props, props.theme);
  switch (resolved.variant) {
    case 'word': return <WordCaption {...props} resolved={resolved} />;
    case 'big': return <BigCaption {...props} resolved={resolved} />;
    case 'label': return <LabelCaption {...props} resolved={resolved} />;
    default: return <PhraseCaption {...props} resolved={resolved} />;
  }
};
