// The files of the throwaway consumer project (consumer.ts) and what linting them must report.
// Two presets on two folders: `strict-react` as shipped, and `recommended` customised through
// shared settings and a rule option; and a type-checked config using every public entry.

/** The versions this repository develops against: the consumer installs the same peers. */
export const PEERS = {
  eslint: '10.13.0',
  '@typescript-eslint/parser': '8.72.0',
  typescript: '6.0.3',
};

const ESLINT_CONFIG = `import parser from '@typescript-eslint/parser';
import { defineConfig } from 'eslint/config';
import metz from 'eslint-plugin-metz';

export default defineConfig([
  { files: ['**/*.{ts,tsx}'], languageOptions: { parser } },
  { files: ['strict/**'], extends: [metz.configs['strict-react']] },
  {
    files: ['custom/**'],
    extends: [metz.configs.recommended],
    settings: { metz: { 'max-counted-lines': { function: 7 } } },
    rules: { 'metz/max-params': ['error', { max: 2 }] },
  },
]);
`;

const TYPED = `import { defineConfig } from 'eslint/config';
import metz, { TEST_FILES, TEST_LIMITS } from 'eslint-plugin-metz';
import { findForbiddenDirectives } from 'eslint-plugin-metz/directives';

export default defineConfig([
  { plugins: { metz } },
  { files: TEST_FILES, extends: [metz.configs.strict] },
  { files: ['**/*.stories.tsx'], rules: { 'metz/max-counted-lines': ['error', TEST_LIMITS] } },
]);
export const reasons: string[] = findForbiddenDirectives('', 'a.ts').map((v) => v.reason);
`;
const TSCONFIG = JSON.stringify({
  compilerOptions: { strict: true, module: 'nodenext', target: 'es2023', noEmit: true, types: [] },
  files: ['typed.ts'],
});

/** A function `name` whose body is `n` counted lines. */
const body = (name: string, n: number): string =>
  `export function ${name}() {\n${Array.from({ length: n }, (_, i) => `  g(${String(i)});`).join('\n')}\n}\n`;

/** Every file of the consumer but its manifest and pnpm settings. */
export const FILES: Readonly<Record<string, string>> = {
  'eslint.config.js': ESLINT_CONFIG,
  'typed.ts': TYPED,
  'tsconfig.json': TSCONFIG,
  'strict/long.ts': `// eslint-disable-next-line no-console -- debugging\n${body('six', 6)}`,
  'strict/long.test.ts': body('six', 6),
  'strict/RaceScreen.tsx':
    'export function RaceScreen() {\n  useA();\n  useB();\n  return <a />;\n}\n',
  'custom/long.ts': `${body('seven', 7)}${body('eight', 8)}export const h = (a: A, b: B, c: C) => a;\n`,
};

const lines = (n: number, max: number) => `has ${String(n)} counted lines (max ${String(max)})`;
const FUNCTION = 'Extract smaller, well-named functions.';

/** What the presets must report on the fixtures, as `[file, rule, severity, message]`, sorted. */
export const EXPECTED_FINDINGS = [
  ['custom/long.ts', 'metz/max-counted-lines', '1', `eight ${lines(8, 7)}. ${FUNCTION}`],
  [
    'custom/long.ts',
    'metz/max-params',
    '2',
    'h takes 3 parameters counting option/prop keys (max 2). Introduce a parameter object or presentation model.',
  ],
  ['strict/long.ts', 'metz/max-counted-lines', '2', `six ${lines(6, 5)}. ${FUNCTION}`],
  [
    'strict/long.ts',
    'metz/waiver-format',
    '2',
    'Disabling no-console needs `-- WAIVER: <reason, at least 20 letters or digits>`.',
  ],
  [
    'strict/long.ts',
    'null',
    '1',
    "Unused eslint-disable directive (no problems were reported from 'no-console').",
  ],
  [
    'strict/RaceScreen.tsx',
    'metz/screen-view-model',
    '2',
    'Screen `RaceScreen` calls 2 hooks. A screen calls exactly one view-model hook; move other hooks inside it.',
  ],
];
