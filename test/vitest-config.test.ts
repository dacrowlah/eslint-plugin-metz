import { describe, expect, it } from 'vitest';
import config from '../vitest.config.ts';
import smoke from '../vitest.smoke.config.ts';

// The Vitest configs, pinned whole: the shuffle seed, `allowOnly: false`, isolation, untruncated
// failures and the coverage floor are what the test rules in CLAUDE.md rely on.
const COVERAGE = {
  provider: 'v8',
  include: ['src/**/*.{ts,mts,cts,tsx}'],
  reporter: ['text-summary', 'json-summary'],
  thresholds: { lines: 80 },
};
const UNIT = {
  include: ['test/**/*.test.ts'],
  isolate: true,
  allowOnly: false,
  sequence: { shuffle: true, seed: 17 },
  chaiConfig: { truncateThreshold: 0 },
  taskTitleValueFormatTruncate: 0,
  coverage: COVERAGE,
};
const SMOKE = {
  include: ['smoke/**/*.test.ts'],
  isolate: true,
  allowOnly: false,
  chaiConfig: { truncateThreshold: 0 },
  fileParallelism: false,
};

describe('vitest configs', () => {
  it('runs the unit tests shuffled by seed 17, isolated, with a coverage floor of 80% of lines', () => {
    expect(config).toStrictEqual({ test: UNIT });
  });
  it('runs the smoke tests one file at a time, isolated', () => {
    expect(smoke).toStrictEqual({ test: SMOKE });
  });
});
