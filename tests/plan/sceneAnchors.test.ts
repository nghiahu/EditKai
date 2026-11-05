import { describe, expect, it } from 'vitest';
import { resolveAnchors, unresolvedAnchors } from '../../src/plan/sceneAnchors';
import type { SceneNode } from '../../src/plan/scene';

const words = Array.from({ length: 20 }, (_, i) => ({ t: `w${i}`, s: 10 + i * 0.5, e: 10 + i * 0.5 + 0.4 })); // word i starts at 10 + 0.5 i
const props = (root: SceneNode) => ({ anchor: 'top', w: 0.9, h: 0.3, root });
const box = (extra: Partial<SceneNode> = {}): SceneNode => ({ id: 'a', kind: 'box', ...extra });

describe('resolveAnchors', () => {
  it('turns a spoken word into seconds from the start of the scene: its start by default, its end with edge "end", plus the offset', () => {
    const p = props(box({ keys: { opacity: [{ at: { word: 4 }, v: 0 }, { at: { word: 4, edge: 'end', offset: 0.1 }, v: 1 }] } }));
    const r = resolveAnchors(p, words, 11); // the scene starts at 11 s; word 4 starts at 12, ends at 12.4
    const k = (r.props.root as SceneNode).keys!.opacity!;
    expect(k[0].at).toBeCloseTo(1, 9);
    expect(k[1].at).toBeCloseTo(1.5, 9);
    expect(r.issues).toEqual([]);
  });
  it('reaches every place a time can be: keys, enter, exit, highlight (one or several), in the children too', () => {
    const root: SceneNode = { id: 'r', kind: 'column', children: [
      box({ id: 'e', enter: { kind: 'pop', at: { word: 2 } } }),
      box({ id: 'x', exit: { at: { word: 6 } } }),
      box({ id: 'h', highlight: [{ at: { word: 3 }, until: { word: 5 }, to: { scale: 1.1 } }, { at: { word: 8 }, until: { word: 9 }, to: { scale: 1.1 } }] }),
    ] };
    const out = resolveAnchors(props(root), words, 10).props.root as SceneNode;
    expect(unresolvedAnchors({ ...props(root), root: out })).toEqual([]);
    expect((out.children![0].enter!.at as number)).toBeCloseTo(1, 9);
    expect(((out.children![1].exit as { at: number }).at)).toBeCloseTo(3, 9);
    const hl = out.children![2].highlight as { at: number; until: number }[];
    expect(hl.map(h => [h.at, h.until])).toEqual([[1.5, 2.5], [4, 4.5]]);
  });
  it('numbers are left alone and the input is not changed', () => {
    const p = props(box({ enter: { kind: 'fade', at: 0.5 }, keys: { opacity: [{ at: 0, v: 0 }, { at: { word: 1 }, v: 1 }] } }));
    const before = JSON.stringify(p);
    const out = resolveAnchors(p, words, 10);
    expect(JSON.stringify(p)).toBe(before);
    expect((out.props.root as SceneNode).enter!.at).toBe(0.5);
  });
  it('a word before the scene starts is clamped to 0 and reported; a word that does not exist stays as it was and is reported', () => {
    const p = props(box({ keys: { opacity: [{ at: { word: 0 }, v: 0 }, { at: { word: 99 }, v: 1 }] } }));
    const out = resolveAnchors(p, words, 12); // word 0 starts at 10: two seconds before
    const k = (out.props.root as SceneNode).keys!.opacity!;
    expect(k[0].at).toBe(0);
    expect(k[1].at).toEqual({ word: 99 });
    expect(out.issues.join('\n')).toMatch(/root\.keys\.opacity\[0\]\.at.*trước/);
    expect(out.issues.join('\n')).toMatch(/root\.keys\.opacity\[1\]\.at.*99/);
    expect(unresolvedAnchors(out.props)).toEqual(['root.keys.opacity[1].at']);
  });
  it('a scene with no word anchors comes back the same', () => {
    const p = props(box({ enter: { kind: 'fade' } }));
    expect(resolveAnchors(p, words, 10).props).toEqual(p);
  });
});
