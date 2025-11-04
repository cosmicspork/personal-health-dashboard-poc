import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    environment: 'jsdom',
    setupFiles: ['./tests/unit/utils/setup.ts'],
    globals: false,
    include: ['tests/unit/**/*.test.ts'],
  },
});