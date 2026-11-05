import { describe, expect, it } from 'vitest';
import { mkdtempSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { faceRegion, overlapShare, readFaces, type Faces } from '../../src/media/faces';

const box = (x: number, y: number, w: number, h: number) => ({ x, y, w, h });
const faces = (samples: [number, ReturnType<typeof box> | null][]): Faces => ({ fps: 4, samples: samples.map(([t, b]) => ({ t, box: b, conf: b ? 0.99 : 0 })) });

describe('faceRegion', () => {
  const f = faces([[0, box(0.4, 0.2, 0.2, 0.3)], [0.25, box(0.42, 0.2, 0.2, 0.3)], [0.5, null], [0.75, box(0.38, 0.22, 0.2, 0.3)], [1, box(0.4, 0.2, 0.2, 0.3)]]);
  it('is the box around every face seen in the span, plus the margin', () => {
    const r = faceRegion(f, 0, 0.8, 0)!;
    expect(r.x).toBeCloseTo(0.38, 5);
    expect(r.y).toBeCloseTo(0.2, 5);
    expect(r.x + r.w).toBeCloseTo(0.62, 5);
    expect(r.y + r.h).toBeCloseTo(0.52, 5);
    const m = faceRegion(f, 0, 0.8, 0.05)!;
    expect(m.x).toBeCloseTo(0.33, 5);
    expect(m.y).toBeCloseTo(0.15, 5);
  });
  it('a span shorter than the sampling gap uses the sample just before it', () => {
    expect(faceRegion(f, 0.3, 0.35, 0)).toEqual(box(0.42, 0.2, 0.2, 0.3));
  });
  it('gives nothing when no face was seen in the span, and stays inside the frame', () => {
    expect(faceRegion(faces([[0, null], [0.25, null]]), 0, 1)).toBeUndefined();
    expect(faceRegion(faces([]), 0, 1)).toBeUndefined();
    const edge = faceRegion(faces([[0, box(0.02, 0.01, 0.3, 0.3)]]), 0, 0.1, 0.1)!;
    expect(edge.x).toBe(0);
    expect(edge.y).toBe(0);
    expect(faceRegion(faces([[0, box(0.8, 0.8, 0.2, 0.2)]]), 0, 0.1, 0.1)!.x + faceRegion(faces([[0, box(0.8, 0.8, 0.2, 0.2)]]), 0, 0.1, 0.1)!.w).toBeLessThanOrEqual(1);
  });
  it('a span that ends before the first sample finds nothing to use', () => {
    expect(faceRegion(faces([[5, box(0.4, 0.2, 0.2, 0.3)]]), 0, 1)).toBeUndefined();
  });
});

describe('overlapShare', () => {
  const face = box(0.4, 0.2, 0.2, 0.2);
  it('is the share of the face the other box covers: none, half, all', () => {
    expect(overlapShare(face, box(0.7, 0.7, 0.1, 0.1))).toBe(0);
    expect(overlapShare(face, box(0.5, 0.2, 0.5, 0.2))).toBeCloseTo(0.5, 5);
    expect(overlapShare(face, box(0, 0, 1, 1))).toBeCloseTo(1, 9);
  });
  it('a face with no area is covered by nothing', () => {
    expect(overlapShare(box(0.5, 0.5, 0, 0.1), box(0, 0, 1, 1))).toBe(0);
  });
});

describe('readFaces', () => {
  it('is undefined when there is no faces.json, a clear error when it is broken', () => {
    const dir = mkdtempSync(join(tmpdir(), 'editkai-faces-'));
    expect(readFaces(dir)).toBeUndefined();
    writeFileSync(join(dir, 'faces.json'), '{ nope');
    expect(() => readFaces(dir)).toThrow(/faces\.json/);
    writeFileSync(join(dir, 'faces.json'), JSON.stringify({ fps: 4, samples: [{ t: 0, box: null, conf: 0 }] }));
    expect(readFaces(dir)).toEqual({ fps: 4, samples: [{ t: 0, box: null, conf: 0 }] });
    writeFileSync(join(dir, 'faces.json'), JSON.stringify({ fps: 4 }));
    expect(() => readFaces(dir)).toThrow(/faces\.json/);
  });
});
