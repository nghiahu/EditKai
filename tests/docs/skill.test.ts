import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import { LAYER_TYPES } from '../../src/plan/layerTypes';
import { iconNames } from '../../remotion/icons';

const skill = readFileSync('SKILL.md', 'utf8');
const missing = (names: string[]) => names.filter(n => !skill.includes(n));

describe('SKILL.md covers the plan vocabulary', () => {
  it('mentions every layer type', () => expect(missing(Object.keys(LAYER_TYPES))).toEqual([]));
  it('mentions every icon name', () => expect(missing(iconNames)).toEqual([]));
  it('mentions every explainer body kind and mode', () => expect(missing(['list', 'card', 'waveform', 'progress', 'phone', 'overlay', 'full'])).toEqual([]));
  it('mentions every transition kind', () => expect(missing(['zoom', 'blur', 'slide', 'push', 'flash', 'whip', 'dip'])).toEqual([]));
  it('mentions the camera track', () => expect(missing(['camera'])).toEqual([]));
});

describe('style rules mention the motion pass features', () => {
  it('m1 rules use zoom-punch and overlay', () => {
    const r = readFileSync('styles/m1/rules.md', 'utf8');
    expect(r).toContain('zoom-punch');
    expect(r).toContain('overlay');
  });
  it('s1 rules mention waveform or progress and camera', () => {
    const r = readFileSync('styles/s1/rules.md', 'utf8');
    expect(/waveform|progress/.test(r)).toBe(true);
    expect(r).toContain('camera');
  });
});

import { CAPTION_VARIANTS, CAPTION_POSITIONS, CAPTION_EMPHASES } from '../../src/plan/captionProps';

describe('SKILL.md documents the caption props', () => {
  const quoted = (names: readonly string[]) => names.filter(n => !skill.includes('`' + n + '`'));
  it('lists every variant, position and emphasis value in code quotes', () => {
    expect(quoted(CAPTION_VARIANTS)).toEqual([]);
    expect(quoted(CAPTION_POSITIONS)).toEqual([]);
    expect(quoted(CAPTION_EMPHASES)).toEqual([]);
  });
  it('names the props handles and label and the phrase default', () => {
    expect(quoted(['handles', 'label', 'variant', 'position', 'emphasis'])).toEqual([]);
    expect(skill).toMatch(/mặc định[^\n]*`phrase`|`phrase`[^\n]*mặc định/i);
  });
});

describe('caption rules per style', () => {
  it('m1 rules cover label, big and box with the split', () => {
    const r = readFileSync('styles/m1/rules.md', 'utf8');
    for (const n of ['`label`', '`big`', '`box`', '`phrase`']) expect(r).toContain(n);
    expect(r).toMatch(/60%/);
  });
  it('s1 rules cover underline and say big is not used', () => {
    const r = readFileSync('styles/s1/rules.md', 'utf8');
    expect(r).toContain('`underline`');
    expect(r).toMatch(/không dùng `big`/);
  });
});

describe('SKILL.md timing advice for phrase captions', () => {
  it('no longer tells the AI to start and end a caption exactly on its first and last word', () => {
    expect(skill).not.toMatch(/`start` = `s` của từ đầu, `end` = `e` của từ cuối/);
  });
  it('says to start just before the first word and keep the caption up after the last', () => {
    expect(skill).toMatch(/0\.05/);
    expect(skill).toMatch(/0\.4/);
  });
});

import { FOOTAGE_FRAMES, FOOTAGE_MOTIONS, INSERT_POSITIONS } from '../../src/plan/insertProps';
import { ASSET_KINDS } from '../../src/assets/manifest';

describe('SKILL.md documents the inserts', () => {
  const quoted = (names: readonly string[]) => names.filter(n => !skill.includes('`' + n + '`'));
  it('lists every footage frame, motion and asset kind in code quotes', () => {
    expect(quoted(FOOTAGE_FRAMES)).toEqual([]);
    expect(quoted(FOOTAGE_MOTIONS)).toEqual([]);
    expect(quoted(ASSET_KINDS)).toEqual([]);
    expect(quoted(INSERT_POSITIONS)).toEqual([]);
  });
  it('names the footage props from, focus, sound, title and dim', () => {
    expect(quoted(['from', 'focus', 'sound', 'title', 'dim', 'frame', 'motion'])).toEqual([]);
  });
  it('explains assets.json and both assets commands', () => {
    for (const s of ['assets.json', 'assets add', 'assets list', '--desc']) expect(skill).toContain(s);
  });
  it('says footage is muted unless sound is true', () => {
    expect(skill).toMatch(/tắt tiếng/);
  });
});

describe('rules of both styles cover the inserts', () => {
  for (const style of ['s1', 'm1']) {
    it(`${style} rules mention logo-badge, prompt-box, stat-card and the window frame`, () => {
      const r = readFileSync(`styles/${style}/rules.md`, 'utf8');
      for (const n of ['`logo-badge`', '`prompt-box`', '`stat-card`', '`window`']) expect(r).toContain(n);
    });
  }
});

describe('SKILL.md documents the director workflow', () => {
  it('mentions analyze, compose, the storyboard files and their fields', () => {
    expect(missing(['analyze', 'compose', 'storyboard.json', 'compose-report.json', 'glossary.json', 'reviewed', 'treatment', 'bigRange', 'insert-gap', 'asset-unused', 'plan.next.json'])).toEqual([]);
  });
  it('both rules files point to the director block of theme.json', () => {
    for (const s of ['s1', 'm1']) expect(readFileSync(`styles/${s}/rules.md`, 'utf8')).toMatch(/director/);
  });
});

import { CAPTION_BACKDROPS } from '../../src/plan/captionProps';

describe('SKILL.md documents caption legibility', () => {
  it('lists the backdrop prop with its values in code quotes and the low-contrast warning', () => {
    for (const n of ['backdrop', ...CAPTION_BACKDROPS, 'caption-low-contrast']) expect(skill).toContain('`' + n + '`');
  });
});

describe('SKILL.md explains how to run and register the skill', () => {
  it('mentions the launcher, doctor and the install script', () => {
    expect(missing(['scripts/ev.mjs', 'doctor', 'scripts/install-skill.mjs'])).toEqual([]);
  });
});

describe('SKILL.md describes the flow', () => {
  it('has the three stopping points and the commands for cutting content and fixing the transcript', () => {
    expect(missing(['Điểm dừng 1', 'Điểm dừng 2', 'Điểm dừng 3', 'condense', 'condense-spec.json', 'pauses', 'fix-transcript', 'transcript-fixes.json', 'full.mp4'])).toEqual([]);
  });
  it('keeps the commands in sync with the CLI', () => {
    const wrong = ['init', 'clean', 'fix-transcript', 'pauses', 'condense', 'analyze', 'compose', 'validate', 'merge', 'editor', 'render'].filter(c => !skill.includes('src/cli.ts ' + c));
    expect(wrong).toEqual([]);
  });
});

describe('SKILL.md documents the playbook', () => {
  it('mentions playbook.json, its recipes and variety rules, and the glossary lists section, cta and notTools', () => {
    expect(missing(['playbook.json', 'recipe', 'rotate', 'maxShare', 'sameTypeGapSec', 'section', 'cta', 'notTools'])).toEqual([]);
  });
});

describe('SKILL.md describes reading the talk and the guessed inserts', () => {
  it('asks for outline.md before the storyboard and explains maybe inserts', () => {
    expect(missing(['outline.md', 'maybe', 'chưa chắc'])).toEqual([]);
  });
});

describe('SKILL.md describes the automatic transitions on joins', () => {
  it('says analyze puts them and which list sets the kinds', () => {
    expect(missing(['transitions', 'chỗ ghép', 'condense.json'])).toEqual([]);
    expect(skill).toContain('do `analyze` đặt');
  });
});

describe('SKILL.md describes the quick preview', () => {
  it('names the command, its pictures and the sheet, and the low-resolution video', () => {
    expect(missing(['src/cli.ts preview', 'sheet.png', 'preview.mp4', '--video', '--frames'])).toEqual([]);
  });
  it('no longer says there is no quick preview command', () => {
    expect(skill).not.toContain('Chưa có lệnh dựng bản nháp nhanh');
  });
});

describe('SKILL.md describes how the source sits in the frame', () => {
  it('names fit, focus, both fit values, the init options and the shape note', () => {
    expect(missing(['meta.fit', 'meta.focus', '`cover`', '`contain`', '--fit', '--focus'])).toEqual([]);
  });
});
