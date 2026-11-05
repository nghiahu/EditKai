import { describe, expect, it } from 'vitest';
import { resolveStepNumber, stepNumberProblem } from '../../src/plan/insertTypes';
import { parseStep } from '../../src/plan/stepNumber';
import { LAYER_TYPES } from '../../src/plan/layerTypes';

describe('step-number props', () => {
  it('a whole number from 1 to 99 is enough; a title (40 characters) and a sub-line (60) are optional', () => {
    expect(stepNumberProblem({ number: 1 })).toBeUndefined();
    expect(stepNumberProblem({ number: 99, title: 'x'.repeat(40), sub: 'y'.repeat(60), position: 'center' })).toBeUndefined();
  });
  it('names what is wrong', () => {
    expect(stepNumberProblem({})).toMatch(/number/);
    expect(stepNumberProblem({ number: 0 })).toMatch(/number/);
    expect(stepNumberProblem({ number: 100 })).toMatch(/number/);
    expect(stepNumberProblem({ number: 2.5 })).toMatch(/number/);
    expect(stepNumberProblem({ number: '2' })).toMatch(/number/);
    expect(stepNumberProblem({ number: 2, title: '' })).toMatch(/title/);
    expect(stepNumberProblem({ number: 2, title: 'x'.repeat(41) })).toMatch(/title/);
    expect(stepNumberProblem({ number: 2, sub: 'y'.repeat(61) })).toMatch(/sub/);
    expect(stepNumberProblem({ number: 2, position: 'middle' })).toMatch(/position/);
  });
  it('resolveStepNumber defaults to the top and never throws', () => {
    expect(resolveStepNumber({ number: 3, title: 'Mở máy' })).toEqual({ number: 3, title: 'Mở máy', position: 'top' });
    expect(resolveStepNumber({ number: 3, position: 'bottom' }).position).toBe('bottom');
    expect(() => resolveStepNumber(undefined)).not.toThrow();
    expect(resolveStepNumber({ number: 'x' }).number).toBe(1);
  });
  it('is a graphic layer type', () => {
    expect(LAYER_TYPES['step-number'].track).toBe('graphic');
    expect(LAYER_TYPES['step-number'].check({ number: 2 })).toBeUndefined();
    expect(LAYER_TYPES['step-number'].check({})).toMatch(/number/);
  });
});

describe('parseStep: the number in a spoken step mark', () => {
  it('reads "bước 3", "thứ hai" ... "thứ mười", "thứ nhất", in any case', () => {
    expect(parseStep('BƯỚC 3')).toBe(3);
    expect(parseStep('bước 12')).toBe(12);
    expect(parseStep('THỨ NHẤT')).toBe(1);
    expect(parseStep('THỨ HAI')).toBe(2);
    expect(parseStep('thứ ba')).toBe(3);
    expect(parseStep('Thứ Tư')).toBe(4);
    expect(parseStep('THỨ NĂM')).toBe(5);
    expect(parseStep('THỨ MƯỜI')).toBe(10);
    expect(parseStep('MẸO SỐ 3')).toBe(3);
  });
  it('is undefined for anything else: "đầu tiên" is not necessarily a list, nor is "mở bài", nor a number out of range', () => {
    expect(parseStep('ĐẦU TIÊN')).toBeUndefined();
    expect(parseStep('MỞ BÀI')).toBeUndefined();
    expect(parseStep('BƯỚC 0')).toBeUndefined();
    expect(parseStep('BƯỚC 100')).toBeUndefined();
    expect(parseStep('')).toBeUndefined();
  });
  it('does not care about tone marks or NFD', () => {
    expect(parseStep('thu hai')).toBe(2);
    expect(parseStep('THỨ HAI'.normalize('NFD'))).toBe(2);
  });
});
