import { parse } from '@typescript-eslint/parser';
import type { TSESTree } from '@typescript-eslint/utils';
import { describe, expect, it } from 'vitest';
import { countedLines, markSkipped } from '../src/counted-lines.ts';

const tokensOf = (code: string): TSESTree.Token[] =>
  parse(code, { tokens: true, loc: true, range: true, jsx: true }).tokens;
const count = (code: string): number => countedLines(tokensOf(code), new Set());

describe('countedLines', () => {
  it.each([
    ['a closing brace', 'f(() => {\n  g();\n}\n);', 2],
    ['a closing paren', 'f(\n  a\n)', 2],
    ['a closing bracket', 'const a = [\n  1\n]', 2],
    ['a semicolon', 'f()\n;', 1],
    ['a comma', 'f(\n  a\n  ,\n  b)', 3],
    ['a JSX `>`', 'const a = <View\n  x={1}\n>\n</View>;', 3],
    ['a JSX `/>`', 'const a = <View\n  x={1}\n/>;', 2],
  ])('does not count a line holding only %s', (_closer, code, expected) => {
    expect(count(code)).toBe(expected);
  });
  it('counts a line that holds any other punctuator', () => {
    expect(count('x = a\n+ b\n- c\n* d')).toBe(4);
  });
  it('counts each non-blank line of a multi-line token at its own line', () => {
    // Lines 2 and 4 hold the template's non-blank lines; line 3 holds only spaces.
    expect(count('f(\n`x\n   \ny`)')).toBe(3);
  });
  it('places the later lines of a multi-line token after its first, not before', () => {
    // Line 1 holds `f`; the template covers lines 2 and 3. Counting backwards from line 2 would
    // land on line 1 again and give 2.
    expect(count('f(\n`x\ny`)')).toBe(3);
  });
  it('never counts a skipped token', () => {
    const tokens = tokensOf('a\nb\nc');
    const skip = new Set<number>();
    markSkipped(skip, tokens.slice(1, 2));
    expect(countedLines(tokens, skip)).toBe(2);
  });
});
