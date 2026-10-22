import type { Linter } from 'eslint';
import { describe, expect, it } from 'vitest';
import plugin, { TEST_FILES, TEST_LIMITS } from '../src/index.ts';
import { type Finding, lintFiles } from './lint.ts';

// The presets' override blocks apply to the files their globs match, and only to those. Each
// snippet breaks one limit by one line or one parameter, so a finding names the limit in force.
const { strict, recommended } = plugin.configs;
const react = plugin.configs['strict-react'];

/** A function `f` whose body is `n` counted lines. */
const body = (n: number): string =>
  `function f() {\n${Array.from({ length: n }, (_, i) => `  g(${String(i)});`).join('\n')}\n}\n`;
const FIVE_PARAMS = 'declare function f(a: A, b: B, c: C, d: D, e: E): void;\n';
const fn = (n: number, max: number, severity = 2): Finding => [
  'metz/max-counted-lines',
  severity,
  `f has ${String(n)} counted lines (max ${String(max)}). Extract smaller, well-named functions.`,
];
const PARAMS: Finding = [
  'metz/max-params',
  2,
  'f takes 5 parameters counting option/prop keys (max 4). Introduce a parameter object or presentation model.',
];

describe('the test-file override', () => {
  it.each(['src/a.test.ts', 'src/a.spec.tsx', 'src/__tests__/a.ts', 'a.test.mjs'])(
    'allows 10 counted lines in %s, and reports 11',
    (file) => {
      expect([lintFiles(strict, body(10), file), lintFiles(strict, body(11), file)]).toStrictEqual([
        [],
        [fn(11, 10)],
      ]);
    },
  );
  it.each(['src/a.ts', 'src/test.ts', 'src/a.testing.ts', 'tests/a.ts'])(
    'does not apply to %s',
    (file) => {
      expect(lintFiles(strict, body(6), file)).toStrictEqual([fn(6, 5)]);
    },
  );
  it('exempts describe and suite callbacks', () => {
    const suite = (name: string) =>
      `${name}('x', () => {\n${body(11)}});\n`.replace('function f', 'const f = function');
    expect(lintFiles(strict, `${suite('describe')}${suite('suite')}`, 'a.test.ts')).toStrictEqual([
      fn(11, 10),
      fn(11, 10),
    ]);
  });
});

describe('the config-file and declaration overrides', () => {
  it.each([
    'vite.config.ts',
    'tools/eslint.config.mjs',
    'src/next.config.cjs',
    'types.d.ts',
    'x.d.mts',
  ])('turn the line and parameter limits off in %s', (file) => {
    expect(lintFiles(strict, `${body(6)}${FIVE_PARAMS}`, file)).toStrictEqual([]);
  });
  it.each([
    'config.ts',
    'src/configure.ts',
    'rc.ts',
    'd.ts',
    // Code that only looks like configuration keeps every limit.
    'src/app.config.tsx',
    'src/routes.config.jsx',
    '.babelrc.ts',
    '.prettierrc.cjs',
  ])('do not apply to %s', (file) => {
    expect(lintFiles(strict, `${body(6)}${FIVE_PARAMS}`, file)).toStrictEqual([fn(6, 5), PARAMS]);
  });
});

describe('a project extending the overrides', () => {
  it('reuses the exported test glob and limits for its own test-like files', () => {
    const files = [...TEST_FILES, '**/*.stories.tsx'];
    // Its own function limit, 12, tells its block apart from the preset's test block (10).
    const limits = { ...TEST_LIMITS, function: 12 };
    const tests = { files, rules: { 'metz/max-counted-lines': ['error', limits] } };
    const configs = [...strict, tests] as Linter.Config[];
    const lint = (file: string) => lintFiles(configs, body(13), file);
    expect([lint('a.stories.tsx'), lint('a.test.ts')]).toStrictEqual([[fn(13, 12)], [fn(13, 12)]]);
  });
  it('drops a block by its name', () => {
    const configs = strict.filter((c) => c.name !== 'metz/strict/tests');
    expect(lintFiles(configs, body(6), 'a.test.ts')).toStrictEqual([fn(6, 5)]);
  });
});

describe('the React blocks', () => {
  const twoComponents =
    'export function A() {\n  return <a />;\n}\nexport function B() {\n  return <b />;\n}\n';
  const SECOND: Finding = [
    'metz/component-shape',
    2,
    'Second component `B` in this file. One component per file.',
  ];
  const screen =
    'export function RaceScreen() {\n  const a = useA();\n  const b = useB();\n  return <a />;\n}\n';
  const HOOKS: Finding = [
    'metz/screen-view-model',
    2,
    'Screen `RaceScreen` calls 2 hooks. A screen calls exactly one view-model hook; move other hooks inside it.',
  ];
  it('check components in .tsx and .jsx files', () => {
    expect([
      lintFiles(react, twoComponents, 'A.tsx'),
      lintFiles(react, twoComponents, 'A.jsx'),
    ]).toStrictEqual([[SECOND], [SECOND]]);
  });
  it('leave components in test files and .ts files alone', () => {
    expect([
      lintFiles(react, twoComponents, 'A.test.tsx'),
      lintFiles(strict, twoComponents, 'A.tsx'),
    ]).toStrictEqual([[], []]);
  });
  it('check screens only in files named for one', () => {
    expect([
      lintFiles(react, screen, 'RaceScreen.tsx'),
      lintFiles(react, screen, 'Race.tsx'),
    ]).toStrictEqual([[HOOKS], []]);
  });
  it('report as warnings in recommended-react', () => {
    const warn = plugin.configs['recommended-react'];
    expect(lintFiles(warn, screen, 'RaceScreen.tsx')).toStrictEqual([[HOOKS[0], 1, HOOKS[2]]]);
  });
});

describe('recommended', () => {
  it('warns where strict errors, and has no waiver policy', () => {
    const code = `// eslint-disable-next-line no-console\n${body(6)}`;
    expect([lintFiles(recommended, code, 'a.ts'), lintFiles(strict, code, 'a.ts')]).toStrictEqual([
      [fn(6, 5, 1)],
      [
        [
          'metz/waiver-format',
          2,
          'Disabling no-console needs `-- WAIVER: <reason, at least 20 letters or digits>`.',
        ],
        fn(6, 5),
      ],
    ]);
  });
});

describe("the test block and a project's own limits", () => {
  it('keeps its limits over shared settings, which set the rest', () => {
    const settings = { metz: { 'max-counted-lines': { function: 7 } } };
    const configs = [...strict, { settings }] as Linter.Config[];
    const lint = (n: number, file: string) => lintFiles(configs, body(n), file);
    expect([lint(10, 'a.test.ts'), lint(7, 'a.ts'), lint(8, 'a.ts')]).toStrictEqual([
      [],
      [],
      [fn(8, 7)],
    ]);
  });
  it('is replaced for tests too by a later rule entry with options (ESLint replaces options)', () => {
    const later = { rules: { 'metz/max-counted-lines': ['error', { file: 120 }] } };
    const configs = [...strict, later] as Linter.Config[];
    expect(lintFiles(configs, body(6), 'a.test.ts')).toStrictEqual([fn(6, 5)]);
  });
});
