import { describe, expect, it } from 'vitest';
import { mkdtempSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { DEFAULT_PLAYBOOK, fillProps, loadPlaybook } from '../../src/director/playbook';

const styleDir = (playbook?: unknown, raw?: string) => {
  const dir = mkdtempSync(join(tmpdir(), 'editkai-playbook-'));
  if (raw !== undefined) writeFileSync(join(dir, 'playbook.json'), raw);
  else if (playbook !== undefined) writeFileSync(join(dir, 'playbook.json'), JSON.stringify(playbook));
  return dir;
};

describe('shipped playbooks', () => {
  it('every situation has at least one recipe with a known insert type and a positive duration', () => {
    for (const style of ['styles/s1', 'styles/m1', undefined]) {
      const pb = style ? loadPlaybook(style) : DEFAULT_PLAYBOOK;
      for (const s of ['tool', 'number', 'section', 'cta', 'list', 'filler']) {
        expect(pb.situations[s]?.length, `${style} ${s}`).toBeGreaterThan(0);
        for (const r of pb.situations[s]) { expect(r.id).toBeTruthy(); expect(r.duration).toBeGreaterThan(0); }
      }
    }
  });
  it('recipe ids are unique inside a playbook (usage is tracked by id)', () => {
    for (const style of ['styles/s1', 'styles/m1']) {
      const ids = Object.values(loadPlaybook(style).situations).flat().map(r => r.id);
      expect(new Set(ids).size).toBe(ids.length);
    }
  });
  it('m1 keeps the old first choices and offers a second one for a tool and a number (so there is something to rotate)', () => {
    const m1 = loadPlaybook('styles/m1').situations;
    expect(m1.tool[0].type).toBe('logo-badge');
    expect(m1.number[0].type).toBe('stat-card');
    expect(m1.list[0].type).toBe('chip-stack');
    expect(m1.tool.length).toBeGreaterThan(1);
    expect(m1.number.length).toBeGreaterThan(1);
  });
  it('s1 puts section and cta on a title card, the style\'s main insert', () => {
    const s1 = loadPlaybook('styles/s1').situations;
    expect(s1.section[0]).toMatchObject({ id: 'section-step', type: 'step-number', builder: 'step' }); // used only for a spoken step mark ("thứ hai", "bước 3")
    expect(s1.section[1].type).toBe('title-card');
    expect(s1.cta[0].type).toBe('title-card');
    expect(s1.list[0].type).toBe('explainer-scene');
  });
});

describe('loadPlaybook', () => {
  it('a style without playbook.json gets the default', () => {
    expect(loadPlaybook(styleDir())).toEqual(DEFAULT_PLAYBOOK);
  });
  it('a situation in the style file replaces that situation; the others and the variety fields keep their defaults', () => {
    const pb = loadPlaybook(styleDir({ situations: { tool: [{ id: 'x', type: 'title-card', duration: 3, props: { title: '{TEXT}' } }] }, variety: { sameTypeGapSec: 9 } }));
    expect(pb.situations.tool.map(r => r.id)).toEqual(['x']);
    expect(pb.situations.number).toEqual(DEFAULT_PLAYBOOK.situations.number);
    expect(pb.variety.sameTypeGapSec).toBe(9);
    expect(pb.variety.maxShare).toEqual(DEFAULT_PLAYBOOK.variety.maxShare);
    expect(pb.variety.rotate).toBe(DEFAULT_PLAYBOOK.variety.rotate);
  });
  it('clear errors: not JSON, an unknown insert type (names the recipe), a bad duration, a repeated id', () => {
    expect(() => loadPlaybook(styleDir(undefined, '{ nope'))).toThrow(/playbook\.json không phải JSON hợp lệ/);
    expect(() => loadPlaybook(styleDir({ situations: { tool: [{ id: 'a', type: 'confetti', duration: 2 }] } }))).toThrow(/a.*confetti/);
    expect(() => loadPlaybook(styleDir({ situations: { tool: [{ id: 'a', type: 'logo-badge', duration: 0 }] } }))).toThrow(/duration/);
    expect(() => loadPlaybook(styleDir({ situations: { tool: [{ id: 'a', type: 'logo-badge', duration: 2 }], cta: [{ id: 'a', type: 'title-card', duration: 2 }] } }))).toThrow(/trùng/);
  });
});

describe('fillProps', () => {
  it('fills {text}, {label} and {TEXT} (upper case) in strings at any depth', () => {
    expect(fillProps({ title: '{TEXT}', sub: 'về {label}', rows: [{ value: '{text}', n: 3 }], flag: true }, { text: 'Claude', label: 'công cụ' }))
      .toEqual({ title: 'CLAUDE', sub: 'về công cụ', rows: [{ value: 'Claude', n: 3 }], flag: true });
  });
  it('a prop that is exactly {icon} is dropped when there is no icon, filled when there is', () => {
    expect(fillProps({ icon: '{icon}', title: 'x' }, { text: 't' })).toEqual({ title: 'x' });
    expect(fillProps({ icon: '{icon}' }, { text: 't', icon: 'clock' })).toEqual({ icon: 'clock' });
  });
  it('a missing label becomes an empty string, never "undefined"', () => {
    expect(JSON.stringify(fillProps({ sub: '{label}' }, { text: 't' }))).not.toContain('undefined');
  });
});
