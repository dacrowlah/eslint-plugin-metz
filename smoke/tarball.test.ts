import { readdirSync } from 'node:fs';
import { join } from 'node:path';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { tempDir } from '../test/temp-dir.ts';
import {
  consumer,
  findings,
  install,
  installed,
  PNPM,
  RUN_TIMEOUT,
  run,
  SHIPPED,
  succeed,
} from './consumer.ts';
import { EXPECTED_FINDINGS } from './project.ts';

// The artifact npm would publish: `pnpm pack` of the built package, installed into a fresh project
// with only its declared dependencies and peers. Proves the tarball, not the source tree.
const REPO = join(import.meta.dirname, '..');
/** Packing, installing (from the local store) and linting take seconds; minutes on a cold CI. */
const INSTALL_TIMEOUT = 300_000;
const finishing = { onTestFinished: afterAll };
let project = '';

/** The tarball `pnpm pack` makes of this repository. */
function packed(): string {
  const packs = tempDir(finishing, 'metz-pack-');
  succeed(REPO, ...PNPM, 'pack', '--pack-destination', packs);
  return join(packs, String(readdirSync(packs)[0]));
}

beforeAll(() => {
  project = tempDir(finishing, 'metz-tarball-');
  consumer(project, `file:${packed()}`);
  install(project);
}, INSTALL_TIMEOUT);

describe('the packed tarball', () => {
  it('ships only the build, the files npm always includes, and the changelog', () => {
    expect(installed(project)).toStrictEqual(SHIPPED);
  });
  it(
    'lints with strict-react as shipped and with a customised recommended',
    { timeout: RUN_TIMEOUT },
    () => {
      expect(findings(project)).toStrictEqual(EXPECTED_FINDINGS);
    },
  );
  it('type-checks a consumer config against its declarations', { timeout: RUN_TIMEOUT }, () => {
    const tsc = join(project, 'node_modules/.bin/tsc');
    expect(run(project, tsc, '-p', '.')).toStrictEqual({ code: 0, out: '', err: '' });
  });
  it(
    'gives CommonJS the plugin as `default`, as the README documents',
    { timeout: RUN_TIMEOUT },
    () => {
      const script =
        "const m = require('eslint-plugin-metz'); console.log(m.default.meta.namespace, typeof m.configs);";
      expect(run(project, process.execPath, '-e', script)).toStrictEqual({
        code: 0,
        out: 'metz undefined\n',
        err: '',
      });
    },
  );
  it('installs the metz-check-directives bin', { timeout: RUN_TIMEOUT }, () => {
    const bin = join(project, 'node_modules/.bin/metz-check-directives');
    expect(run(project, bin, 'strict')).toStrictEqual({
      code: 1,
      out: 'strict/long.ts:1:1 waiving a rule needs `-- WAIVER: <reason of at least 20 letters or digits>`\n1 forbidden directive(s)\n',
      err: '',
    });
  });
});
