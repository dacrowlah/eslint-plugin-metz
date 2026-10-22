import { describe, expect, it } from 'vitest';
import componentShape, { RULE as COMPONENT_SHAPE } from '../src/rules/component-shape.ts';
import maxCountedLines, { RULE as MAX_COUNTED_LINES } from '../src/rules/max-counted-lines.ts';
import maxParams, { RULE as MAX_PARAMS } from '../src/rules/max-params.ts';
import screenViewModel, { RULE as SCREEN_VIEW_MODEL } from '../src/rules/screen-view-model.ts';
import waiverFormat, { RULE as WAIVER_FORMAT } from '../src/rules/waiver-format.ts';

// Each rule's options: their defaults (Sandi Metz's numbers, and the conventions the README
// documents) and their schema, descriptions included (the docs' options tables are generated from
// them). Pinned literally: a changed default or option is a semver decision (CLAUDE.md).
const int = (minimum: number, description: string) => ({ type: 'integer', minimum, description });
const str = (description: string) => ({ type: 'string', description });
const strings = (description: string) => ({
  type: 'array',
  items: { type: 'string' },
  description,
});

const SPECS = {
  'component-shape': {
    name: 'component-shape',
    defaults: { maxJsxDepth: 3 },
    properties: {
      maxJsxDepth: int(
        0,
        'Deepest JSX nesting inside one return, the root element being depth 0. Default 3.',
      ),
    },
  },
  'max-counted-lines': {
    name: 'max-counted-lines',
    defaults: {
      file: 100,
      function: 5,
      componentLogic: 5,
      componentJsx: 15,
      exemptCallbacksOf: [],
    },
    properties: {
      file: int(1, 'Most counted lines in a module, imports and re-exports excluded. Default 100.'),
      function: int(
        1,
        'Most counted lines in the body of a function, method, hook or `static {}` block that is not a component. Default 5.',
      ),
      componentLogic: int(
        0,
        "Most counted lines of a component's logic: its body before the final JSX `return`, plus every condition inside that return. Default 5.",
      ),
      componentJsx: int(1, "Most counted lines of a component's final JSX `return`. Default 15."),
      exemptCallbacksOf: strings(
        'Callees whose callbacks are not measured, matched by the name a call starts from (`describe` also matches `describe.each(rows)(...)`). Default none.',
      ),
    },
  },
  'max-params': {
    name: 'max-params',
    defaults: { max: 4, bagPattern: '(Props|Options|Opts|Params|Args)$' },
    properties: {
      max: int(0, 'Most parameters a function takes, counting option and prop keys. Default 4.'),
      bagPattern: str(
        'Regular expression for the names of option-bag types, whose members count one each. Default `(Props|Options|Opts|Params|Args)$`.',
      ),
    },
  },
  'screen-view-model': {
    name: 'screen-view-model',
    defaults: {
      viewModelPattern: '^use[A-Z]\\w*ViewModel$',
      screenSuffix: 'Screen',
      viewSuffix: 'View',
    },
    properties: {
      viewModelPattern: str(
        "Regular expression the screen's one hook must match. Default `^use[A-Z]\\w*ViewModel$`.",
      ),
      screenSuffix: str(
        "Suffix removed from a screen's name to name its own view (`RaceScreen` -> `Race`). Default `Screen`.",
      ),
      viewSuffix: str(
        'Suffix added to name the one component that may take the whole view model (`Race` -> `RaceView`). Default `View`.',
      ),
    },
  },
  'waiver-format': {
    name: 'waiver-format',
    defaults: {
      marker: 'WAIVER:',
      minReasonLength: 20,
      guardedPrefixes: [''],
      allowPrettierIgnore: false,
    },
    properties: {
      minReasonLength: int(
        1,
        'Fewest letters or digits the reason after the marker holds (spaces and punctuation do not count). Default 20.',
      ),
      marker: {
        type: 'string',
        minLength: 1,
        description: "The label a waiver's `-- description` starts with. Default `WAIVER:`.",
      },
      guardedPrefixes: strings(
        'Rule id prefixes that need a waiver to disable (`metz/`, `boundaries/`). Default `[""]`: every rule.',
      ),
      allowPrettierIgnore: {
        type: 'boolean',
        description:
          'Allow `prettier-ignore` comments, which cannot carry a waiver. Default false.',
      },
    },
  },
};

const RULES = [
  ['component-shape', COMPONENT_SHAPE, componentShape.meta.schema],
  ['max-counted-lines', MAX_COUNTED_LINES, maxCountedLines.meta.schema],
  ['max-params', MAX_PARAMS, maxParams.meta.schema],
  ['screen-view-model', SCREEN_VIEW_MODEL, screenViewModel.meta.schema],
  ['waiver-format', WAIVER_FORMAT, waiverFormat.meta.schema],
] as const;

describe('rule specs', () => {
  it.for(RULES)('%s has exactly its documented name, defaults and options', ([name, spec]) => {
    expect(spec).toStrictEqual(SPECS[name]);
  });
  it.for(RULES)('%s takes one options object of exactly those options', ([name, , schema]) => {
    const { properties } = SPECS[name];
    expect(schema).toStrictEqual([{ type: 'object', additionalProperties: false, properties }]);
  });
});
