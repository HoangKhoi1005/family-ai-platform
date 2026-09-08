import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    include: [
      'apps/api/tests/auth.integration.test.ts',
      'apps/api/tests/membership.integration.test.ts',
      'apps/api/tests/member-profile.integration.test.ts',
    ],
    environment: 'node',
    // Auth and membership fixtures share Better Auth's loopback database
    // buckets. Keep the two real-database files deterministic; production
    // rate limiting remains enabled for every request in either file.
    fileParallelism: false,
    testTimeout: 30_000,
    hookTimeout: 30_000,
  },
});
