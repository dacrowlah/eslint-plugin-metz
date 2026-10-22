import { symlinkSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
import { fixture, runMain } from './cli-harness.ts';

// check-directives' main(), in process. Every line is written out: `<file>:<line>:<column> <message>`
// per violation, then `<n> forbidden directive(s)`. Lines are sorted before comparing, because
// readdir order depends on the file system; the summary always comes last in the real output.
const BAD = '/* eslint-enable no-console */\nf();';
const ENABLE = '1:1 `eslint-enable` is forbidden';
const CODE = ['ts', 'tsx', 'mts', 'cts', 'js', 'jsx', 'mjs', 'cjs'];
const BUILD = ['dist', 'coverage', '.turbo', '.expo', '.wrangler'];

const sorted = (r: { code: number; out: string; err: string }) => ({
  ...r,
  out: r.out.split('\n').sort(),
});
const report = (code: number, ...out: string[]) => ({ code, out: ['', ...out].sort(), err: '' });
const enabled = (dir: string, files: readonly string[]) =>
  files.map((f) => `${join(dir, f)}:${ENABLE}`);
const filesOf = (paths: readonly string[], source = BAD) =>
  Object.fromEntries(paths.map((path) => [path, source]));

describe('check-directives main()', () => {
  it('reports every code extension, and no other file', (ctx) => {
    const code = CODE.map((ext) => `a.${ext}`);
    const dir = fixture(ctx, filesOf([...code, 'a.json', 'a.md', 'a.ts.txt', 'Makefile']));
    expect(sorted(runMain(dir))).toStrictEqual(
      report(1, ...enabled(dir, code), '8 forbidden directive(s)'),
    );
  });
  it('skips node_modules, .git and .stryker-tmp at any depth, and scans the rest', (ctx) => {
    const skipped = ['node_modules', '.git', '.stryker-tmp'].flatMap((d) => [
      `${d}/x.ts`,
      `src/${d}/x.ts`,
    ]);
    const dir = fixture(ctx, { 'package.json': '{}', ...filesOf([...skipped, 'src/seen.ts']) });
    expect(sorted(runMain(dir))).toStrictEqual(
      report(1, ...enabled(dir, ['src/seen.ts']), '1 forbidden directive(s)'),
    );
  });
  it('skips build dirs only beside a package.json', (ctx) => {
    const beside = BUILD.map((d) => `pkg/${d}/x.ts`);
    const nested = [...BUILD.map((d) => `pkg/src/${d}/x.ts`), 'loose/dist/x.ts'];
    const dir = fixture(ctx, { 'pkg/package.json': '{}', ...filesOf([...beside, ...nested]) });
    expect(sorted(runMain(dir))).toStrictEqual(
      report(1, ...enabled(dir, nested), '6 forbidden directive(s)'),
    );
  });
  it('counts violations, not files, and prints each at its line and column', (ctx) => {
    const dir = fixture(ctx, {
      'a.ts': 'f();\n  /* eslint-enable no-console */\n// eslint-disable-line',
    });
    expect(sorted(runMain(dir))).toStrictEqual(
      report(
        1,
        `${join(dir, 'a.ts')}:2:3 \`eslint-enable\` is forbidden`,
        `${join(dir, 'a.ts')}:3:1 \`eslint-disable-line\` is forbidden; use \`// eslint-disable-next-line <rule> -- <reason>\``,
        '2 forbidden directive(s)',
      ),
    );
  });
  it('checks a file path given directly, and every path given', (ctx) => {
    const one = fixture(ctx, filesOf(['a.ts', 'a.md']));
    const two = fixture(ctx, filesOf(['b.ts']));
    const paths = [join(one, 'a.ts'), two];
    expect(sorted(runMain(...paths))).toStrictEqual(
      report(1, ...enabled(one, ['a.ts']), ...enabled(two, ['b.ts']), '2 forbidden directive(s)'),
    );
  });
  it('exits 0 and prints nothing on clean files', (ctx) => {
    const dir = fixture(
      ctx,
      filesOf(
        CODE.map((ext) => `ok.${ext}`),
        'f();',
      ),
    );
    expect(runMain(dir)).toStrictEqual({ code: 0, out: '', err: '' });
  });
});

describe('check-directives main() fails with exit 2', () => {
  it('with the usage when given no paths', () => {
    expect(runMain()).toStrictEqual({
      code: 2,
      out: '',
      err: 'Usage: metz-check-directives [--min-reason-length <n>] [--marker <text>] [--guarded-prefix <prefix>]... [--waiver-rule <rule>] <path>...\n',
    });
  });
  it.for(['a.md', 'a.TS', 'a.vue'])('naming a file it cannot check, %s', (name, ctx) => {
    const file = join(fixture(ctx, filesOf([name])), name);
    expect(runMain(file)).toStrictEqual({
      code: 2,
      out: '',
      err: `metz-check-directives: not a JavaScript or TypeScript file: ${file}\n`,
    });
  });
  it('naming a missing path', () => {
    const missing = join(tmpdir(), 'metz-no-such-path');
    expect(runMain(missing)).toStrictEqual({
      code: 2,
      out: '',
      err: `metz-check-directives: ENOENT: no such file or directory, stat '${missing}'\n`,
    });
  });
  it('naming the link that loops back to a directory being scanned', (ctx) => {
    const dir = fixture(ctx, { 'a/ok.ts': 'f();' });
    symlinkSync(dir, join(dir, 'a', 'back'));
    expect(runMain(dir)).toStrictEqual({
      code: 2,
      out: '',
      err: `metz-check-directives: symlink loop at ${join(dir, 'a', 'back')}\n`,
    });
  });
  it('naming a link to itself', (ctx) => {
    const dir = fixture(ctx, {});
    symlinkSync(join(dir, 'self'), join(dir, 'self'));
    expect(runMain(dir)).toStrictEqual({
      code: 2,
      out: '',
      err: `metz-check-directives: ELOOP: too many symbolic links encountered, stat '${join(dir, 'self')}'\n`,
    });
  });
});
