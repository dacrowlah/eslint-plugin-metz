import parser from '@typescript-eslint/parser';
import { Linter } from 'eslint';
import plugin from '../src/index.ts';

// Lints a snippet through ESLint's real Linter with the plugin's public entry, for what RuleTester
// cannot see: schema validation, shared settings, and the preset configs with their file globs.
const linter = new Linter({ configType: 'flat' });

/** TypeScript and JSX for every source file, as a project's own config would set it. */
const PARSE: Linter.Config = {
  files: ['**/*.{js,jsx,mjs,cjs,ts,tsx,mts,cts}'],
  languageOptions: { parser, parserOptions: { ecmaFeatures: { jsx: true } } },
  // Snippets name rules the harness does not run, to exercise waivers.
  linterOptions: { reportUnusedDisableDirectives: 'off' },
};

/** What a test reads of a lint message: the rule, its severity and its text. */
export type Finding = readonly [rule: string | null, severity: number, message: string];

/** The findings of linting `code` as `filename` with `configs` (after the parser setup). */
export function lintFiles(
  configs: readonly Linter.Config[],
  code: string,
  filename: string,
): Finding[] {
  return linter
    .verify(code, [PARSE, ...configs], filename)
    .map((m) => [m.ruleId, m.severity, m.message] as const);
}

/** One rule of the plugin turned on with `options`, beside shared `settings`. */
const ruleConfig = (rule: string, options: object, settings: Record<string, unknown>) => ({
  plugins: { metz: plugin },
  settings,
  rules: { [`metz/${rule}`]: ['error', options] as Linter.RuleEntry },
});

/** The messages of one rule run with `options` (and shared `settings`) on `code` in `x.ts`. */
export const lintWith = (
  rule: string,
  options: object,
  { code = 'f();', settings = {} }: { code?: string; settings?: Record<string, unknown> } = {},
): Linter.LintMessage[] =>
  linter.verify(code, [PARSE, ruleConfig(rule, options, settings)], 'x.ts');
