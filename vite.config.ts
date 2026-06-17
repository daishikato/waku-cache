/// <reference types="vitest" />
import { resolve } from 'node:path';
import { defineConfig } from 'vite';

export default defineConfig({
  resolve: {
    alias: [
      {
        find: /^waku-cache\/stores\/(.*)$/,
        replacement: resolve('src/stores') + '/$1',
      },
      { find: 'waku-cache', replacement: resolve('src/index') },
    ],
  },
  test: {
    environment: 'node',
    include: ['tests/**/*.spec.{ts,tsx}'],
  },
});
