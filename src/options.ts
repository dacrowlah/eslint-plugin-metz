// Option resolution shared by every rule. Each option resolves on its own, by this precedence:
//
//   1. the rule's own options in the config      'metz/max-params': ['error', { max: 3 }]
//   2. ESLint shared settings, under `metz`      settings: { metz: { 'max-params': { max: 5 } } }
//   3. the rule's built-in default
//
// Rule options are validated by ESLint against the rule's schema; shared settings are validated
// against the same schema in settings.ts. The rules declare `meta.defaultOptions: [{}]`: defaults
// merged in by ESLint would hide the shared settings.
import { type Properties, type Property, type RuleName, sharedSettings } from './settings.ts';

export type { Properties } from './settings.ts';

/** What a rule resolves its options from: its name (its key in `settings.metz`), its options'
 * schema properties and its defaults. */
export type RuleSpec<T> = {
  readonly name: RuleName;
  readonly properties: Properties;
  readonly defaults: T;
};

type OptionsSchema = [
  { type: 'object'; additionalProperties: false; properties: Record<string, Property> },
];
/** A rule's `meta.schema`: one options object holding exactly `properties`. */
export const optionsSchema = (properties: Properties): OptionsSchema => [
  { type: 'object', additionalProperties: false, properties },
];

/** The options a rule runs with: its own options, over shared settings, over its defaults. */
export function resolveOptions<T extends object>(
  context: { readonly settings: Readonly<Record<string, unknown>> },
  rule: RuleSpec<T>,
  given: Partial<T> | undefined,
): T {
  const shared = sharedSettings(context.settings, rule.name, rule.properties);
  return Object.assign({}, rule.defaults, shared, given);
}
