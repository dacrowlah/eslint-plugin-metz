import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { docsUrl, MANIFEST } from '../src/package-info.ts';

// The plugin reads its name, version and home from its own package.json when it loads
// (package-load.test.ts proves the read itself).
const OWN = JSON.parse(readFileSync(new URL('../package.json', import.meta.url), 'utf8')) as {
  version: string;
};

describe('package info', () => {
  it('is read from package.json', () => {
    expect([MANIFEST.name, MANIFEST.version]).toStrictEqual(['eslint-plugin-metz', OWN.version]);
  });
  it('links a rule to its doc at the tag of the installed version', () => {
    expect(docsUrl('max-params')).toBe(
      `https://github.com/dacrowlah/eslint-plugin-metz/blob/v${OWN.version}/docs/rules/max-params.md`,
    );
  });
});
