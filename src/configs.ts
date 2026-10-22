// The preset flat configs. Each preset is an array of named config objects (ESLint's "Create
// Plugins" guide: configs live under `configs`, reference the plugin itself, and are flat), so a
// project can extend one whole or drop and replace any block by its name:
//
//   <level>                 the rules, on every file ESLint lints
//   <level>/tests           test files: longer files and test bodies, `describe` callbacks exempt
//   <level>/config-files    tool config files: no line or parameter limits
//   <level>/declarations    `.d.ts` files: no line or parameter limits
//   <level>-react/...       components (component-shape) and screens (screen-view-model)
//
// Limits are left to each rule's options resolution (rule options, then `settings.metz`, then
// Sandi Metz's numbers), so a project sets them once in shared settings for every preset block.
import type { ESLint, Linter } from 'eslint';
import {
  CONFIG_FILES,
  DECLARATION_FILES,
  frozen,
  JSX_FILES,
  SCREEN_FILES,
  TEST_FILES,
} from './globs.ts';

type Config = Linter.Config;
type Severity = 'warn' | 'error';
type Plugin = ESLint.Plugin;

/** A preset level: its name, the severity of its rules, and rules only it turns on. */
type Level = {
  readonly name: string;
  readonly severity: Severity;
  readonly only: Linter.RulesRecord;
};

/** Gradual adoption: every limit at Metz's numbers, reported as warnings; no waiver policy. */
const RECOMMENDED: Level = { name: 'recommended', severity: 'warn', only: {} };
/** Sandi Metz's rules exactly, as errors, with the waiver policy (rule zero). */
const STRICT: Level = {
  name: 'strict',
  severity: 'error',
  only: { 'metz/waiver-format': 'error' },
};

/** Test files: files up to 150 counted lines, test bodies up to 10, suites exempt. Frozen: the
 * presets use this very object. */
export const TEST_LIMITS = frozen({
  file: 150,
  function: 10,
  exemptCallbacksOf: frozen(['describe', 'suite']),
});

const LIMITS_OFF: Linter.RulesRecord = {
  'metz/max-counted-lines': 'off',
  'metz/max-params': 'off',
};

/** A block after a preset's main one: the part it names, its files, and its rules at a severity. */
type Block = {
  readonly part: string;
  readonly files: string[];
  readonly rules: (severity: Severity) => Linter.RulesRecord;
};

const OVERRIDES: Block[] = [
  {
    part: 'tests',
    files: TEST_FILES,
    rules: (s) => ({ 'metz/max-counted-lines': [s, TEST_LIMITS] }),
  },
  { part: 'config-files', files: CONFIG_FILES, rules: () => ({ ...LIMITS_OFF }) },
  { part: 'declarations', files: DECLARATION_FILES, rules: () => ({ ...LIMITS_OFF }) },
];
/** Test files hold components and screens of their own, so the React blocks leave them alone. */
const REACT: Block[] = [
  { part: 'components', files: JSX_FILES, rules: (s) => ({ 'metz/component-shape': s }) },
  { part: 'screens', files: SCREEN_FILES, rules: (s) => ({ 'metz/screen-view-model': s }) },
];

const blockFor =
  (prefix: string, severity: Severity) =>
  ({ part, files, rules }: Block): Config => ({
    name: `${prefix}/${part}`,
    files,
    rules: rules(severity),
  });

const rulesOf = ({ severity, only }: Level): Linter.RulesRecord => ({
  'metz/max-counted-lines': severity,
  'metz/max-params': severity,
  ...only,
});

function preset(plugin: Plugin, level: Level): Config[] {
  const main = { name: `metz/${level.name}`, plugins: { metz: plugin }, rules: rulesOf(level) };
  return [main, ...OVERRIDES.map(blockFor(`metz/${level.name}`, level.severity))];
}

function react(plugin: Plugin, level: Level): Config[] {
  const blocks = REACT.map(blockFor(`metz/${level.name}-react`, level.severity));
  return [...preset(plugin, level), ...blocks.map((b) => ({ ...b, ignores: TEST_FILES }))];
}

export type Presets = {
  recommended: Config[];
  strict: Config[];
  'recommended-react': Config[];
  'strict-react': Config[];
};

/** The presets, each referencing `plugin` itself. */
export const presetsFor = (plugin: Plugin): Presets => ({
  recommended: preset(plugin, RECOMMENDED),
  strict: preset(plugin, STRICT),
  'recommended-react': react(plugin, RECOMMENDED),
  'strict-react': react(plugin, STRICT),
});
