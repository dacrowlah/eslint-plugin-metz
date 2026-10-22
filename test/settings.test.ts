import { describe, expect, it } from 'vitest';
import { lintWith } from './lint.ts';
import { thrownBy } from './thrown.ts';

// Each option resolves on its own: the rule's options, then settings.metz[rule], then the default.
// A function body of `n` counted lines, and a module of `n + 2` (the declaration and its closing
// brace line count once, as `function f() {` alone: the closer never counts).
const body = (n: number): string =>
  `function f() {\n${Array.from({ length: n }, (_, i) => `  g(${String(i)});`).join('\n')}\n}`;
const linesOf = (code: string, options: object, settings: object = {}): string[] =>
  lintWith('max-counted-lines', options, { code, settings: { metz: settings } }).map(
    (m) => m.message,
  );
const FN = (n: number, max: number) =>
  `f has ${String(n)} counted lines (max ${String(max)}). Extract smaller, well-named functions.`;
const MODULE = (n: number, max: number) =>
  `Module has ${String(n)} counted lines (max ${String(max)}). Extract a collaborator module.`;

describe('option precedence', () => {
  it('uses the default when neither the rule nor the settings set an option', () => {
    expect([linesOf(body(5), {}), linesOf(body(6), {})]).toStrictEqual([[], [FN(6, 5)]]);
  });
  it('uses settings.metz over the default', () => {
    const settings = { 'max-counted-lines': { function: 6 } };
    expect([linesOf(body(6), {}, settings), linesOf(body(7), {}, settings)]).toStrictEqual([
      [],
      [FN(7, 6)],
    ]);
  });
  it("uses the rule's own option over settings.metz", () => {
    const settings = { 'max-counted-lines': { function: 6 } };
    expect(linesOf(body(5), { function: 4 }, settings)).toStrictEqual([FN(5, 4)]);
  });
  it('resolves each option on its own: one from the rule, one from settings, one default', () => {
    const settings = { 'max-counted-lines': { file: 4, function: 9 } };
    expect(linesOf(body(5), { function: 4 }, settings)).toStrictEqual([FN(5, 4), MODULE(6, 4)]);
  });
  it("ignores another rule's settings", () => {
    expect(linesOf(body(6), {}, { 'max-params': { max: 9 } })).toStrictEqual([FN(6, 5)]);
  });
});

/** The error ESLint raises when a rule throws while it is created for `x.ts`. */
const crash = (settings: unknown): string =>
  (thrownBy(() => lintWith('max-counted-lines', {}, { settings: { metz: settings } })) as Error)
    .message;
const invalid = (path: string, problem: string): string =>
  `Error while loading rule 'metz/max-counted-lines': eslint-plugin-metz: invalid ${path}: ${problem}\nOccurred while linting x.ts`;
const AT = 'settings.metz["max-counted-lines"]';

describe('invalid shared settings are rejected', () => {
  it.each([
    ['settings.metz is not an object', 4, invalid('settings.metz', 'expected an object')],
    ['settings.metz is an array', [], invalid('settings.metz', 'expected an object')],
    ['settings.metz is null', null, invalid('settings.metz', 'expected an object')],
    [
      'two rule names are misspelt',
      { 'max-counted-line': {}, maxParams: {} },
      invalid(
        'settings.metz',
        'unknown rule "max-counted-line", "maxParams" (expected: component-shape, max-counted-lines, max-params, screen-view-model, waiver-format)',
      ),
    ],
    [
      'a rule name is misspelt',
      { 'max-counted-line': {} },
      invalid(
        'settings.metz',
        'unknown rule "max-counted-line" (expected: component-shape, max-counted-lines, max-params, screen-view-model, waiver-format)',
      ),
    ],
    [
      "a rule's settings are not an object",
      { 'max-counted-lines': 4 },
      invalid(AT, 'expected an object'),
    ],
    [
      "a rule's settings are null",
      { 'max-counted-lines': null },
      invalid(AT, 'expected an object'),
    ],
    [
      'an option is misspelt',
      { 'max-counted-lines': { functon: 4 } },
      invalid(
        AT,
        '"functon" is not an option of metz/max-counted-lines (expected: file, function, componentLogic, componentJsx, exemptCallbacksOf)',
      ),
    ],
    [
      'an integer is a string',
      { 'max-counted-lines': { file: '4' } },
      invalid(`${AT}.file`, 'expected an integer >= 1'),
    ],
    [
      'an integer is a fraction',
      { 'max-counted-lines': { file: 4.5 } },
      invalid(`${AT}.file`, 'expected an integer >= 1'),
    ],
    [
      'an integer is below its minimum',
      { 'max-counted-lines': { file: 0 } },
      invalid(`${AT}.file`, 'expected an integer >= 1'),
    ],
    [
      'an array holds a non-string',
      { 'max-counted-lines': { exemptCallbacksOf: ['describe', 1] } },
      invalid(`${AT}.exemptCallbacksOf`, 'expected an array of strings'),
    ],
    [
      'an array is a string',
      { 'max-counted-lines': { exemptCallbacksOf: 'describe' } },
      invalid(`${AT}.exemptCallbacksOf`, 'expected an array of strings'),
    ],
  ])('when %s', (_, settings, message) => {
    expect(crash(settings)).toBe(message);
  });
  it('accepts an integer at its minimum', () => {
    expect(
      linesOf('f();', {}, { 'max-counted-lines': { componentLogic: 0, file: 1 } }),
    ).toStrictEqual([]);
  });
});

describe('settings named like Object.prototype members', () => {
  it.each(['toString', 'constructor', 'hasOwnProperty'])(
    'reject %s as an unknown option',
    (key) => {
      const settings = { metz: { 'max-params': { [key]: 1 } } };
      expect((thrownBy(() => lintWith('max-params', {}, { settings })) as Error).message).toBe(
        `Error while loading rule 'metz/max-params': eslint-plugin-metz: invalid settings.metz["max-params"]: "${key}" is not an option of metz/max-params (expected: max, bagPattern)\nOccurred while linting x.ts`,
      );
    },
  );
});

describe('a plain string setting', () => {
  it('rejects a number', () => {
    const settings = { metz: { 'screen-view-model': { screenSuffix: 1 } } };
    expect((thrownBy(() => lintWith('screen-view-model', {}, { settings })) as Error).message).toBe(
      `Error while loading rule 'metz/screen-view-model': eslint-plugin-metz: invalid settings.metz["screen-view-model"].screenSuffix: expected a string\nOccurred while linting x.ts`,
    );
  });
  it('accepts an empty one', () => {
    const settings = { metz: { 'screen-view-model': { screenSuffix: '' } } };
    expect(lintWith('screen-view-model', {}, { settings })).toStrictEqual([]);
  });
});

describe('string and boolean settings', () => {
  const waiver = (settings: object): string =>
    (thrownBy(() => lintWith('waiver-format', {}, { settings: { metz: settings } })) as Error)
      .message;
  const wrong = (key: string, type: string) =>
    `Error while loading rule 'metz/waiver-format': eslint-plugin-metz: invalid settings.metz["waiver-format"].${key}: expected ${type}\nOccurred while linting x.ts`;
  it.each([
    ['marker', 1, 'a non-empty string'],
    ['marker', '', 'a non-empty string'],
    ['allowPrettierIgnore', 'yes', 'a boolean'],
  ])('rejects a %s of %j', (key, value, type) => {
    expect(waiver({ 'waiver-format': { [key]: value } })).toBe(wrong(key, type));
  });
});

describe('valid string, boolean and array settings', () => {
  const CODE = [
    '// prettier-ignore',
    '// eslint-disable-next-line max-params -- OK: the platform fixes this signature',
    '// eslint-disable-next-line no-console',
    'f();',
  ].join('\n');
  const waiverIds = (settings: object) =>
    lintWith('waiver-format', {}, { code: CODE, settings: { metz: settings } }).map(
      (m) => m.messageId,
    );
  it('report the snippet under the defaults', () => {
    expect(waiverIds({})).toStrictEqual(['prettierIgnore', 'missingWaiver', 'missingWaiver']);
  });
  it('are accepted and take effect', () => {
    const settings = { marker: 'OK:', guardedPrefixes: ['max-'], allowPrettierIgnore: true };
    expect(waiverIds({ 'waiver-format': settings })).toStrictEqual([]);
  });
});
