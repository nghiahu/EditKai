import { defineConfig } from 'vite';

export default defineConfig({
  root: 'editor',
  define: { __API__: JSON.stringify(process.env.EDITKAI_API ?? 'http://127.0.0.1:5186') },
  oxc: { jsx: { runtime: 'automatic' } },
  server: { host: '127.0.0.1', port: 5187, fs: { allow: ['..'] } },
});
