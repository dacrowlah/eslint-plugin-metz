// eslint-plugin-metz: the plugin object (ESLint 10 flat config only) and its building blocks.
import type { ESLint, Rule } from 'eslint';
import { type Presets, presetsFor } from './configs.ts';
import { MANIFEST } from './package-info.ts';
import componentShape from './rules/component-shape.ts';
import maxCountedLines from './rules/max-counted-lines.ts';
import maxParams from './rules/max-params.ts';
import screenViewModel from './rules/screen-view-model.ts';
import waiverFormat from './rules/waiver-format.ts';

export { BAG_SUFFIXES } from './bags.ts';
export { TEST_LIMITS } from './configs.ts';
export type { Presets } from './configs.ts';
export { CONFIG_FILES, DECLARATION_FILES, JSX_FILES, SCREEN_FILES, TEST_FILES } from './globs.ts';

const typed = {
  'component-shape': componentShape,
  'max-counted-lines': maxCountedLines,
  'max-params': maxParams,
  'screen-view-model': screenViewModel,
  'waiver-format': waiverFormat,
};
type Rules = Record<keyof typeof typed, Rule.RuleModule>;
/** typescript-eslint types each rule for its own RuleContext, which ESLint's `Plugin` type does
 * not accept; at run time they are ESLint rules. The plugin's public type is ESLint's, so a
 * consumer's `defineConfig` takes it as it is: this is the one cast. */
const rules = typed as unknown as Rules;

/** Filled in below: each preset references the plugin object itself. */
const configs = {} as Presets;

type MetzPlugin = ESLint.Plugin & {
  meta: { name: string; version: string; namespace: string };
  rules: Rules;
  configs: Presets;
};

const plugin: MetzPlugin = {
  meta: { name: MANIFEST.name, version: MANIFEST.version, namespace: 'metz' },
  rules,
  configs,
};
Object.assign(configs, presetsFor(plugin));

export default plugin;
