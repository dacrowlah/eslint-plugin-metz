import { defineConfig } from 'vitest/config';

// Tests run in a shuffled order fixed by ORDER_SEED. Seed 17 runs the first test of every group (a
// describe, or a file's top level) of 2 to 40 tests after another (of 2 to 39, last), so a test
// that needs state its group's first test set up fails in every run. It misses a dependence
// between two later tests, a nested describe that reads state a test of its parent set up (a
// group's own tests always run before its nested describes), a first test that leaves state behind
// (it runs last), and concurrent groups (never shuffled). Run touched files with
// --sequence.seed=20261020 too. A .only fails the run however it was reached (allowOnly: false).
// Stryker runs this config: chai would cut each side of a failure at 40 characters, and Vitest
// each value in an .each/.for title; pnpm mutate prints the killing test's name and failure, so
// both print in full. `pnpm test` (`vitest run --coverage`) holds src to 80% of lines
// (CLAUDE.md); a run of one file is not held to it. Pinned by test/vitest-config.test.ts.
// `isolate: true` is
// Vitest's default, written out: each file gets a fresh module graph, which test independence relies
// on, and a chosen isolation silences Vitest's "faster with isolate: false" hint.
export const ORDER_SEED = 17;
export default defineConfig({
  test: {
    include: ['test/**/*.test.ts'],
    isolate: true,
    allowOnly: false,
    sequence: { shuffle: true, seed: ORDER_SEED },
    chaiConfig: { truncateThreshold: 0 },
    taskTitleValueFormatTruncate: 0,
    coverage: {
      provider: 'v8',
      include: ['src/**/*.{ts,mts,cts,tsx}'],
      reporter: ['text-summary', 'json-summary'],
      thresholds: { lines: 80 },
    },
  },
});
