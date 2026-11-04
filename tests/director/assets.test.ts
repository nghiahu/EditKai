import { describe, it, expect } from 'vitest';
import { matchAsset } from '../../src/director/assets';
import type { Asset } from '../../src/assets/manifest';
import type { Cue } from '../../src/director/types';

const asset = (file: string, description: string, kind: Asset['kind'] = 'other'): Asset => ({ file, description, kind });
const cue = (kind: Cue['kind']): Cue => ({ kind, text: 'x', word: 0 });

describe('matchAsset', () => {
  it('matches an asset by shared words, ignoring diacritics', () => {
    const a = asset('assets/a.mp4', 'quay màn hình giao diện editor');
    const m = matchAsset('Nó mở thêm tool Editor trực tiếp, hiển thị giao diện', [], [a]);
    expect(m?.asset).toBe(a);
    expect(m!.score).toBeGreaterThanOrEqual(3);
  });
  it('NFC and NFD descriptions and beats match alike (Review Focus 4)', () => {
    const desc = 'quay màn hình giao diện editor';
    const beat = 'mở giao diện editor lên';
    const nfc = matchAsset(beat.normalize('NFC'), [], [asset('a', desc.normalize('NFC'))]);
    const nfd = matchAsset(beat.normalize('NFD'), [], [asset('a', desc.normalize('NFD'))]);
    expect(nfc?.score).toBeDefined();
    expect(nfd?.score).toBe(nfc?.score);
  });
  it('a screen asset gets the bonus with a ui cue, a phone asset with a shortvideo cue', () => {
    const screen = asset('s', 'cảnh quay khác hẳn', 'screen');
    const phone = asset('p', 'cảnh quay khác hẳn', 'phone');
    expect(matchAsset('không liên quan gì', [cue('ui')], [screen])?.asset).toBe(screen);
    expect(matchAsset('không liên quan gì', [cue('shortvideo')], [phone])?.asset).toBe(phone);
  });
  it('the bonus needs the matching kind and cue', () => {
    expect(matchAsset('không liên quan gì', [cue('shortvideo')], [asset('s', 'cảnh quay khác hẳn', 'screen')])).toBeUndefined();
    expect(matchAsset('không liên quan gì', [cue('ui')], [asset('p', 'cảnh quay khác hẳn', 'phone')])).toBeUndefined();
    expect(matchAsset('không liên quan gì', [cue('ui')], [asset('o', 'cảnh quay khác hẳn', 'photo')])).toBeUndefined();
  });
  it('a score below 2 gives undefined', () => {
    expect(matchAsset('hôm nay trời đẹp, editor mở sẵn', [], [asset('a', 'quay giao diện editor')])).toBeUndefined();
  });
  it('ties go to the earlier asset', () => {
    const first = asset('first', 'giao diện editor');
    const second = asset('second', 'giao diện editor');
    expect(matchAsset('giao diện editor', [], [first, second])?.asset).toBe(first);
  });
  it('the higher score wins over an earlier asset', () => {
    const weak = asset('weak', 'giao diện');
    const strong = asset('strong', 'giao diện editor timeline');
    expect(matchAsset('giao diện editor timeline', [], [weak, strong])?.asset).toBe(strong);
  });
  it('stop words and words shorter than 3 characters do not count', () => {
    expect(matchAsset('của cho một các và là đi', [], [asset('a', 'của cho một các và là đi')])).toBeUndefined();
  });
  it('no assets gives undefined', () => {
    expect(matchAsset('giao diện editor', [], [])).toBeUndefined();
  });
});
