// `@vitest/eslint-plugin` rules for tests and their support files: no focused, skipped or todo
// tests, no conditional tests or assertions, and the matcher allow-list (exact assertions:
// toStrictEqual on the whole value, toBe for a primitive, toThrow with an exact argument).

export const VITEST_RULES = [
  'no-focused-tests',
  'no-disabled-tests',
  'no-test-prefixes',
  'no-identical-title',
  'no-conditional-tests',
  'no-conditional-in-test',
  'no-conditional-expect',
  'no-standalone-expect',
  'require-to-throw-message',
  'valid-expect',
  'valid-title',
  'consistent-vitest-vi',
  'expect-expect',
];

/** `vitest/expect-expect` assertFunctionNames: expect, a test context's `ctx.expect`, and
 * RuleTester's own runs (which assert inside). */
export const ASSERTION_FUNCTIONS = ['expect', '*.expect', 'ruleTester.run', '*.run'];

const LOOSE =
  'Assert exactly: toStrictEqual on the whole value, toBe for a primitive, toThrow with an exact regex or error class.';

/** Matchers that pass on more than the value they name. */
const BANNED = [
  'toEqual',
  'toMatchObject',
  'toContain',
  'toContainEqual',
  'toHaveLength',
  'toHaveProperty',
  'toBeDefined',
  'toBeUndefined',
  'toBeNull',
  'toBeTruthy',
  'toBeFalsy',
  'toBeTypeOf',
  'toBeInstanceOf',
  'toBeCloseTo',
  'toBeOneOf',
  'toSatisfy',
  'toThrowError',
  'toMatchSnapshot',
  'toMatchInlineSnapshot',
  'toMatchFileSnapshot',
  'toHaveBeenCalledWith',
  'toHaveBeenLastCalledWith',
  'toHaveBeenNthCalledWith',
  'toHaveBeenCalled',
];

/** `vitest/no-restricted-matchers`: each banned matcher, with the reason. */
export const RESTRICTED_MATCHERS = Object.fromEntries(BANNED.map((m) => [m, LOOSE]));
