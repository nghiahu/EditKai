import { describe, expect, it } from 'vitest';
import { existsSync, mkdtempSync, readFileSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { fixTranscript } from '../../src/stages/fixTranscript';

type W = { t: string; s: number; e: number };
const project = (words: string[]): string => {
  const dir = join(mkdtempSync(join(tmpdir(), 'editkai-fix-')));
  writeFileSync(join(dir, 'transcript.json'), JSON.stringify({ words: words.map((t, i) => ({ t, s: i * 0.4, e: i * 0.4 + 0.3 })) }));
  return dir;
};
const fixes = (dir: string, list: unknown) => { const f = join(dir, 'transcript-fixes.json'); writeFileSync(f, JSON.stringify(list)); return f; };
const texts = (dir: string) => (JSON.parse(readFileSync(join(dir, 'transcript.json'), 'utf8')).words as W[]).map(w => w.t);

describe('fixTranscript', () => {
  it('replaces a wrongly heard word, keeps the punctuation around it and every word time', () => {
    const dir = project(['cái', 'áp,', 'thôi']);
    const r = fixTranscript(dir, fixes(dir, [{ sai: 'áp', dung: 'ác' }]));
    expect(r.changed).toBe(1);
    expect(texts(dir)).toEqual(['cái', 'ác,', 'thôi']);
    const w = JSON.parse(readFileSync(join(dir, 'transcript.json'), 'utf8')).words as W[];
    expect(w.map(x => x.s)).toEqual([0, 0.4, 0.8]);
  });
  it('"sau" and "tiep" limit a fix to a word after or before another word', () => {
    const dir = project(['là', 'câu', 'chuyện', 'cái', 'câu', 'chúc']);
    fixTranscript(dir, fixes(dir, [{ sai: 'câu', dung: 'cấu', tiep: 'chúc' }, { sai: 'chúc', dung: 'trúc', sau: 'câu' }]));
    expect(texts(dir)).toEqual(['là', 'câu', 'chuyện', 'cái', 'cấu', 'trúc']); // the first "câu" (before "chuyện") is left alone
  });
  it('"sau" compares with the word as Whisper heard it, so fixes do not depend on each other', () => {
    const dir = project(['câu', 'chúc']);
    fixTranscript(dir, fixes(dir, [{ sai: 'câu', dung: 'cấu' }, { sai: 'chúc', dung: 'trúc', sau: 'câu' }]));
    expect(texts(dir)).toEqual(['cấu', 'trúc']);
  });
  it('keeps the original in transcript.whisper.json and always fixes from it, so running again gives the same result', () => {
    const dir = project(['một', 'hai']);
    const f = fixes(dir, [{ sai: 'hai', dung: 'ba' }]);
    fixTranscript(dir, f);
    expect(existsSync(join(dir, 'transcript.whisper.json'))).toBe(true);
    fixTranscript(dir, fixes(dir, [{ sai: 'một', dung: 'số một' }]));
    expect(texts(dir)).toEqual(['số một', 'hai']); // the earlier "hai → ba" is not carried over
  });
  it('clear errors for a missing transcript, a missing or malformed fixes file', () => {
    const empty = mkdtempSync(join(tmpdir(), 'editkai-fix-'));
    expect(() => fixTranscript(empty, join(empty, 'x.json'))).toThrow('transcript-fixes.json');
    const dir = project(['a']);
    writeFileSync(join(dir, 'transcript-fixes.json'), '{ nope');
    expect(() => fixTranscript(dir)).toThrow(/không phải JSON/);
    expect(() => fixTranscript(dir, fixes(dir, [{ sai: 1 }]))).toThrow(/sai/);
    const noTranscript = mkdtempSync(join(tmpdir(), 'editkai-fix-'));
    writeFileSync(join(noTranscript, 'transcript-fixes.json'), '[]');
    expect(() => fixTranscript(noTranscript)).toThrow('transcript.json');
  });
});

describe('fixTranscript reports the fixes that matched nothing', () => {
  it('lists each unmatched fix so a wrong "sau" or "tiep" is noticed', () => {
    const dir = project(['cái', 'áp', 'thôi']);
    const r = fixTranscript(dir, fixes(dir, [{ sai: 'áp', dung: 'ác', sau: 'cái' }, { sai: 'xyz', dung: 'abc' }, { sai: 'áp', dung: 'ạc', tiep: 'sai' }]));
    expect(r.changed).toBe(1);
    expect(r.unmatched.map(f => f.sai)).toEqual(['xyz', 'áp']);
    expect(r.unmatched[1].tiep).toBe('sai');
  });
  it('nothing unmatched when every fix was used', () => {
    const dir = project(['áp']);
    expect(fixTranscript(dir, fixes(dir, [{ sai: 'áp', dung: 'ác' }])).unmatched).toEqual([]);
  });
});
