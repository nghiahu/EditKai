import { describe, expect, it } from 'vitest';
import { MAX_SOURCE_BYTES, scanCustomSource } from '../../src/qa/customScan';

const good = `import React from 'react';
import { AbsoluteFill, useCurrentFrame } from 'remotion';
import { easeValue } from '@kit';
import { shared } from './shared';
export default function A() { const f = useCurrentFrame(); return <AbsoluteFill style={{ opacity: easeValue(f / 30, 'out') }}>{shared}</AbsoluteFill>; }
`;
const codes = (src: string) => scanCustomSource(src).map(p => p.code);

describe('scanCustomSource: allowed code', () => {
  it('react, remotion, @kit and sibling files; words like "fetch" inside comments and strings are fine', () => {
    expect(scanCustomSource(good)).toEqual([]);
    expect(codes(`${good}\n// fetch the data, eval, localStorage\nconst s = "fetch eval window.open"; const t = \`fetch \${1} eval\`;`)).toEqual([]);
  });
});

describe('scanCustomSource: syntax and size', () => {
  it('broken code is custom-syntax with the line', () => {
    const [p] = scanCustomSource('export default function A() {\n  return <div>;\n}\n');
    expect(p.code).toBe('custom-syntax');
    expect(p.message).toMatch(/dòng [23]/);
  });
  it('more than 20 KB is custom-too-large', () => {
    expect(codes(good + '//' + 'x'.repeat(MAX_SOURCE_BYTES))).toContain('custom-too-large');
  });
});

describe('scanCustomSource: forbidden APIs', () => {
  it.each([
    ['fetch', "fetch('http://a.b')"],
    ['XMLHttpRequest', 'new XMLHttpRequest()'],
    ['WebSocket', "new WebSocket('ws://x')"],
    ['eval', "eval('1')"],
    ['Function', "new Function('return 1')()"],
    ['localStorage', "localStorage.setItem('a', 'b')"],
    ['document.cookie', 'const c = document.cookie;'],
    ['window.open', "window.open('http://x')"],
    ['postMessage', "window.postMessage('x', '*')"],
    ['sendBeacon', "navigator.sendBeacon('/x')"],
    ['globalThis', 'const g = globalThis;'],
    ['window computed access', "window['fe' + 'tch']('x')"],
    ['importScripts', "importScripts('x.js')"],
  ])('%s is custom-forbidden-api', (_n, line) => {
    const found = scanCustomSource(`${good}\nexport const x = () => { ${line} };\n`);
    expect(found.map(p => p.code)).toContain('custom-forbidden-api');
    expect(found.find(p => p.code === 'custom-forbidden-api')!.message).toMatch(/dòng \d+/);
  });
  it.each([
    ['a package', "import x from 'lodash';"],
    ['a node module', "import fs from 'node:fs';"],
    ['a parent folder', "import x from '../other';"],
    ['an absolute path', "import x from '/etc/x';"],
    ['a url', "import x from 'https://cdn/x.js';"],
    ['a re-export from a package', "export * from 'lodash';"],
    ['a dynamic import', "const m = import('./a');"],
    ['require', "const r = require('fs');"],
  ])('an import of %s is custom-forbidden-import', (_n, line) => {
    expect(codes(`${good}\n${line}\n`)).toContain('custom-forbidden-import');
  });
});
