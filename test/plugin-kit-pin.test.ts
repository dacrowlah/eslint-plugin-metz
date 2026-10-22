import { existsSync, readFileSync } from 'node:fs';
import { createRequire } from 'node:module';
import { dirname, join } from 'node:path';
import { describe, expect, it } from 'vitest';

// The directive checker reads comments with ConfigCommentParser from @eslint/plugin-kit. Its
// "reads exactly like ESLint" guarantee holds only while ESLint resolves the same version we pin.
// The range is metz's own dependency, the same range ESLint 10 declares, so a package manager
// installs one copy that both resolve.
const KIT = '@eslint/plugin-kit';
const MANIFEST = join(import.meta.dirname, '../package.json');

const packageDirOf = (entry: string): string => {
  let dir = dirname(entry);
  while (!existsSync(join(dir, 'package.json'))) dir = dirname(dir);
  return dir;
};

const versionAt = (dir: string): string =>
  (JSON.parse(readFileSync(join(dir, 'package.json'), 'utf8')) as { version: string }).version;

const versionResolvedFrom = (entry: string): string => {
  const kitEntry = createRequire(entry).resolve(KIT);
  return versionAt(packageDirOf(kitEntry));
};

/** The range metz's package.json depends on, exactly as written there. */
const ownPin = (): unknown =>
  (JSON.parse(readFileSync(MANIFEST, 'utf8')) as { dependencies: Record<string, unknown> })
    .dependencies[KIT];

describe('@eslint/plugin-kit pin', () => {
  const eslintEntry = createRequire(import.meta.url).resolve('eslint');

  it('is a dependency of metz, resolved by eslint at 0.7.3', () => {
    expect([ownPin(), versionResolvedFrom(eslintEntry)]).toStrictEqual(['^0.7.3', '0.7.3']);
  });
  it('is resolved by the plugin at the same version as eslint resolves', () => {
    expect(versionResolvedFrom(import.meta.filename)).toBe(versionResolvedFrom(eslintEntry));
  });
});
