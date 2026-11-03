import { describe, it, expect } from 'vitest';
import {
  FOOTAGE_FRAMES, FOOTAGE_MOTIONS, INSERT_POSITIONS, footageMuted, footageProblem, resolveFootageProps,
} from '../../src/plan/insertProps';

describe('constants', () => {
  it('list the allowed values', () => {
    expect([...INSERT_POSITIONS]).toEqual(['top', 'center', 'bottom']);
    expect([...FOOTAGE_FRAMES]).toEqual(['none', 'window', 'phone']);
    expect([...FOOTAGE_MOTIONS]).toEqual(['none', 'zoom-in', 'zoom-out', 'pan-left', 'pan-right']);
  });
});

describe('resolveFootageProps', () => {
  it('has defaults for a bare footage props object', () => {
    expect(resolveFootageProps({ src: 'assets/a.mp4' })).toEqual({
      src: 'assets/a.mp4', fit: 'cover', frame: 'none', motion: 'none', focus: { x: 0.5, y: 0.5 }, from: 0, sound: false, dim: false,
    });
    expect(resolveFootageProps(undefined).src).toBe('');
  });
  it('dim defaults to false for cover and true for contain, window and phone; an explicit dim wins', () => {
    expect(resolveFootageProps({ fit: 'contain' }).dim).toBe(true);
    expect(resolveFootageProps({ frame: 'window' }).dim).toBe(true);
    expect(resolveFootageProps({ frame: 'phone' }).dim).toBe(true);
    expect(resolveFootageProps({ frame: 'phone', dim: false }).dim).toBe(false);
    expect(resolveFootageProps({ fit: 'cover', dim: true }).dim).toBe(true);
  });
  it('keeps valid values', () => {
    const r = resolveFootageProps({ src: 'x', fit: 'contain', frame: 'window', motion: 'zoom-in', focus: { x: 0.3, y: 0.6 }, from: 2.5, title: 'Editor', sound: true });
    expect(r).toMatchObject({ fit: 'contain', frame: 'window', motion: 'zoom-in', focus: { x: 0.3, y: 0.6 }, from: 2.5, title: 'Editor', sound: true });
  });
  it('shows the title only for a window frame', () => {
    expect(resolveFootageProps({ frame: 'phone', title: 'T' }).title).toBeUndefined();
    expect(resolveFootageProps({ frame: 'window', title: '' }).title).toBeUndefined();
  });
  it('falls back to the defaults for free text and out-of-range numbers (Review Focus 2)', () => {
    const r = resolveFootageProps({ frame: 'Window', motion: 5, from: -3, focus: { x: 2 }, sound: 'yes', fit: 'stretch' });
    expect(r).toMatchObject({ frame: 'none', motion: 'none', from: 0, focus: { x: 0.5, y: 0.5 }, sound: false, fit: 'cover' });
    expect(resolveFootageProps({ from: NaN }).from).toBe(0);
  });
});

describe('footageMuted', () => {
  it('is true unless sound is exactly true', () => {
    expect(footageMuted(undefined)).toBe(true);
    expect(footageMuted({})).toBe(true);
    expect(footageMuted({ sound: 'yes' })).toBe(true);
    expect(footageMuted({ sound: false })).toBe(true);
    expect(footageMuted({ sound: true })).toBe(false);
  });
});

describe('footageProblem', () => {
  it('accepts every value of each set and bare props', () => {
    expect(footageProblem(undefined)).toBeUndefined();
    expect(footageProblem({ src: 'x' })).toBeUndefined();
    for (const fit of ['cover', 'contain']) expect(footageProblem({ fit })).toBeUndefined();
    for (const frame of FOOTAGE_FRAMES) expect(footageProblem({ frame })).toBeUndefined();
    for (const motion of FOOTAGE_MOTIONS) expect(footageProblem({ motion })).toBeUndefined();
    expect(footageProblem({ frame: 'window', title: 'Editor', from: 0, focus: { x: 0, y: 1 }, sound: false, dim: true })).toBeUndefined();
  });
  it('rejects bad values', () => {
    for (const props of [
      { fit: 'stretch' }, { frame: 'Window' }, { motion: 'zoom' }, { from: -1 }, { from: NaN }, { from: '2' },
      { focus: { x: 1.5, y: 0.5 } }, { focus: 'center' }, { focus: { x: 0.5 } },
      { frame: 'phone', title: 'T' }, { title: 'T' }, { frame: 'window', title: 3 },
      { sound: 'yes' }, { dim: 1 },
    ]) expect(footageProblem(props), JSON.stringify(props)).toEqual(expect.any(String));
  });
});
