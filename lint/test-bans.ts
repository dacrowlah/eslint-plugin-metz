// `no-restricted-syntax` bans for tests and their support files, for what the vitest rules do not
// see: a mock of one of our modules (fakes over mocks), a `toThrow` given a string (it matches any
// substring), and a loose check handed to `expect` as a boolean (`expect(s.includes(x))`,
// `expect([a === b])`), which passes on more than it names.
import { syntaxBans } from './tag.ts';

const ban = syntaxBans('test');

/** Calls whose result is a yes or no about a value, not the value. */
const PREDICATE_CALL =
  'CallExpression[callee.property.name=/^(includes|startsWith|endsWith|some|every|has|test)$/]';
const COMPARISON = 'BinaryExpression[operator=/^(===|!==|==|!=|<|<=|>|>=|in|instanceof)$/]';
const LOOSE = `:matches(${PREDICATE_CALL}, ${COMPARISON})`;
const EXPECT = "CallExpression[callee.name='expect']";
const EXACT =
  'Assert the value itself, exactly: a yes-or-no check handed to expect passes on more than it names.';

export const TEST_SYNTAX_BANS = [
  ban(
    'mock-ours',
    "CallExpression[callee.object.name='vi'][callee.property.name=/^(mock|doMock)$/][arguments.0.value=/^\\./]",
    'Fakes over mocks: never vi.mock a module of ours; inject a fake of it.',
  ),
  ban(
    'throw-string',
    "CallExpression[callee.property.name='toThrow'] > :matches(Literal[raw=/^['\"]/], TemplateLiteral)",
    'Pass toThrow an anchored regex literal or an error class: a string matches any substring.',
  ),
  ban('expect-boolean', `${EXPECT} > ${LOOSE}`, EXACT),
  ban('expect-boolean-in-array', `${EXPECT} > ArrayExpression > ${LOOSE}`, EXACT),
];
