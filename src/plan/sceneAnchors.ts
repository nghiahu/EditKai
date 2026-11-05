// Browser-safe (no node imports): word anchors of a scene.
import type { Anchor, SceneNode } from './scene';

type Words = { t: string; s: number; e: number }[];

/** Calls `fn` for every anchor in the scene's props (keys, enter, exit, highlight, in every node), with the path to it; `fn` returns the anchor to put there. */
function mapAnchors(props: Record<string, unknown>, fn: (a: Anchor, path: string) => Anchor): Record<string, unknown> {
  const node = (n: SceneNode, path: string): SceneNode => {
    const out: SceneNode = { ...n };
    if (n.keys) {
      out.keys = {};
      for (const [prop, list] of Object.entries(n.keys)) (out.keys as Record<string, unknown>)[prop] = list!.map((k, i) => ({ ...k, at: fn(k.at, `${path}.keys.${prop}[${i}].at`) }));
    }
    if (n.enter?.at !== undefined) out.enter = { ...n.enter, at: fn(n.enter.at, `${path}.enter.at`) };
    if (typeof n.exit === 'object' && n.exit.at !== undefined) out.exit = { ...n.exit, at: fn(n.exit.at, `${path}.exit.at`) };
    if (n.highlight) {
      const one = (h: NonNullable<SceneNode['highlight']> extends infer H ? (H extends unknown[] ? H[number] : H) : never, p: string) => ({ ...h, at: fn(h.at, `${p}.at`), until: fn(h.until, `${p}.until`) });
      out.highlight = Array.isArray(n.highlight) ? n.highlight.map((h, i) => one(h, `${path}.highlight[${i}]`)) : one(n.highlight, `${path}.highlight`);
    }
    if (n.children) out.children = n.children.map((c, i) => node(c, `${path}.children[${i}]`));
    return out;
  };
  return props.root ? { ...props, root: node(props.root as SceneNode, 'root') } : props;
}

/** Paths of the word anchors that are still words (a plan.json must have none: `compose` turns them into seconds). */
export function unresolvedAnchors(props: Record<string, unknown>): string[] {
  const found: string[] = [];
  mapAnchors(props, (a, path) => { if (typeof a !== 'number') found.push(path); return a; });
  return found;
}

/**
 * Turns every word anchor `{ word, offset?, edge? }` into seconds from the start of the scene (`layerStart` is where the scene starts on the video):
 * the start of the word (its end with edge "end") plus the offset. A time before the scene starts becomes 0 and is reported; a word that does
 * not exist is reported and the anchor is left as it was (the validator then refuses the scene). Numbers are left alone; the input is not changed.
 */
export function resolveAnchors(props: Record<string, unknown>, words: Words, layerStart: number): { props: Record<string, unknown>; issues: string[] } {
  const issues: string[] = [];
  const out = mapAnchors(props, (a, path) => {
    if (typeof a === 'number') return a;
    const w = words[a.word];
    if (!w) { issues.push(`${path}: không có từ số ${a.word} trong lời (có ${words.length} từ)`); return a; }
    const t = (a.edge === 'end' ? w.e : w.s) + (a.offset ?? 0) - layerStart;
    if (t < 0) { issues.push(`${path}: từ số ${a.word} nằm trước lúc cảnh bắt đầu ${(-t).toFixed(2)} s; đã đặt về 0`); return 0; }
    return t;
  });
  return { props: out, issues };
}
