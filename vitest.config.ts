import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    clearMocks: true,
    coverage: {
      include: ['apps/api/src/**/*.ts', 'packages/contracts/src/**/*.ts'],
      reporter: ['text', 'html'],
    },
    include: ['apps/**/test/**/*.test.{ts,tsx}', 'packages/**/test/**/*.test.ts'],
    passWithNoTests: false,
  },
});
