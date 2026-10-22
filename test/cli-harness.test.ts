import { describe, expect, it } from 'vitest';
import type { SpawnSyncReturns } from 'node:child_process';
import { BIN_TIMEOUT, fixture, outcomeOf, runCli } from './cli-harness.ts';
import { thrownBy } from './thrown.ts';

// runCli's own test: the bin smoke test (directives.test.ts) covers a failing run (exit 1 and 2,
// stdout and stderr), so this covers a clean one: all three streams, stderr included, so a warning
// the bin printed on exit 0 would fail it.
describe('runCli', () => {
  it('returns exit 0 and empty streams for a clean run', { timeout: BIN_TIMEOUT }, (ctx) => {
    expect(runCli(fixture(ctx, { 'ok.ts': 'f();' }))).toStrictEqual({ code: 0, out: '', err: '' });
  });
  // runCli hands its child to outcomeOf: a report past spawnSync's 1 MiB buffer throws ENOBUFS
  // instead of coming back cut short (15 000 violations of about 110 bytes each). The bin sets
  // its exit code rather than exiting at once, so the whole report is written.
  it('throws when the bin writes past the buffer', { timeout: BIN_TIMEOUT }, (ctx) => {
    const dir = fixture(ctx, { 'big.ts': '/* eslint-enable a */\n'.repeat(15_000) });
    expect((thrownBy(() => runCli(dir)) as { code: string }).code).toBe('ENOBUFS');
  });
});

/** A child's spawn result, as `spawnSync` returns it. */
const spawned = (overrides: Partial<SpawnSyncReturns<string>>): SpawnSyncReturns<string> => ({
  pid: 1,
  output: [],
  stdout: 'out\n',
  stderr: 'err\n',
  status: 0,
  signal: null,
  ...overrides,
});

describe('outcomeOf, what runCli makes of a child', () => {
  it('gives a killed child code -1 and its signal', () => {
    expect(outcomeOf(spawned({ status: null, signal: 'SIGKILL' }))).toStrictEqual({
      code: -1,
      out: 'out\n',
      err: 'err\n',
      signal: 'SIGKILL',
    });
  });
  it('throws the error of a child that could not run', () => {
    const error = new Error('spawn ENOBUFS');
    expect(() => outcomeOf(spawned({ error }))).toThrow(/^spawn ENOBUFS$/);
  });
});
