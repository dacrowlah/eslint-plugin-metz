import { spawnSync } from 'node:child_process';
import { describe, expect, it } from 'vitest';
import { BIN_TIMEOUT, outcomeOf } from './cli-harness.ts';

// A mutant that breaks the plugin's read of its package.json fails at import. In a test file that
// imports the plugin, that happens while Vitest collects the file, where no test result names it
// (StrykerJS then reads it as Survived). So this file imports none of it: it loads the module in a
// child process, handing it Stryker's active mutant the way Stryker's instrumented code reads it.
const MODULE = new URL('../src/package-info.ts', import.meta.url).href;

/** Stryker's active mutant, for a child process to run under. */
const activeMutant = (): Record<string, string> => {
  const active = (globalThis as { __stryker__?: { activeMutant?: string } }).__stryker__
    ?.activeMutant;
  return active === undefined ? {} : { __STRYKER_ACTIVE_MUTANT__: active };
};

describe('the package info module', () => {
  it('loads in a fresh process', { timeout: BIN_TIMEOUT }, () => {
    const script = `const m = await import(${JSON.stringify(MODULE)}); console.log(m.MANIFEST.name);`;
    const args = ['--input-type=module', '-e', script];
    const env = { ...process.env, ...activeMutant() };
    expect(outcomeOf(spawnSync(process.execPath, args, { encoding: 'utf8', env }))).toStrictEqual({
      code: 0,
      out: 'eslint-plugin-metz\n',
      err: '',
    });
  });
});
