import { cpSync, mkdirSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { tempDir } from '../test/temp-dir.ts';
import {
  consumer,
  findings,
  install,
  installed,
  PNPM,
  refusalOf,
  RUN_TIMEOUT,
  run,
  SHIPPED,
  succeed,
} from './consumer.ts';
import { EXPECTED_FINDINGS } from './project.ts';

// The way projects consume the plugin before (or instead of) npm: a git dependency pinned to a tag,
// built on install by its `prepare` script. The files git would commit now (tracked, plus untracked
// that are not ignored) are copied to a throwaway repository, committed and tagged there (never in
// this one), and installed through `git+file://` with the build allowed in pnpm's `allowBuilds`.
const REPO = join(import.meta.dirname, '..');
const INSTALL_TIMEOUT = 600_000;
const TAG = 'v0.1.0';
const finishing = { onTestFinished: afterAll };
/** A throwaway identity, and no signing: the owner's signing key never touches a throwaway. */
const AS = [
  ...['-c', 'user.name=metz smoke', '-c', 'user.email=smoke@example.invalid'],
  ...[
    '-c',
    'commit.gpgsign=false',
    '-c',
    'tag.gpgsign=false',
    '-c',
    'tag.forceSignAnnotated=false',
  ],
];
let project = '';

/** The files this repository would commit now: tracked, and untracked but not ignored. */
const committable = (): string[] =>
  succeed(REPO, 'git', 'ls-files', '--cached', '--others', '--exclude-standard', '-z')
    .split('\0')
    .filter((file) => file !== '');

function copyTo(copy: string, file: string): void {
  mkdirSync(dirname(join(copy, file)), { recursive: true });
  cpSync(join(REPO, file), join(copy, file));
}

/** A repository holding what this one would commit, with one commit tagged `TAG`. */
function snapshot(): string {
  const copy = tempDir(finishing, 'metz-git-');
  for (const file of committable()) copyTo(copy, file);
  for (const args of [
    ['init', '-q', '-b', 'main'],
    ['add', '-A'],
    [...AS, 'commit', '-qm', 'snapshot'],
  ])
    succeed(copy, 'git', ...args);
  succeed(copy, 'git', ...AS, 'tag', '-a', TAG, '-m', TAG);
  return copy;
}

beforeAll(() => {
  const url = `git+file://${snapshot()}`;
  project = tempDir(finishing, 'metz-git-consumer-');
  consumer(project, `${url}#${TAG}`, `allowBuilds:\n  'eslint-plugin-metz@${url}': true\n`);
  install(project);
}, INSTALL_TIMEOUT);

describe('a git dependency on a tag', () => {
  it('is built by its prepare script on install, and ships what the tarball ships', () => {
    expect(installed(project)).toStrictEqual(SHIPPED);
  });
  it(
    'lints with strict-react as shipped and with a customised recommended',
    { timeout: RUN_TIMEOUT },
    () => {
      expect(findings(project)).toStrictEqual(EXPECTED_FINDINGS);
    },
  );
  it(
    'is refused without the allowBuilds entry, which pnpm names',
    { timeout: INSTALL_TIMEOUT },
    (ctx) => {
      const repo = snapshot();
      const commit = succeed(repo, 'git', 'rev-parse', `${TAG}^{commit}`).trim();
      const refused = tempDir(ctx, 'metz-git-refused-');
      consumer(refused, `git+file://${repo}#${TAG}`);
      const r = run(refused, ...PNPM, 'install', '--prefer-offline');
      expect({ code: r.code, ...refusalOf(`${r.out}${r.err}`) }).toStrictEqual({
        code: 1,
        error: 'ERR_PNPM_GIT_DEP_PREPARE_NOT_ALLOWED',
        key: `eslint-plugin-metz@git+file://${repo}#${commit}: true`,
      });
    },
  );
});
