import { defineConfig } from 'vitest/config';

// The smoke tests install the built package into throwaway projects (smoke/): from the packed
// tarball and from a git tag. They need a build first (`pnpm build`), run each file once in written
// order (each file installs once in `beforeAll`), and are never part of the coverage or mutation
// runs (vitest.config.ts collects only test/).
export default defineConfig({
  test: {
    include: ['smoke/**/*.test.ts'],
    isolate: true,
    allowOnly: false,
    chaiConfig: { truncateThreshold: 0 },
    fileParallelism: false,
  },
});
