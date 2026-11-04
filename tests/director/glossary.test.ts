import { describe, it, expect } from 'vitest';
import { mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { isNegation, loadGlossary } from '../../src/director/glossary';

const project = (glossary?: unknown, raw?: string) => {
  const dir = mkdtempSync(join(tmpdir(), 'editkai-glossary-'));
  if (raw !== undefined) writeFileSync(join(dir, 'glossary.json'), raw);
  else if (glossary !== undefined) writeFileSync(join(dir, 'glossary.json'), JSON.stringify(glossary));
  return dir;
};

describe('loadGlossary', () => {
  it('the default glossary has every list', () => {
    const dir = project();
    const g = loadGlossary(dir);
    expect(g.terms.map(t => t.term)).toContain('Claude');
    for (const list of [g.ui, g.shortvideo, g.emphasis, g.promptVerbs]) expect(list.length).toBeGreaterThan(0);
    expect(g.shortvideo).toContain('tiktok');
    expect(g.promptVerbs).toContain('prompt');
    rmSync(dir, { recursive: true, force: true });
  });
  it('merges a project glossary, keeps the project label for a repeated term and removes duplicates', () => {
    const dir = project({
      terms: [{ term: 'Remotion', label: 'thư viện' }, { term: 'claude', label: 'mô hình' }],
      ui: ['bảng điều khiển', 'GIAO DIỆN'.normalize('NFD')],
      emphasis: ['siêu'],
    });
    const g = loadGlossary(dir);
    const claude = g.terms.filter(t => t.term.toLowerCase() === 'claude');
    expect(claude).toHaveLength(1);
    expect(claude[0].label).toBe('mô hình'); // the project entry wins
    expect(g.terms.map(t => t.term)).toContain('Remotion');
    expect(g.ui).toContain('bảng điều khiển');
    expect(g.ui.filter(u => u.normalize('NFD').toLowerCase().startsWith('giao'))).toHaveLength(1);
    expect(g.emphasis).toContain('siêu');
    expect(g.emphasis).toContain('đừng'); // defaults are still there
    rmSync(dir, { recursive: true, force: true });
  });
  it('a corrupt project glossary throws a clear error', () => {
    const dir = project(undefined, '{ not json');
    expect(() => loadGlossary(dir)).toThrow(/glossary\.json không phải JSON hợp lệ/);
    rmSync(dir, { recursive: true, force: true });
  });
  it('a project glossary with missing lists keeps the defaults', () => {
    const dir = project({});
    expect(loadGlossary(dir).ui.length).toBeGreaterThan(0);
    rmSync(dir, { recursive: true, force: true });
  });
});

describe('isNegation', () => {
  it('matches đừng, không and chưa (any diacritics) but not rất', () => {
    for (const w of ['đừng', 'Đừng', 'không', 'khong', 'chưa', 'đừng có']) expect(isNegation(w)).toBe(true);
    for (const w of ['rất', 'quá', '', 'dùng', 'đúng', 'dung']) expect(isNegation(w)).toBe(false);
    expect(isNegation('Đừng,'.normalize('NFD'))).toBe(true);
  });
});
