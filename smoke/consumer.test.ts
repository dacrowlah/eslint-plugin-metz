import { describe, expect, it } from 'vitest';
import { pnpmCommand, refusalOf } from './consumer.ts';

// The smoke harness's own helpers: which pnpm it runs, and how it reads pnpm's refusal of a git
// dependency's build. The sample is pnpm 12.14.0's output, copied from a real run (the key wraps at
// the terminal width).
const REFUSAL = [
  'Progress: resolved 0, reused 1, downloaded 0, added 0',
  'Error: ERR_PNPM_GIT_DEP_PREPARE_NOT_ALLOWED',
  '',
  '  × installing dependencies',
  '  ╰─▶ The git-hosted package "eslint-plugin-metz@0.1.0" needs to execute build',
  '      scripts but is not in the "allowBuilds" allowlist.',
  '  help: Add the package to "allowBuilds" in your project\'s pnpm-workspace.yaml',
  '        to allow it to run scripts. For example:',
  '        allowBuilds:',
  '          eslint-plugin-metz@git+file:///private/tmp/a-',
  '        b/repo#3117e5e485c51d1b9fc072451ba0f52b18242147: true',
  '',
].join('\n');

describe('the smoke harness', () => {
  it('reads the error code and the wrapped allowBuilds key from pnpm refusal', () => {
    expect(refusalOf(REFUSAL)).toStrictEqual({
      error: 'ERR_PNPM_GIT_DEP_PREPARE_NOT_ALLOWED',
      key: 'eslint-plugin-metz@git+file:///private/tmp/a-b/repo#3117e5e485c51d1b9fc072451ba0f52b18242147: true',
    });
  });
  it('reads nothing from output without a refusal', () => {
    expect(refusalOf('Done in 2s\n')).toStrictEqual({ error: '', key: '' });
  });
  it.for([
    [
      '/home/u/.cache/node/corepack/v1/pnpm/12.14.0/pnpm-native',
      ['/home/u/.cache/node/corepack/v1/pnpm/12.14.0/pnpm-native'],
    ],
    ['/usr/lib/node_modules/npm/bin/npm-cli.js', ['corepack', 'pnpm@12.14.0']],
    [undefined, ['corepack', 'pnpm@12.14.0']],
  ] as const)('runs pnpm from %s as %j', ([execpath, command]) => {
    expect(pnpmCommand(execpath, 'pnpm@12.14.0')).toStrictEqual(command);
  });
});
