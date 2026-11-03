import { describe, it, expect } from 'vitest';
import { resolveCaptionProps, groupRuns, CAPTION_VARIANTS, CAPTION_POSITIONS, CAPTION_EMPHASES } from '../../src/plan/captionProps';

const theme = { captionEmphasis: 'box' as const };

describe('constants', () => {
  it('list the allowed values', () => {
    expect([...CAPTION_VARIANTS]).toEqual(['phrase', 'word', 'big', 'label']);
    expect([...CAPTION_POSITIONS]).toEqual(['top', 'center', 'bottom']);
    expect([...CAPTION_EMPHASES]).toEqual(['box', 'ink', 'underline']);
  });
});

describe('resolveCaptionProps', () => {
  it('defaults: phrase, bottom, theme emphasis, no handles', () => {
    expect(resolveCaptionProps({}, theme)).toEqual({ variant: 'phrase', position: 'bottom', emphasis: 'box', handles: false });
    expect(resolveCaptionProps(undefined, { captionEmphasis: 'underline' }).emphasis).toBe('underline');
  });
  it('big defaults to position center', () => {
    expect(resolveCaptionProps({ variant: 'big' }, theme).position).toBe('center');
  });
  it('explicit values are kept', () => {
    expect(resolveCaptionProps({ variant: 'label', position: 'top', emphasis: 'ink', label: 'nó mở thêm' }, theme))
      .toEqual({ variant: 'label', position: 'top', emphasis: 'ink', label: 'nó mở thêm', handles: false });
  });
  it('keeps label only when it is a non-empty string', () => {
    expect(resolveCaptionProps({ label: '' }, theme).label).toBeUndefined();
    expect(resolveCaptionProps({ label: 5 }, theme).label).toBeUndefined();
    expect(resolveCaptionProps({ label: 'x' }, theme).label).toBe('x');
  });
  it('handles only counts for big', () => {
    expect(resolveCaptionProps({ variant: 'phrase', handles: true }, theme).handles).toBe(false);
    expect(resolveCaptionProps({ variant: 'big', handles: true }, theme).handles).toBe(true);
    expect(resolveCaptionProps({ variant: 'big', handles: 'yes' }, theme).handles).toBe(false);
  });
  it('free text falls back to the defaults without throwing (Review Focus 4)', () => {
    expect(resolveCaptionProps({ variant: 'Phrase', position: 'middle', emphasis: 5 }, theme))
      .toEqual({ variant: 'phrase', position: 'bottom', emphasis: 'box', handles: false });
  });
});

describe('groupRuns', () => {
  const hl = (s: string) => [...s].map(c => ({ hl: c === 't' }));
  it('returns no runs for no words', () => {
    expect(groupRuns([])).toEqual([]);
  });
  it('one run when nothing changes', () => {
    expect(groupRuns(hl('fff'))).toEqual([{ start: 0, end: 2, hl: false }]);
    expect(groupRuns(hl('tt'))).toEqual([{ start: 0, end: 1, hl: true }]);
  });
  it('merges adjacent highlighted words and keeps separate runs apart', () => {
    expect(groupRuns(hl('fttft'))).toEqual([
      { start: 0, end: 0, hl: false }, { start: 1, end: 2, hl: true }, { start: 3, end: 3, hl: false }, { start: 4, end: 4, hl: true },
    ]);
  });
});
