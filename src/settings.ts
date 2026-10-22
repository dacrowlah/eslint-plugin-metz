// ESLint shared settings under `metz`: `settings: { metz: { '<rule>': { <option>: value } } }`.
// ESLint hands settings to rules as they are, unvalidated, so they are validated here against each
// rule's options schema, and a typo throws: a misspelt limit never silently falls back to a default.

/** The rules that read shared settings: the keys `settings.metz` may hold. */
export const RULE_NAMES = [
  'component-shape',
  'max-counted-lines',
  'max-params',
  'screen-view-model',
  'waiver-format',
] as const;
export type RuleName = (typeof RULE_NAMES)[number];

/** The JSON Schema subset the rules' options use. */
export type Property = { readonly description: string } & (
  | { readonly type: 'integer'; readonly minimum: number }
  | { readonly type: 'string'; readonly minLength?: 1 }
  | { readonly type: 'boolean' }
  | { readonly type: 'array'; readonly items: { readonly type: 'string' } }
);
export type Properties = Readonly<Record<string, Property>>;
type Setting = {
  readonly rule: RuleName;
  readonly properties: Properties;
  readonly key: string;
  readonly value: unknown;
};

const KNOWN_RULES: readonly string[] = RULE_NAMES;

class SettingsError extends Error {
  constructor(path: string, problem: string) {
    super(`eslint-plugin-metz: invalid ${path}: ${problem}`);
  }
}

/** What a value of a property must be, as an error message says it. */
function expected(p: Property): string {
  if (p.type === 'integer') return `an integer >= ${String(p.minimum)}`;
  if (p.type === 'string' && p.minLength) return 'a non-empty string';
  return p.type === 'array' ? 'an array of strings' : `a ${p.type}`;
}

const isStrings = (value: unknown): boolean =>
  Array.isArray(value) && value.every((item) => typeof item === 'string');

/** A string, and a non-empty one when the property says so. */
const isString = (value: unknown, { minLength = 0 }: { readonly minLength?: number }): boolean =>
  typeof value === 'string' && value.length >= minLength;

function isValid(value: unknown, p: Property): boolean {
  if (p.type === 'integer') return Number.isInteger(value) && (value as number) >= p.minimum;
  if (p.type === 'string') return isString(value, p);
  return p.type === 'array' ? isStrings(value) : typeof value === p.type;
}

const isRecord = (value: unknown): value is Record<string, unknown> =>
  typeof value === 'object' && value !== null && !Array.isArray(value);

/** The object at `path`: an absent setting is an empty one; any other value, `null` included,
 * must be an object. */
function objectAt(path: string, value: unknown): Record<string, unknown> {
  const found = value === undefined ? {} : value;
  if (!isRecord(found)) throw new SettingsError(path, 'expected an object');
  return found;
}

const unknownRules = (keys: readonly string[]): string =>
  `unknown rule "${keys.join('", "')}" (expected: ${RULE_NAMES.join(', ')})`;

/** `settings.metz` itself: an object keyed by rule name. */
function metzSettings(settings: Readonly<Record<string, unknown>>): Record<string, unknown> {
  const metz = objectAt('settings.metz', settings['metz']);
  const unknown = Object.keys(metz).filter((key) => !KNOWN_RULES.includes(key));
  if (unknown.length > 0) throw new SettingsError('settings.metz', unknownRules(unknown));
  return metz;
}

const pathOf = (rule: RuleName): string => `settings.metz["${rule}"]`;
const notAnOption = ({ rule, properties, key }: Setting): string =>
  `"${key}" is not an option of metz/${rule} (expected: ${Object.keys(properties).join(', ')})`;

function checkSetting(s: Setting): void {
  const p = Object.hasOwn(s.properties, s.key) ? s.properties[s.key] : undefined;
  if (!p) throw new SettingsError(pathOf(s.rule), notAnOption(s));
  if (!isValid(s.value, p))
    throw new SettingsError(`${pathOf(s.rule)}.${s.key}`, `expected ${expected(p)}`);
}

/** One rule's shared settings, validated against its options schema. */
export function sharedSettings(
  settings: Readonly<Record<string, unknown>>,
  rule: RuleName,
  properties: Properties,
): Record<string, unknown> {
  const shared = objectAt(pathOf(rule), metzSettings(settings)[rule]);
  for (const [key, value] of Object.entries(shared)) checkSetting({ rule, properties, key, value });
  return shared;
}
