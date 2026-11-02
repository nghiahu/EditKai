import { describe, it, expect } from 'vitest';
import { titleInset } from '../../remotion/components/ExplainerScene';

describe('ExplainerScene layout', () => {
  it('reserves room for the avatar circle (150 px + 4 px border + gap) beside the title', () => {
    expect(titleInset(true)).toBeGreaterThanOrEqual(150 + 8 + 16);
  });
  it('uses no inset without an avatar', () => {
    expect(titleInset(false)).toBe(0);
  });
});
