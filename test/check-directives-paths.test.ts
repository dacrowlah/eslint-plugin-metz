import { symlinkSync } from 'node:fs';
import { join, relative } from 'node:path';
import { describe, expect, it } from 'vitest';
import { fixture, runMain } from './cli-harness.ts';

// Which files the CLI reads from the paths it is given: an explicitly named build directory, a
// dangling link, and roots that overlap.
const BAD = '/* eslint-enable no-console */\nf();';
const enabled = (file: string) => `${file}:1:1 \`eslint-enable\` is forbidden`;

describe('check-directives paths', () => {
  it('checks a build directory named explicitly, which a walk from its package skips', (ctx) => {
    const dir = fixture(ctx, { 'package.json': '{}', 'dist/x.ts': BAD });
    expect([runMain(join(dir, 'dist')), runMain(dir)]).toStrictEqual([
      { code: 1, out: `${enabled(join(dir, 'dist/x.ts'))}\n1 forbidden directive(s)\n`, err: '' },
      { code: 0, out: '', err: '' },
    ]);
  });
  it('reports a dangling link named like code as a finding, and ignores any other', (ctx) => {
    const dir = fixture(ctx, { 'ok.ts': 'f();' });
    symlinkSync(join(dir, 'missing.ts'), join(dir, 'gone.ts'));
    symlinkSync(join(dir, 'missing.md'), join(dir, 'gone.md'));
    expect(runMain(dir)).toStrictEqual({
      code: 1,
      out: `${join(dir, 'gone.ts')}:1:1 dangling symbolic link: its target is missing, so it cannot be checked\n1 forbidden directive(s)\n`,
      err: '',
    });
  });
  it('checks a file once when the paths it is under overlap, written absolute or relative', (ctx) => {
    const dir = fixture(ctx, { 'a.ts': BAD });
    expect(
      runMain(dir, join(dir, 'a.ts'), relative(process.cwd(), join(dir, 'a.ts'))),
    ).toStrictEqual({
      code: 1,
      out: `${enabled(join(dir, 'a.ts'))}\n1 forbidden directive(s)\n`,
      err: '',
    });
  });
});
