import { describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';
import { planOf, stillOf } from './helper';
import type { Layer } from '../../src/plan/types';

const title = (override?: Record<string, unknown>): Layer => ({
  id: 't1', track: 'title', type: 'title-card', start: 0, end: 4, override,
  props: { icon: 'video', title: 'THẬT SỰ TỰ TIN TRƯỚC ỐNG KÍNH', sub: 'chương trình đào tạo, bởi vì mọi người đều có thể' },
} as Layer);
const bytes = async (layer: Layer, style: 's1' | 'm1') => readFileSync(await stillOf(planOf(style, [layer]), 30));

describe('the Vietnamese font', () => {
  for (const style of ['s1', 'm1'] as const) {
    it(`${style}: Vietnamese text is set in the style's own font (Be Vietnam Pro), not in whatever the machine falls back to`, async () => {
      const own = await bytes(title(), style);
      const arial = await bytes(title({ fonts: { heading: 'Arial', body: 'Arial' } }), style);
      expect(own.equals(arial)).toBe(false);
    }, 300000);
  }
  it('the font files are in the project, with their licence', () => {
    for (const w of [400, 700, 800, 900]) for (const subset of ['latin', 'vietnamese'])
      expect(() => readFileSync(`node_modules/@fontsource/be-vietnam-pro/files/be-vietnam-pro-${subset}-${w}-normal.woff2`)).not.toThrow();
    expect(readFileSync('node_modules/@fontsource/be-vietnam-pro/LICENSE', 'utf8')).toMatch(/SIL OPEN FONT LICENSE/i);
  });
});
