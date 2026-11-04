import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { spawnSync } from 'node:child_process';
import { existsSync, lstatSync, mkdirSync, mkdtempSync, readFileSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';

const script = resolve('scripts/install-skill.mjs');
let home: string;
const run = (...args: string[]) => spawnSync(process.execPath, [script, '--home', home, ...args], { encoding: 'utf8' });
const link = () => join(home, '.claude', 'skills', 'edit-video-pro');

beforeAll(() => { home = join(mkdtempSync(join(tmpdir(), 'editkai-home-')), 'người dùng'); mkdirSync(home, { recursive: true }); });
afterAll(() => rmSync(home, { recursive: true, force: true }));

describe('scripts/install-skill.mjs', () => {
  it('--dry-run says what it would do and changes nothing', () => {
    const r = run('--dry-run');
    expect(r.status).toBe(0);
    expect(r.stdout).toContain(link());
    expect(existsSync(link())).toBe(false);
  });
  it('links the skills folder entry to this skill, so SKILL.md is readable through it', () => {
    const r = run();
    expect(r.status).toBe(0);
    expect(lstatSync(link()).isSymbolicLink() || lstatSync(link()).isDirectory()).toBe(true);
    expect(readFileSync(join(link(), 'SKILL.md'), 'utf8')).toContain('name: edit-video-pro');
  });
  it('running it again changes nothing and says it is already registered', () => {
    const r = run();
    expect(r.status).toBe(0);
    expect(r.stdout).toMatch(/đã đăng ký/);
  });
  it('--remove deletes only the link, never the skill itself', () => {
    const r = run('--remove');
    expect(r.status).toBe(0);
    expect(existsSync(link())).toBe(false);
    expect(existsSync(resolve('SKILL.md'))).toBe(true);
    expect(existsSync(resolve('src', 'cli.ts'))).toBe(true);
  });
  it('refuses to replace a different skill that already has that name', () => {
    mkdirSync(link(), { recursive: true });
    const r = run();
    expect(r.status).toBe(1);
    expect(r.stderr).toMatch(/đã có/i);
    expect(existsSync(link())).toBe(true);
  });
});
