import { describe, expect, it } from 'vitest';
import { findForbiddenDirectives } from '../src/directives-check.ts';

// Exact violations, one per reason, as the gate prints them: position, reason, the rules the
// comment names, and the message. directives.test.ts covers which comments are reported at all.
const NEXT_LINE = 'use `// eslint-disable-next-line <rule> -- <reason>`';
const TWENTY = 'abcdefghij 0123456789'; // the default minimum of letters and digits, exactly

describe('findForbiddenDirectives reports', () => {
  it.each([
    {
      reason: 'config',
      source: '/* eslint max-params: "off" */',
      column: 1,
      rules: ['max-params'],
      message: 'inline `eslint` config comments are forbidden',
    },
    {
      reason: 'enable',
      source: '/* eslint-enable max-params */',
      column: 1,
      rules: ['max-params'],
      message: '`eslint-enable` is forbidden',
    },
    {
      reason: 'block-disable',
      source: '/* eslint-disable max-lines */',
      column: 1,
      rules: ['max-lines'],
      message: `block \`eslint-disable\` is forbidden; ${NEXT_LINE}`,
    },
    {
      reason: 'line-disable',
      source: 'f(); // eslint-disable-line complexity',
      column: 6,
      rules: ['complexity'],
      message: `\`eslint-disable-line\` is forbidden; ${NEXT_LINE}`,
    },
    {
      reason: 'blanket',
      source: '// eslint-disable-next-line\nf();',
      column: 1,
      rules: [],
      message: '`eslint-disable-next-line` must name the rule(s) it waives',
    },
    {
      reason: 'self-disable',
      source: '// eslint-disable-next-line metz/waiver-format -- x\nf();',
      column: 1,
      rules: ['metz/waiver-format'],
      message: 'metz/waiver-format may not be disabled by a comment',
    },
    {
      reason: 'missing-description',
      source: '// eslint-disable-next-line no-console\nf();',
      column: 1,
      rules: ['no-console'],
      message: '`eslint-disable-next-line` needs `-- <description>`',
    },
    {
      reason: 'missing-waiver',
      source: '// eslint-disable-next-line max-params -- WAIVER: too short\nf();',
      column: 1,
      rules: ['max-params'],
      message: 'waiving a rule needs `-- WAIVER: <reason of at least 20 letters or digits>`',
    },
    {
      reason: 'unparseable',
      source: '/* eslint-nope a, b */\nf();',
      column: 1,
      rules: [],
      message: 'this directive-like comment cannot be parsed by ESLint, so it cannot be checked',
    },
  ])('$reason, exactly', (row) => {
    const { source, ...violation } = row;
    expect(findForbiddenDirectives(source, 'a.ts')).toStrictEqual([{ line: 1, ...violation }]);
  });
  it('config with no rules when ESLint cannot parse the config', () => {
    const [v] = findForbiddenDirectives('/* eslint max-params: [ */', 'a.ts');
    expect([v?.reason, v?.rules]).toStrictEqual(['config', []]);
  });
  it('parse-error for a file it cannot parse, at 1:1', () => {
    expect(findForbiddenDirectives('const = ;', 'a.ts')).toStrictEqual([
      {
        line: 1,
        column: 1,
        reason: 'parse-error',
        rules: [],
        message: 'cannot parse this file, so its directives cannot be checked',
      },
    ]);
  });
  it('parse-error for JSX in a .ts file, even one named like .tsx.ts', () => {
    expect(findForbiddenDirectives('<V />;', 'a.tsx.ts').map((v) => v.reason)).toStrictEqual([
      'parse-error',
    ]);
  });
  it('nothing for JSX in a .tsx or .jsx file', () => {
    expect(findForbiddenDirectives('<V />; // plain', 'a.tsx')).toStrictEqual([]);
    expect(findForbiddenDirectives('<V />; // plain', 'a.jsx')).toStrictEqual([]);
  });
  it('the minimum it was given in the missing-waiver message', () => {
    const [v] = findForbiddenDirectives(
      '// eslint-disable-next-line max-params -- WAIVER: abc\nf();',
      'a.ts',
      { minReasonLength: 5 },
    );
    expect(v?.message).toBe(
      'waiving a rule needs `-- WAIVER: <reason of at least 5 letters or digits>`',
    );
  });
  it('a waiver for every rule: no rule may be disabled without one', () => {
    const source = '// eslint-disable-next-line no-console -- debugging\nf();';
    expect(findForbiddenDirectives(source, 'a.ts').map((v) => v.reason)).toStrictEqual([
      'missing-waiver',
    ]);
  });
  it('a waiver whose WAIVER: label is not at the start of the description', () => {
    const source = `// eslint-disable-next-line max-params -- see WAIVER: ${TWENTY}\nf();`;
    expect(findForbiddenDirectives(source, 'a.ts').map((v) => v.reason)).toStrictEqual([
      'missing-waiver',
    ]);
  });
  it('a description without a WAIVER: label as no reason at all, whatever the minimum', () => {
    const source = '// eslint-disable-next-line max-params -- a long enough description\nf();';
    const found = findForbiddenDirectives(source, 'a.ts', { minReasonLength: 5 });
    expect(found.map((v) => v.reason)).toStrictEqual(['missing-waiver']);
  });
});

describe('findForbiddenDirectives accepts', () => {
  it('a waiver of exactly the minimum length', () => {
    expect(
      findForbiddenDirectives(
        `// eslint-disable-next-line max-params -- WAIVER: ${TWENTY}\nf();`,
        'a.ts',
      ),
    ).toStrictEqual([]);
  });
  it('a waiver with no space after the label', () => {
    expect(
      findForbiddenDirectives(
        `// eslint-disable-next-line max-params -- WAIVER:${TWENTY}\nf();`,
        'a.ts',
      ),
    ).toStrictEqual([]);
  });
});
