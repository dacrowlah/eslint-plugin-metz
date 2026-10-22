// This repository's own lint: ESLint 10 flat config, loaded through jiti. The plugin lints its own
// source with its own `strict` preset (dogfooding Sandi Metz's rules, read from src/ so a change is
// linted by the rules it makes), plus eslint-plugin-eslint-plugin and eslint-plugin-n on the rules,
// typescript-eslint's strict type-checked rules everywhere, and the test rules on the tests.
import js from '@eslint/js';
import vitest from '@vitest/eslint-plugin';
import { defineConfig } from 'eslint/config';
import eslintPlugin from 'eslint-plugin-eslint-plugin';
import n from 'eslint-plugin-n';
import tseslint from 'typescript-eslint';
import { DEMETER_SELECTORS } from './lint/demeter.ts';
import { FLAG_PARAM_BANS } from './lint/flag-params.ts';
import { MUTATION_SYNTAX_BANS } from './lint/mutation-bans.ts';
import { TEST_SYNTAX_BANS } from './lint/test-bans.ts';
import { ASSERTION_FUNCTIONS, RESTRICTED_MATCHERS, VITEST_RULES } from './lint/test-rules.ts';
import metz from './src/index.ts';

const TS_FILES = ['**/*.ts'];
const TEST_SUPPORT = ['test/**/*.ts', 'smoke/**/*.ts'];
/** Every TS file: no flag parameters, no reaching through objects. */
const SYNTAX = [...FLAG_PARAM_BANS, ...DEMETER_SELECTORS];

export default defineConfig([
  { ignores: ['dist/**', 'coverage/**', 'reports/**', '.stryker-tmp/**', '.reports/**'] },
  { linterOptions: { reportUnusedDisableDirectives: 'error', reportUnusedInlineConfigs: 'error' } },
  js.configs.recommended,
  {
    files: TS_FILES,
    extends: [tseslint.configs.strictTypeChecked, tseslint.configs.stylisticTypeChecked],
    languageOptions: {
      parserOptions: { project: ['./tsconfig.test.json'], tsconfigRootDir: import.meta.dirname },
    },
  },
  // Sandi Metz's rules, exactly, on everything: the plugin's own strict preset.
  metz.configs.strict,
  {
    files: TS_FILES,
    rules: {
      'no-restricted-syntax': ['error', ...SYNTAX],
      '@typescript-eslint/consistent-type-definitions': ['error', 'type'],
      '@typescript-eslint/method-signature-style': ['error', 'property'],
      '@typescript-eslint/consistent-type-imports': 'error',
      // owner-approved 2026-10-22: conflicts with no-non-null-assertion. A cast of a plain value
      // stays where the AST guarantees a node is present; this rule would turn it into a non-null
      // `!`, which no-non-null-assertion (strict) bans.
      '@typescript-eslint/non-nullable-type-assertion-style': 'off',
      '@typescript-eslint/switch-exhaustiveness-check': [
        'error',
        {
          allowDefaultCaseForExhaustiveSwitch: true,
          considerDefaultExhaustiveForUnions: false,
          requireDefaultForNonUnion: true,
        },
      ],
      // Core backstops: deliberately looser than metz/*; they only catch gaps.
      'max-lines': ['error', { max: 200, skipBlankLines: true, skipComments: true }],
      'max-lines-per-function': ['error', { max: 40, skipBlankLines: true, skipComments: true }],
      'max-statements': ['error', 8],
      'max-depth': ['error', 2],
      'max-nested-callbacks': ['error', 2],
      complexity: ['error', { max: 5 }],
      'max-classes-per-file': ['error', 1],
      'no-else-return': ['error', { allowElseIf: false }],
      'no-nested-ternary': 'error',
      'no-param-reassign': ['error', { props: true }],
    },
  },
  // The rules: ESLint's plugin conventions, Node's, and no code inside an `as` (Stryker skips it).
  {
    files: ['src/**/*.ts'],
    extends: [eslintPlugin.configs.recommended, n.configs['flat/recommended-module']],
    rules: {
      'no-restricted-syntax': ['error', ...SYNTAX, ...MUTATION_SYNTAX_BANS],
      // ESLint's own rules start their descriptions with a capital: "Enforce …", "Require …".
      'eslint-plugin/require-meta-docs-description': [
        'error',
        { pattern: '^(Enforce|Require|Disallow)' },
      ],
      'eslint-plugin/meta-property-ordering': 'error',
      'eslint-plugin/prefer-placeholders': 'error',
      'eslint-plugin/no-property-in-node': 'error',
      'n/no-missing-import': 'off', // TypeScript resolves imports (`tsc` runs in pnpm check)
      // A Stryker disable comment is a waiver: it needs the owner's approval, and then a
      // reasoned next-line ESLint waiver of this rule beside it.
      'no-warning-comments': ['error', { terms: ['stryker disable'], location: 'anywhere' }],
    },
    // The bin and the exports are the built files of these sources.
    settings: { n: { convertPath: { 'src/**/*.ts': ['^src/(.+)\\.ts$', 'dist/$1.js'] } } },
  },
  // Build scripts are plain JavaScript (Node 22.13 runs no .ts) with Node's globals.
  { files: ['scripts/**/*.mjs'], extends: [n.configs['flat/recommended-module']] },
  {
    files: TEST_SUPPORT,
    plugins: { vitest },
    rules: {
      'no-restricted-syntax': ['error', ...SYNTAX, ...TEST_SYNTAX_BANS],
      ...Object.fromEntries(VITEST_RULES.map((rule) => [`vitest/${rule}`, 'error'])),
      'vitest/expect-expect': ['error', { assertFunctionNames: ASSERTION_FUNCTIONS }],
      'vitest/no-restricted-matchers': ['error', RESTRICTED_MATCHERS],
      'max-nested-callbacks': ['error', 3],
      'max-lines-per-function': 'off',
      'max-statements': 'off',
    },
  },
]);
