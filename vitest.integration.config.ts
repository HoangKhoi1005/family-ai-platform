import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    include: ['apps/api/tests/auth.integration.test.ts'],
    environment: 'node',
    testTimeout: 30_000,
    hookTimeout: 30_000,
  },
});
