import { describe, expect, it } from 'vitest';
import plugin, {
  CONFIG_FILES,
  DECLARATION_FILES,
  JSX_FILES,
  SCREEN_FILES,
  TEST_FILES,
  TEST_LIMITS,
} from '../src/index.ts';

// The presets and their globs, pinned literally: they are the plugin's public contract (README,
// "Presets" and "Overrides"), and a change to any value is a semver decision.
const SOURCE = '{js,jsx,mjs,cjs,ts,tsx,mts,cts}';
const TESTS_GLOBS = [`**/*.{test,spec}.${SOURCE}`, `**/__tests__/**/*.${SOURCE}`];
const CONFIG_GLOBS = ['**/*.config.{js,cjs,mjs,ts,cts,mts}'];
const OFF = { 'metz/max-counted-lines': 'off', 'metz/max-params': 'off' };
const TESTS = { file: 150, function: 10, exemptCallbacksOf: ['describe', 'suite'] };
const STRICT_ONLY = { 'metz/waiver-format': 'error' };

const main = (level: string, severity: string, only: object) => ({
  name: `metz/${level}`,
  plugins: { metz: plugin },
  rules: { 'metz/max-counted-lines': severity, 'metz/max-params': severity, ...only },
});
const overrides = (level: string, severity: string) => [
  {
    name: `metz/${level}/tests`,
    files: TESTS_GLOBS,
    rules: { 'metz/max-counted-lines': [severity, TESTS] },
  },
  { name: `metz/${level}/config-files`, files: CONFIG_GLOBS, rules: OFF },
  { name: `metz/${level}/declarations`, files: ['**/*.d.{ts,mts,cts}'], rules: OFF },
];
const REACT_PARTS = [
  ['components', ['**/*.{jsx,tsx}'], 'metz/component-shape'],
  ['screens', ['**/*Screen.{jsx,tsx}'], 'metz/screen-view-model'],
] as const;
const react = (level: string, severity: string) =>
  REACT_PARTS.map(([part, files, rule]) => ({
    name: `metz/${level}-react/${part}`,
    files: [...files],
    ignores: TESTS_GLOBS,
    rules: { [rule]: severity },
  }));
const RECOMMENDED = [main('recommended', 'warn', {}), ...overrides('recommended', 'warn')];
const STRICT = [main('strict', 'error', STRICT_ONLY), ...overrides('strict', 'error')];

describe('presets', () => {
  it('are exactly recommended, strict and their React variants', () => {
    expect(Object.keys(plugin.configs)).toStrictEqual([
      'recommended',
      'strict',
      'recommended-react',
      'strict-react',
    ]);
  });
  it('recommended warns at every limit and leaves the waiver policy off', () => {
    expect(plugin.configs.recommended).toStrictEqual(RECOMMENDED);
  });
  it('strict errors at every limit and turns the waiver policy on', () => {
    expect(plugin.configs.strict).toStrictEqual(STRICT);
  });
  it('recommended-react adds the component and screen rules as warnings', () => {
    const expected = [...RECOMMENDED, ...react('recommended', 'warn')];
    expect(plugin.configs['recommended-react']).toStrictEqual(expected);
  });
  it('strict-react adds the component and screen rules as errors', () => {
    expect(plugin.configs['strict-react']).toStrictEqual([...STRICT, ...react('strict', 'error')]);
  });
  it('reference the plugin object itself, so a project may also name it in `plugins`', () => {
    const { recommended, strict } = plugin.configs;
    const all = [
      recommended,
      strict,
      plugin.configs['recommended-react'],
      plugin.configs['strict-react'],
    ];
    const owners = all.map((preset) => preset[0]?.plugins?.['metz']);
    expect(owners.filter((owner) => owner === plugin).length).toBe(4);
  });
});

describe('exported building blocks', () => {
  it.for([
    ['TEST_FILES', TEST_FILES, TESTS_GLOBS],
    ['CONFIG_FILES', CONFIG_FILES, CONFIG_GLOBS],
    ['DECLARATION_FILES', DECLARATION_FILES, ['**/*.d.{ts,mts,cts}']],
    ['JSX_FILES', JSX_FILES, ['**/*.{jsx,tsx}']],
    ['SCREEN_FILES', SCREEN_FILES, ['**/*Screen.{jsx,tsx}']],
  ] as const)('%s is exactly the glob the presets use', ([, actual, expected]) => {
    expect(actual).toStrictEqual(expected);
  });
  it('TEST_LIMITS are the test-file limits', () => {
    expect(TEST_LIMITS).toStrictEqual(TESTS);
  });
  it('give every block of every preset its own rules object, so changing one changes no other', () => {
    const { recommended, strict } = plugin.configs;
    const presets = [
      recommended,
      strict,
      plugin.configs['recommended-react'],
      plugin.configs['strict-react'],
    ];
    const rules = presets.flat().map((block) => block.rules);
    expect([new Set(rules).size, rules.length]).toStrictEqual([20, 20]);
  });
  it('are frozen, so no project can change what every preset uses', () => {
    const exported = [TEST_FILES, CONFIG_FILES, DECLARATION_FILES, JSX_FILES, SCREEN_FILES];
    const all = [...exported, TEST_LIMITS, TEST_LIMITS.exemptCallbacksOf];
    expect(all.map((value) => Object.isFrozen(value))).toStrictEqual(all.map(() => true));
  });
});
