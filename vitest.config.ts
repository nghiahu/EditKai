import { defineConfig } from 'vitest/config';

// Remotion bundling shares one webpack cache directory, so test files run one at a time.
export default defineConfig({ test: { include: ['tests/**/*.test.ts'], testTimeout: 60000, fileParallelism: false } });
