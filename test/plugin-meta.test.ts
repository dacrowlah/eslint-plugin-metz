import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import plugin from '../src/index.ts';
import { lintWith } from './lint.ts';
import { thrownBy } from './thrown.ts';

// RuleTester compares message ids, never the text a developer reads, and never checks that a
// rule's options schema rejects a typo. This file pins both, and every rule's docs, through the
// plugin's public entry.
const MANIFEST = JSON.parse(readFileSync(new URL('../package.json', import.meta.url), 'utf8')) as {
  version: string;
};
const DOCS = `https://github.com/dacrowlah/eslint-plugin-metz/blob/v${MANIFEST.version}/docs/rules`;

const MESSAGES = {
  'component-shape': {
    renderHelper:
      '`{{name}}` returns JSX but is not a component. Extract a component into its own file instead of a render helper.',
    nestedComponent:
      'Component `{{name}}` is defined inside another scope. Move it to its own file.',
    anonymous: 'Components must be named PascalCase functions.',
    onePerFile: 'Second component `{{name}}` in this file. One component per file.',
    jsxDepth: 'JSX nested {{depth}} levels deep (max {{max}}). Extract a subcomponent.',
  },
  'max-counted-lines': {
    file: 'Module has {{n}} counted lines (max {{max}}). Extract a collaborator module.',
    function:
      '{{name}} has {{n}} counted lines (max {{max}}). Extract smaller, well-named functions.',
    componentLogic:
      'Component {{name}} has {{n}} counted lines of logic before its JSX (max {{max}}). Move logic into its view-model hook or a pure presenter.',
    componentJsx:
      'Component {{name}} returns {{n}} counted lines of JSX (max {{max}}). Extract subcomponents (one per file).',
  },
  'max-params': {
    tooMany:
      '{{name}} takes {{n}} parameters counting option/prop keys (max {{max}}). Introduce a parameter object or presentation model.',
    uncountable:
      'Cannot count the keys of `{{type}}`. Declare option/props types in this file as a type literal or interface without `extends`.',
    restBag:
      'Do not use `...rest` in a destructured parameter; it hides how many options/props are passed.',
  },
  'screen-view-model': {
    exactlyOne:
      'Screen `{{name}}` calls {{n}} hooks. A screen calls exactly one view-model hook; move other hooks inside it.',
    notViewModel:
      'Screen `{{name}}` must get its data from a view-model hook matching /{{pattern}}/, not `{{hook}}`.',
    binding:
      'Bind the view model to one identifier (`const vm = useXViewModel()`) or destructure it one level deep.',
    reachThrough:
      '`{{text}}` reaches through the view model. Pass the slice to a child component or add a property to the view model.',
    spread: 'Do not spread the view model into JSX; pass named slices.',
    wholeViewModel:
      "Pass `<{{name}}>` one slice of the view model, not all of it. Only the screen's own view `<{{view}} vm={vm} />` takes it whole.",
  },
  'waiver-format': {
    nextLineOnly: 'Waive {{rules}} only with `eslint-disable-next-line`, one site at a time.',
    inlineConfig:
      'Do not change {{rules}} with `/* eslint */` or `eslint-enable` comments. Only a next-line waiver may.',
    prettierIgnore:
      '`prettier-ignore` is banned: it defeats counted lines, and Prettier ignores a waiver reason on it. Format the code instead.',
    missingWaiver:
      'Disabling {{rules}} needs `-- {{marker}} <reason, at least {{min}} letters or digits>`.',
  },
};

/** Each rule's type and docs, as the docs and editors read them. */
const META = {
  'component-shape': [
    'suggestion',
    'Enforce one component per file, no render helpers or nested components, and a JSX depth limit',
  ],
  'max-counted-lines': [
    'suggestion',
    'Enforce counted-line limits per file, function and component (Sandi Metz rules 1 and 2)',
  ],
  'max-params': [
    'suggestion',
    'Enforce a parameter limit that counts option-object keys and props one each (Sandi Metz rule 3)',
  ],
  'screen-view-model': [
    'problem',
    'Require a screen to call exactly one view-model hook and never reach through it (Sandi Metz rule 4)',
  ],
  'waiver-format': [
    'problem',
    'Require every rule waiver to be a next-line disable with a written reason (Sandi Metz rule zero)',
  ],
};

/** One valid value for every option each rule documents. */
const EVERY_OPTION = {
  'component-shape': { maxJsxDepth: 2 },
  'max-counted-lines': {
    file: 90,
    function: 4,
    componentLogic: 0,
    componentJsx: 10,
    exemptCallbacksOf: ['describe'],
  },
  'max-params': { max: 3, bagPattern: 'Props$' },
  'screen-view-model': {
    viewModelPattern: '^use\\w+Model$',
    screenSuffix: 'Page',
    viewSuffix: 'Body',
  },
  'waiver-format': {
    minReasonLength: 5,
    marker: 'OK:',
    guardedPrefixes: ['metz/'],
    allowPrettierIgnore: true,
  },
};
const RULES = Object.keys(MESSAGES);
/** The option names each rule's schema lists, as ESLint prints them when it rejects a typo. */
const DOCUMENTED = {
  'component-shape': '"maxJsxDepth"',
  'max-counted-lines': '"file", "function", "componentLogic", "componentJsx", "exemptCallbacksOf"',
  'max-params': '"max", "bagPattern"',
  'screen-view-model': '"viewModelPattern", "screenSuffix", "viewSuffix"',
  'waiver-format': '"minReasonLength", "marker", "guardedPrefixes", "allowPrettierIgnore"',
};
type Rule = keyof typeof MESSAGES;
type RuleMeta = { meta: { type: string; docs: object; messages: object; defaultOptions: unknown } };
const ruleOf = (rule: string) => (plugin.rules as Record<string, RuleMeta>)[rule];

describe('eslint-plugin-metz', () => {
  it('names itself after its package and its namespace, and registers exactly the five rules', () => {
    const meta = { name: 'eslint-plugin-metz', version: MANIFEST.version, namespace: 'metz' };
    expect(plugin.meta).toStrictEqual(meta);
    expect(Object.keys(plugin.rules)).toStrictEqual(RULES);
  });
  it.each(RULES)('%s has exactly the pinned message texts', (rule) => {
    expect(ruleOf(rule)?.meta.messages).toStrictEqual(MESSAGES[rule as Rule]);
  });
  it.each(RULES)('%s has its type, description and docs URL at the installed version', (rule) => {
    const [type, description] = META[rule as Rule];
    const meta = ruleOf(rule)?.meta;
    const url = `${DOCS}/${rule}.md`;
    expect([meta?.type, meta?.docs, meta?.defaultOptions]).toStrictEqual([
      type,
      { description, url },
      [{}],
    ]);
  });
  it.each(RULES)('%s accepts every documented option', (rule) => {
    expect(lintWith(rule, EVERY_OPTION[rule as Rule])).toStrictEqual([]);
  });
  it('waiver-format rejects an empty marker', () => {
    expect((thrownBy(() => lintWith('waiver-format', { marker: '' })) as Error).message).toBe(
      'Key "rules": Key "metz/waiver-format":\n\tValue "" should NOT be shorter than 1 characters.\n',
    );
  });
  it.each(Object.entries(DOCUMENTED))('%s rejects an option it does not document', (rule, keys) => {
    expect((thrownBy(() => lintWith(rule, { maxx: 1 })) as Error).message).toBe(
      `Key "rules": Key "metz/${rule}":\n\tValue {"maxx":1} should NOT have additional properties.\n\t\tUnexpected property "maxx". Expected properties: ${keys}.\n`,
    );
  });
});
