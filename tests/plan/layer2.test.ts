import { describe, expect, it } from 'vitest';
import { counterValue, formatCount } from '../../src/plan/counter';
import { insertDims } from '../../src/plan/insertProps';
import { counterProblem, quoteCardProblem, resolveCounter, resolveQuoteCard } from '../../src/plan/insertTypes';
import { LAYER_TYPES } from '../../src/plan/layerTypes';

describe('quote-card props', () => {
  it('defaults: centre, no author; the quote is kept as written', () => {
    expect(resolveQuoteCard({ quote: 'Câu chuyện là tất cả' })).toEqual({ quote: 'Câu chuyện là tất cả', position: 'center' });
    expect(resolveQuoteCard({ quote: 'x', author: 'Minh', position: 'top' })).toEqual({ quote: 'x', author: 'Minh', position: 'top' });
    expect(resolveQuoteCard({ quote: 'x', author: '', position: 'middle' })).toEqual({ quote: 'x', position: 'center' });
    expect(resolveQuoteCard(undefined).quote).toBe('');
  });
  it('problems: a missing, empty, non-string or too long quote; a non-string author; a bad position or dim', () => {
    expect(quoteCardProblem({})).toMatch(/quote/);
    expect(quoteCardProblem({ quote: '' })).toMatch(/quote/);
    expect(quoteCardProblem({ quote: 5 })).toMatch(/quote/);
    expect(quoteCardProblem({ quote: 'a'.repeat(241) })).toMatch(/240/);
    expect(quoteCardProblem({ quote: 'ok', author: 3 })).toMatch(/author/);
    expect(quoteCardProblem({ quote: 'ok', position: 'middle' })).toMatch(/position/);
    expect(quoteCardProblem({ quote: 'ok', dim: 'yes' })).toMatch(/dim/);
    expect(quoteCardProblem({ quote: 'ok', author: 'Ai đó', position: 'bottom', dim: false })).toBeUndefined();
  });
});

describe('counter props', () => {
  it('defaults: from 0, no decimals, centre; keeps prefix, suffix and label', () => {
    expect(resolveCounter({ to: 100 })).toEqual({ from: 0, to: 100, decimals: 0, position: 'center' });
    expect(resolveCounter({ from: 10, to: 2.5, decimals: 1, prefix: '+', suffix: '%', label: 'tăng trưởng', position: 'top' }))
      .toEqual({ from: 10, to: 2.5, decimals: 1, prefix: '+', suffix: '%', label: 'tăng trưởng', position: 'top' });
    expect(resolveCounter({ to: 5, decimals: 9 }).decimals).toBe(0); // out of range falls back
  });
  it('problems: to is required and must be a finite number; from, decimals, texts, position, dim are checked', () => {
    expect(counterProblem({})).toMatch(/to/);
    expect(counterProblem({ to: '5' })).toMatch(/to/);
    expect(counterProblem({ to: Number.POSITIVE_INFINITY })).toMatch(/to/);
    expect(counterProblem({ to: 5, from: 'a' })).toMatch(/from/);
    expect(counterProblem({ to: 5, decimals: 4 })).toMatch(/decimals/);
    expect(counterProblem({ to: 5, decimals: 1.5 })).toMatch(/decimals/);
    expect(counterProblem({ to: 5, suffix: 3 })).toMatch(/suffix/);
    expect(counterProblem({ to: 5, position: 'x' })).toMatch(/position/);
    expect(counterProblem({ to: 5, dim: 1 })).toMatch(/dim/);
    expect(counterProblem({ to: 0 })).toBeUndefined(); // zero is a fine target
    expect(counterProblem({ to: -3, from: 10, decimals: 2, prefix: '$' })).toBeUndefined();
  });
});

describe('counterValue and formatCount', () => {
  it('runs from `from` to `to` as progress goes 0 to 1, and stays inside while progress is clamped', () => {
    expect(counterValue(0, 0, 100, 0)).toBe(0);
    expect(counterValue(1, 0, 100, 0)).toBe(100);
    expect(counterValue(0.5, 0, 100, 0)).toBe(50);
    expect(counterValue(2, 0, 100, 0)).toBe(100);
    expect(counterValue(-1, 20, 100, 0)).toBe(20);
    expect(counterValue(0.5, 10, 0, 0)).toBe(5); // counting down
  });
  it('rounds to the decimals so it never shows more digits than asked', () => {
    expect(counterValue(0.333, 0, 1, 1)).toBe(0.3);
    expect(counterValue(0.5, 0, 3, 0)).toBe(2); // 1.5 rounds up
  });
  it('formats the Vietnamese way: dot for thousands, comma for decimals', () => {
    expect(formatCount(1250, 0)).toBe('1.250');
    expect(formatCount(1234567, 0)).toBe('1.234.567');
    expect(formatCount(2.5, 1)).toBe('2,5');
    expect(formatCount(3, 2)).toBe('3,00');
    expect(formatCount(0, 0)).toBe('0');
    expect(formatCount(-1250, 0)).toBe('-1.250');
  });
});

describe('layer registry for the new inserts', () => {
  it('quote-card and counter are graphic layers whose checks are the props checks', () => {
    expect(LAYER_TYPES['quote-card'].track).toBe('graphic');
    expect(LAYER_TYPES.counter.track).toBe('graphic');
    expect(LAYER_TYPES['quote-card'].check({})).toMatch(/quote/);
    expect(LAYER_TYPES.counter.check({})).toMatch(/to/);
    expect(LAYER_TYPES.counter.check({ to: 5 })).toBeUndefined();
  });
  it('both dim the speaker like a stat card unless dim is false', () => {
    expect(insertDims({ type: 'quote-card', props: { quote: 'x' } })).toBe(true);
    expect(insertDims({ type: 'counter', props: { to: 1 } })).toBe(true);
    expect(insertDims({ type: 'counter', props: { to: 1, dim: false } })).toBe(false);
  });
  it('transition accepts whip and dip as well as the five old kinds', () => {
    for (const kind of ['zoom', 'blur', 'slide', 'push', 'flash', 'whip', 'dip']) expect(LAYER_TYPES.transition.check({ kind }), kind).toBeUndefined();
    expect(LAYER_TYPES.transition.check({ kind: 'spin' })).toMatch(/whip/);
  });
});
