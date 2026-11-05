import React from 'react';
import { AbsoluteFill, useCurrentFrame, useVideoConfig } from 'remotion';
import { expandScene, valueAt, type Palette } from '../../src/plan/keyframes';
import type { SceneNode, SceneProps } from '../../src/plan/scene';
import type { Theme } from '../../src/style/theme';
import { assetUrl } from '../assetUrl';
import { AnimatedIcon } from '../icons';
import { enterExit } from '../motion';
import type { LayerComponent } from '../registry';

type Ctx = { t: number; u: number; palette: Palette; theme: Theme; assetBase?: string };

const ALIGN = { start: 'flex-start', center: 'center', end: 'flex-end' } as const;

/** The colour tokens of a scene, from the style. */
export function scenePalette(theme: Theme): Palette {
  const m1 = theme.name === 'm1';
  return {
    accent: m1 ? theme.colors.yellow : theme.colors.teal,
    white: '#FFFFFF',
    ink: theme.colors.black ?? theme.colors.navy ?? '#0A0A0A',
    panel: m1 ? 'rgba(10,10,10,0.88)' : 'rgba(11,21,48,0.88)',
    dim: 'rgba(255,255,255,0.35)',
  };
}

const css = (c: string | undefined, palette: Palette) => (c === undefined ? undefined : palette[c] ?? c);

/** One block and its children. Every number is in pixels of a 1080-wide canvas (`u` scales it to the frame); animated properties are read from `keys` at time `t`. */
const NodeView: React.FC<{ n: SceneNode } & Ctx> = ({ n, ...ctx }) => {
  const { t, u, palette, theme, assetBase } = ctx;
  const num = (prop: string, fallback: number): number => {
    const keys = n.keys?.[prop as keyof typeof n.keys];
    const v = keys ? valueAt(keys, t, palette) : (n as unknown as Record<string, unknown>)[prop];
    return typeof v === 'number' ? v : fallback;
  };
  const color = (prop: 'fill' | 'stroke' | 'color', fallback?: string): string | undefined => {
    const keys = n.keys?.[prop];
    const v = keys ? valueAt(keys, t, palette) : n[prop];
    return css(typeof v === 'string' ? v : fallback, palette);
  };

  const opacity = num('opacity', 1);
  const scale = num('scale', 1);
  const strokeWidth = num('strokeWidth', 0);
  const fill = color('fill');
  const stroke = color('stroke');
  const style: React.CSSProperties = {
    opacity,
    transform: `translate(${num('x', 0) * u}px, ${num('y', 0) * u}px) scale(${scale}) rotate(${num('rotate', 0)}deg)`,
    ...(n.w !== undefined ? { width: n.w * u } : {}),
    ...(n.h !== undefined ? { height: n.h * u } : {}),
    ...(n.padding !== undefined ? { padding: n.padding * u } : {}),
    ...(n.radius !== undefined ? { borderRadius: n.radius * u } : {}),
    ...(fill ? { background: fill } : {}),
    ...(stroke && strokeWidth > 0 ? { boxShadow: `inset 0 0 0 ${strokeWidth * u}px ${stroke}${n.shadow ? ', 0 20px 60px rgba(0,0,0,0.5)' : ''}` } : n.shadow ? { boxShadow: '0 20px 60px rgba(0,0,0,0.5)' } : {}),
    boxSizing: 'border-box',
    flex: 'none',
  };
  const align = ALIGN[n.align ?? 'center'];
  const kids = (n.children ?? []).map(c => <NodeView key={c.id} n={c} {...ctx} />);

  switch (n.kind) {
    case 'text': {
      const c = color('color', 'white');
      return (
        <div style={{ ...style, color: c, fontFamily: theme.fonts.heading, fontSize: (n.size ?? 32) * u, fontWeight: n.weight ?? 700, fontStyle: n.italic ? 'italic' : 'normal', lineHeight: 1.15, textAlign: n.align === 'start' ? 'left' : n.align === 'end' ? 'right' : 'center', overflowWrap: 'anywhere' }}>
          {n.text}
        </div>
      );
    }
    case 'icon': {
      const size = (n.size ?? 48) * u;
      return (
        <div style={{ ...style, width: size, height: size, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
          <AnimatedIcon name={n.name ?? 'check'} size={size} color={color('color', 'white') ?? '#fff'} progress={num('progress', 1)} />
        </div>
      );
    }
    case 'image':
      return <img src={assetUrl(assetBase ?? '', n.src ?? '')} style={{ ...style, objectFit: 'contain' }} alt="" />;
    case 'line': {
      const pts = n.points ?? [];
      const w = n.w ?? Math.max(1, ...pts.map(p => p[0]));
      const h = n.h ?? Math.max(1, ...pts.map(p => p[1]));
      const d = pts.map((p, i) => `${i === 0 ? 'M' : 'L'}${p[0]} ${p[1]}`).join(' ');
      const progress = num('progress', 1);
      return (
        <svg width={w * u} height={h * u} viewBox={`0 0 ${w} ${h}`} style={{ opacity, transform: style.transform, flex: 'none', overflow: 'visible' }}>
          <path d={d} fill="none" stroke={stroke ?? palette.accent} strokeWidth={strokeWidth > 0 ? strokeWidth : 6} strokeLinecap="round" strokeLinejoin="round" pathLength={1} strokeDasharray={1} strokeDashoffset={1 - progress} />
        </svg>
      );
    }
    case 'grid':
      return <div style={{ ...style, display: 'grid', gridTemplateColumns: `repeat(${n.cols ?? 2}, auto)`, gap: (n.gap ?? 0) * u, alignItems: align, justifyItems: align, justifyContent: 'center' }}>{kids}</div>;
    case 'stack':
      return (
        <div style={{ ...style, position: 'relative' }}>
          {(n.children ?? []).map(c => (
            <div key={c.id} style={{ position: 'absolute', inset: 0, display: 'flex', alignItems: 'center', justifyContent: 'center' }}><NodeView n={c} {...ctx} /></div>
          ))}
        </div>
      );
    case 'row':
      return <div style={{ ...style, display: 'flex', flexDirection: 'row', gap: (n.gap ?? 0) * u, alignItems: align, justifyContent: 'center' }}>{kids}</div>;
    default: // column and box
      return <div style={{ ...style, display: 'flex', flexDirection: 'column', gap: (n.gap ?? 0) * u, alignItems: align, justifyContent: 'center' }}>{kids}</div>;
  }
};

/** Where a scene's box sits: shares of the frame, from the anchor and the safe zone (the same numbers `insertFootprint` gives the validator). */
export function sceneBox(props: Pick<SceneProps, 'anchor' | 'w' | 'h'>, sz: { top: number; bottom: number; left: number; right: number }): { x: number; y: number; w: number; h: number } {
  const { w, h } = props;
  switch (props.anchor ?? 'top') {
    case 'bottom': return { x: 0.5 - w / 2, y: 1 - sz.bottom - h, w, h };
    case 'center': return { x: 0.5 - w / 2, y: 0.5 - h / 2, w, h };
    case 'left': return { x: sz.left, y: 0.5 - h / 2, w, h };
    case 'right': return { x: 1 - sz.right - w, y: 0.5 - h / 2, w, h };
    default: return { x: 0.5 - w / 2, y: sz.top, w, h };
  }
}

/** A free composition of a few basic blocks (boxes, text, icons, images, lines; rows, columns, grids, stacks), each with its own keyframes; see SKILL.md. */
export const Scene: LayerComponent = ({ layer, theme, assetBase }) => {
  const frame = useCurrentFrame();
  const { fps, width, height, durationInFrames } = useVideoConfig();
  const props = layer.props as unknown as SceneProps;
  if (!props?.root) return null;
  const root = expandScene(props.root, { durationSec: durationInFrames / fps, fps, staggerFrames: theme.motion.staggerFrames, exitFrames: theme.motion.exitFrames });
  const box = sceneBox(props, theme.limits.safeZone);
  const { exit } = enterExit(frame, durationInFrames, theme.motion, fps);

  return (
    <AbsoluteFill style={{ opacity: 1 - exit, pointerEvents: 'none' }}>
      <div style={{ position: 'absolute', left: box.x * width, top: box.y * height, width: box.w * width, height: box.h * height, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
        <NodeView n={root} t={frame / fps} u={Math.min(width, height) / 1080} palette={scenePalette(theme)} theme={theme} assetBase={assetBase} />
      </div>
    </AbsoluteFill>
  );
};
