import { continueRender, delayRender } from 'remotion';
import latin400 from '@fontsource/be-vietnam-pro/files/be-vietnam-pro-latin-400-normal.woff2';
import latin700 from '@fontsource/be-vietnam-pro/files/be-vietnam-pro-latin-700-normal.woff2';
import latin800 from '@fontsource/be-vietnam-pro/files/be-vietnam-pro-latin-800-normal.woff2';
import latin900 from '@fontsource/be-vietnam-pro/files/be-vietnam-pro-latin-900-normal.woff2';
import vi400 from '@fontsource/be-vietnam-pro/files/be-vietnam-pro-vietnamese-400-normal.woff2';
import vi700 from '@fontsource/be-vietnam-pro/files/be-vietnam-pro-vietnamese-700-normal.woff2';
import vi800 from '@fontsource/be-vietnam-pro/files/be-vietnam-pro-vietnamese-800-normal.woff2';
import vi900 from '@fontsource/be-vietnam-pro/files/be-vietnam-pro-vietnamese-900-normal.woff2';

/**
 * Be Vietnam Pro (SIL OFL 1.1, via @fontsource), the font both styles ask for. Without these files the machine's own fallback font was used,
 * and Vietnamese tone marks came out in a different font on every machine. Weights are the ones the components use: 400, 700, 800, 900.
 * Two subsets per weight, with the ranges fontsource publishes: basic Latin, and the Vietnamese letters and combining marks.
 */
const LATIN = 'U+0000-00FF,U+0131,U+0152-0153,U+02BB-02BC,U+02C6,U+02DA,U+02DC,U+0304,U+0308,U+0329,U+2000-206F,U+20AC,U+2122,U+2191,U+2193,U+2212,U+2215,U+FEFF,U+FFFD';
const VIETNAMESE = 'U+0102-0103,U+0110-0111,U+0128-0129,U+0168-0169,U+01A0-01A1,U+01AF-01B0,U+0300-0301,U+0303-0304,U+0308-0309,U+0323,U+0329,U+1EA0-1EF9,U+20AB';

export const FONT_FAMILY = 'Be Vietnam Pro';
export const FONT_FILES = [
  { weight: 400, range: LATIN, url: latin400 }, { weight: 400, range: VIETNAMESE, url: vi400 },
  { weight: 700, range: LATIN, url: latin700 }, { weight: 700, range: VIETNAMESE, url: vi700 },
  { weight: 800, range: LATIN, url: latin800 }, { weight: 800, range: VIETNAMESE, url: vi800 },
  { weight: 900, range: LATIN, url: latin900 }, { weight: 900, range: VIETNAMESE, url: vi900 },
];

/** Loads every file; a render waits for it (delayRender), so no frame is drawn in a fallback font. */
export function loadFonts(): Promise<unknown> {
  if (typeof document === 'undefined') return Promise.resolve(); // not in a browser (a test importing the module)
  const handle = delayRender(`Nạp phông ${FONT_FAMILY}`);
  return Promise.all(FONT_FILES.map(async f => {
    const face = new FontFace(FONT_FAMILY, `url(${f.url}) format('woff2')`, { weight: String(f.weight), unicodeRange: f.range });
    document.fonts.add(await face.load());
  })).then(() => continueRender(handle), e => { console.error('Không nạp được phông', e); continueRender(handle); });
}

loadFonts();
