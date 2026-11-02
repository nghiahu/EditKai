import { describe, it, expect } from 'vitest';
import React from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { AnimatedIcon, Icon, iconNames, resolveIcon } from '../../remotion/icons';

const html = (el: React.ReactElement) => renderToStaticMarkup(el);
const props = { size: 40, color: '#fff' };

describe('icons', () => {
  it('has the 23 names from the spec', () => {
    expect(iconNames).toHaveLength(23);
    for (const n of ['video', 'skill', 'chat', 'clock', 'check', 'typography', 'graphic', 'motion', 'audio', 'sparkles', 'zap', 'scissors', 'wand', 'layers', 'play', 'mic', 'subtitles', 'image', 'bot', 'gauge', 'lightbulb', 'rocket', 'star'])
      expect(iconNames).toContain(n);
  });
  it('resolveIcon falls back to check for unknown and lottie names', () => {
    expect(resolveIcon('zzz')).toBe('check');
    expect(resolveIcon('lottie:assets/x.json')).toBe('check');
    expect(resolveIcon('rocket')).toBe('rocket');
  });
  it('every icon renders an svg whose strokes can be drawn on (pathLength)', () => {
    for (const name of iconNames) {
      const out = html(React.createElement(AnimatedIcon, { name, ...props }));
      expect(out.startsWith('<svg')).toBe(true);
      expect(out).toContain('pathLength="1"');
    }
  });
  it('progress changes the picture', () => {
    expect(html(React.createElement(AnimatedIcon, { name: 'video', ...props, progress: 0.3 })))
      .not.toBe(html(React.createElement(AnimatedIcon, { name: 'video', ...props, progress: 1 })));
  });
  it('sparkle 0 has no rays and sparkle 0.5 has 6', () => {
    const count = (s: number) => (html(React.createElement(AnimatedIcon, { name: 'star', ...props, sparkle: s })).match(/data-ray/g) ?? []).length;
    expect(count(0)).toBe(0);
    expect(count(0.5)).toBe(6);
    expect(count(1)).toBe(0);
  });
  it('Icon equals AnimatedIcon at progress 1', () => {
    expect(html(React.createElement(Icon, { name: 'bot', ...props }))).toBe(html(React.createElement(AnimatedIcon, { name: 'bot', ...props, progress: 1 })));
  });
});
