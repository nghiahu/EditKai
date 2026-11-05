export const SAMPLE_RATE = 44100;
export const SOUNDS = ['whoosh', 'swell', 'pop', 'tick', 'thud'] as const;
export type Sound = (typeof SOUNDS)[number];

/** Where a sound lives inside the project folder (the renderer serves it from there). */
export const sfxFile = (sound: Sound): string => `sfx/${sound}.wav`;

const PEAK = 0.9;

/** Seeded noise (mulberry32): the same sound comes out every run. */
function rng(seed: number): () => number {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return (((t ^ (t >>> 14)) >>> 0) / 4294967296) * 2 - 1;
  };
}

const build = (seconds: number, fn: (t: number, i: number, n: number) => number): Float32Array => {
  const n = Math.round(seconds * SAMPLE_RATE);
  const out = new Float32Array(n);
  for (let i = 0; i < n; i++) out[i] = fn(i / SAMPLE_RATE, i, n);
  return out;
};

const normalize = (s: Float32Array): Float32Array => {
  const peak = s.reduce((m, v) => Math.max(m, Math.abs(v)), 0) || 1;
  return s.map(v => (v / peak) * PEAK);
};

/** A hann-like window: 0 at both ends, 1 in the middle (peak at `at` of the way through). */
const hump = (x: number, at = 0.5): number => (x < at ? Math.sin((x / at) * (Math.PI / 2)) ** 2 : Math.cos(((x - at) / (1 - at)) * (Math.PI / 2)) ** 2);

/** One sound as samples (mono, 44.1 kHz, peak 0.9). */
export function synth(name: Sound): Float32Array {
  switch (name) {
    case 'whoosh': { // noise through a band that sweeps up and down
      const noise = rng(1);
      let lo = 0;
      let hi = 0;
      return normalize(build(0.45, (t, _i, n) => {
        const x = (t * SAMPLE_RATE) / n;
        const sweep = 400 + 2600 * Math.sin(Math.PI * x) ** 2;
        const a = 1 - Math.exp((-2 * Math.PI * sweep) / SAMPLE_RATE);
        const b = 1 - Math.exp((-2 * Math.PI * (sweep * 0.35)) / SAMPLE_RATE);
        const v = noise();
        lo += a * (v - lo);
        hi += b * (v - hi);
        return (lo - hi) * hump(x, 0.45);
      }));
    }
    case 'swell': // low, rises then fades
      return normalize(build(0.6, (t, _i, n) => {
        const x = (t * SAMPLE_RATE) / n;
        return (Math.sin(2 * Math.PI * 80 * t) + 0.5 * Math.sin(2 * Math.PI * 120 * t)) * hump(x, 0.6);
      }));
    case 'pop': // short, the pitch drops fast
      return normalize(build(0.12, t => Math.sin(2 * Math.PI * (300 + 400 * Math.exp(-t * 40)) * t) * Math.exp(-t * 28) * Math.min(1, t * 800) * (t > 0.1 ? Math.max(0, (0.12 - t) / 0.02) : 1)));
    case 'tick':
      return normalize(build(0.03, (t, _i, n) => Math.sin(2 * Math.PI * 1800 * t) * Math.exp(-t * 160) * hump((t * SAMPLE_RATE) / n, 0.1)));
    case 'thud': // low, short
      return normalize(build(0.2, (t, _i, n) => Math.sin(2 * Math.PI * (50 + 70 * Math.exp(-t * 30)) * t) * Math.exp(-t * 16) * hump((t * SAMPLE_RATE) / n, 0.05)));
  }
}

/** Mono 16-bit PCM WAV. */
export function wavBytes(samples: Float32Array): Buffer {
  const data = Buffer.alloc(samples.length * 2);
  samples.forEach((v, i) => data.writeInt16LE(Math.round(Math.max(-1, Math.min(1, v)) * 32767), i * 2));
  const head = Buffer.alloc(44);
  head.write('RIFF', 0);
  head.writeUInt32LE(36 + data.length, 4);
  head.write('WAVEfmt ', 8);
  head.writeUInt32LE(16, 16);
  head.writeUInt16LE(1, 20); // PCM
  head.writeUInt16LE(1, 22); // mono
  head.writeUInt32LE(SAMPLE_RATE, 24);
  head.writeUInt32LE(SAMPLE_RATE * 2, 28);
  head.writeUInt16LE(2, 32);
  head.writeUInt16LE(16, 34);
  head.write('data', 36);
  head.writeUInt32LE(data.length, 40);
  return Buffer.concat([head, data]);
}
