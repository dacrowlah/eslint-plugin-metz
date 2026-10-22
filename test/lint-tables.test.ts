import parser from '@typescript-eslint/parser';
import { Linter } from 'eslint';
import { describe, expect, it } from 'vitest';
import { DEMETER_SELECTORS } from '../lint/demeter.ts';
import { FLAG_PARAM_BANS } from '../lint/flag-params.ts';
import { MUTATION_SYNTAX_BANS } from '../lint/mutation-bans.ts';
import { tagOf } from '../lint/tag.ts';
import { TEST_SYNTAX_BANS } from '../lint/test-bans.ts';

// This repository's own lint tables (eslint.config.ts wires them in): each entry reports its
// shape, by its tag, and leaves the allowed neighbour alone.
const linter = new Linter({ configType: 'flat' });
const BANS = [
  ...FLAG_PARAM_BANS,
  ...DEMETER_SELECTORS,
  ...MUTATION_SYNTAX_BANS,
  ...TEST_SYNTAX_BANS,
];

/** The tags of every ban `code` breaks, in order. */
const tags = (code: string): (string | null)[] =>
  linter
    .verify(
      code,
      [
        {
          files: ['**/*.ts'],
          languageOptions: { parser },
          rules: { 'no-restricted-syntax': ['error', ...BANS] },
        },
      ],
      'x.ts',
    )
    .map((m) => tagOf(m.message));

describe('lint tables', () => {
  it.for([
    ['vi.mock("./x.ts");', 'test/mock-ours'],
    ["vi.doMock('../src/a.ts', () => ({}));", 'test/mock-ours'],
    ["expect(f).toThrow('boom');", 'test/throw-string'],
    ['expect(f).toThrow(`boom`);', 'test/throw-string'],
    ["expect(s.includes('a')).toBe(true);", 'test/expect-boolean'],
    ['expect(a === b).toBe(true);', 'test/expect-boolean'],
    ["expect([s.startsWith('a'), n]).toStrictEqual([true, 1]);", 'test/expect-boolean-in-array'],
    ['a.b.c.d();', 'demeter/chain'],
    ['const x = (a + 1) as number;', 'mutation/no-code-in-as'],
    ['function f(on: boolean) {}', 'flag/param'],
  ])('reports %s as %s', ([code, tag]) => {
    expect(tags(String(code))).toStrictEqual([tag]);
  });
  it.for([
    "vi.mock('vitest');",
    'expect(f).toThrow(/^boom$/);',
    'expect(f).toThrow();',
    "expect(s.slice(0, 1)).toBe('a');",
    'expect([n, m]).toStrictEqual([1, 2]);',
    'a.b.c();',
    'const x = y as number;',
    'function f(on: Mode) {}',
  ])('allows %s', (code) => {
    expect(tags(code)).toStrictEqual([]);
  });
});
