import React from 'react';
import { icons } from 'lucide';
import { clamp01, easeOut } from '../motion/ease';

const LUCIDE: Record<string, string> = {
  video: 'Video', skill: 'Box', chat: 'MessageSquare', clock: 'Clock', check: 'CircleCheck', typography: 'Type',
  graphic: 'Shapes', motion: 'Activity', audio: 'AudioLines', sparkles: 'Sparkles', zap: 'Zap', scissors: 'Scissors',
  wand: 'Wand', layers: 'Layers', play: 'Play', mic: 'Mic', subtitles: 'Subtitles', image: 'Image', bot: 'Bot',
  gauge: 'Gauge', lightbulb: 'Lightbulb', rocket: 'Rocket', star: 'Star',
};

export const iconNames = Object.keys(LUCIDE);

/** Unknown names (including future `lottie:` references) fall back to the check icon. */
export const resolveIcon = (name: string): string => (name in LUCIDE ? name : 'check');

type Props = { name: string; size: number; color: string; progress?: number; sparkle?: number };

/**
 * Line icon that draws itself on (progress 0 → 0.7) and then pops (0.7 → 1); progress 1 is the settled icon.
 * `sparkle` 0 → 1 bursts six rays outward and fades them; 0 and 1 draw none. Pure: no Remotion hooks.
 */
export const AnimatedIcon: React.FC<Props> = ({ name, size, color, progress = 1, sparkle = 0 }) => {
  const p = clamp01(progress);
  const draw = clamp01(p / 0.7);
  const scale = 0.8 + 0.2 * easeOut(p) + (p < 1 && p >= 0.7 ? 0.1 * Math.sin((Math.PI * (p - 0.7)) / 0.3) : 0);
  const node = (icons as Record<string, [string, Record<string, string>][]>)[LUCIDE[resolveIcon(name)]];
  const rays = sparkle > 0 && sparkle < 1
    ? Array.from({ length: 6 }, (_, k) => {
        const a = (k * Math.PI) / 3 + Math.PI / 6;
        const inner = 11 + 5 * sparkle, outer = inner + 3 * (1 - sparkle);
        return <line key={`ray${k}`} data-ray x1={12 + inner * Math.cos(a)} y1={12 + inner * Math.sin(a)} x2={12 + outer * Math.cos(a)} y2={12 + outer * Math.sin(a)} strokeWidth={1.5} opacity={1 - sparkle} />;
      })
    : null;
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round"
      style={{ color, flexShrink: 0, overflow: 'visible', transform: `scale(${scale})` }}>
      {node.map(([tag, attrs], i) =>
        React.createElement(tag, { ...attrs, key: i, pathLength: 1, strokeDasharray: 1, strokeDashoffset: 1 - draw }))}
      {rays}
    </svg>
  );
};

export const Icon: React.FC<{ name: string; size: number; color: string }> = props => <AnimatedIcon {...props} progress={1} />;
