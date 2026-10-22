import { RuleTester } from '@typescript-eslint/rule-tester';
import { describe, expect, it } from 'vitest';
import { findForbiddenDirectives } from '../src/directives-check.ts';
import rule from '../src/rules/waiver-format.ts';
import './setup.ts';

// The waiver policy's options, in the rule (editor feedback) and in the checker (the gate): the
// marker, the guarded rule prefixes, the reason length, prettier-ignore, and the waiver rule's id.
const ruleTester = new RuleTester({ linterOptions: { reportUnusedDisableDirectives: 'off' } });
const OK = '-- OK: the platform fixes this signature';
const METZ_ONLY = { guardedPrefixes: ['metz/', 'boundaries/'] };
// RuleTester knows only core rules beside the one under test, so its directives name core rules.
const MAX_ONLY = { guardedPrefixes: ['max-', 'complexity'] };

ruleTester.run('waiver-format options', rule, {
  valid: [
    { code: `// eslint-disable-next-line max-params ${OK}\nf();`, options: [{ marker: 'OK:' }] },
    {
      code: '// eslint-disable-next-line max-params -- WAIVER: short\nf();',
      options: [{ minReasonLength: 5 }],
    },
    { code: '/* eslint-disable no-console */\nf();', options: [MAX_ONLY] },
    { code: '/* eslint no-console: "off" */\nf();', options: [MAX_ONLY] },
    { code: '// eslint-disable-next-line no-console\nf();', options: [MAX_ONLY] },
    { code: '// prettier-ignore\nf();', options: [{ allowPrettierIgnore: true }] },
  ],
  invalid: [
    {
      code: '// eslint-disable-next-line max-params -- WAIVER: the platform fixes this signature\nf();',
      options: [{ marker: 'OK:' }],
      errors: [
        { messageId: 'missingWaiver', data: { rules: 'max-params', min: 20, marker: 'OK:' } },
      ],
    },
    {
      code: '// eslint-disable-next-line max-params -- WAIVER: four\nf();',
      options: [{ minReasonLength: 5 }],
      errors: [
        { messageId: 'missingWaiver', data: { rules: 'max-params', min: 5, marker: 'WAIVER:' } },
      ],
    },
    {
      code: '/* eslint-disable no-console, max-params, complexity */\nf();',
      options: [MAX_ONLY],
      errors: [
        {
          messageId: 'nextLineOnly',
          data: { rules: 'max-params, complexity', min: 20, marker: 'WAIVER:' },
        },
        {
          messageId: 'missingWaiver',
          data: { rules: 'max-params, complexity', min: 20, marker: 'WAIVER:' },
        },
      ],
    },
    {
      code: '/* eslint-enable max-lines */\nf();',
      options: [MAX_ONLY],
      errors: [
        { messageId: 'inlineConfig', data: { rules: 'max-lines', min: 20, marker: 'WAIVER:' } },
      ],
    },
    {
      code: '// prettier-ignore\nf();',
      options: [{ allowPrettierIgnore: false }],
      errors: [{ messageId: 'prettierIgnore', line: 1, column: 1 }],
    },
  ],
});

const reasons = (source: string, options: object) =>
  findForbiddenDirectives(source, 'a.ts', options).map((v) => [v.reason, v.message]);

describe('findForbiddenDirectives options', () => {
  it('reads the marker', () => {
    expect([
      reasons(`// eslint-disable-next-line max-params ${OK}\nf();`, { marker: 'OK:' }),
      reasons(`// eslint-disable-next-line max-params ${OK}\nf();`, {}),
    ]).toStrictEqual([
      [],
      [
        [
          'missing-waiver',
          'waiving a rule needs `-- WAIVER: <reason of at least 20 letters or digits>`',
        ],
      ],
    ]);
  });
  it('names the marker and the minimum in its message', () => {
    const source = '// eslint-disable-next-line max-params -- OK: four\nf();';
    expect(reasons(source, { marker: 'OK:', minReasonLength: 5 })).toStrictEqual([
      ['missing-waiver', 'waiving a rule needs `-- OK: <reason of at least 5 letters or digits>`'],
    ]);
  });
  it('leaves directives that name only unguarded rules alone', () => {
    const source = [
      '/* eslint no-console: "off" */',
      '/* eslint-enable no-console */',
      '/* eslint-disable no-console */',
      'f(); // eslint-disable-line no-console',
      '// eslint-disable-next-line no-console',
      'f();',
    ].join('\n');
    expect(reasons(source, METZ_ONLY)).toStrictEqual([]);
  });
  it.for([
    ['/* eslint-disable no-console, metz/max-params */', 'block-disable'],
    ['/* eslint-disable */', 'block-disable'],
    ['/* eslint-enable boundaries/x */', 'enable'],
    ['// eslint-disable-next-line metz/max-params -- short\nf();', 'missing-waiver'],
  ])('still reports %s, which names a guarded rule or none at all', ([source, reason]) => {
    expect(reasons(String(source), METZ_ONLY).map(([r]) => r)).toStrictEqual([reason]);
  });
  it('reports a rule-less next-line disable whatever is guarded', () => {
    expect(reasons('// eslint-disable-next-line\nf();', METZ_ONLY).map(([r]) => r)).toStrictEqual([
      'blanket',
    ]);
  });
  // The waiver rule is protected whatever is guarded: each directive form that names it, under
  // prefixes that do not guard it, and under the id it is given.
  const NEXT_LINE_FORM = 'use `// eslint-disable-next-line <rule> -- <reason>`';
  const SELF_CASES = [
    [
      `// eslint-disable-next-line RULE ${OK}\nf();`,
      'self-disable',
      'RULE may not be disabled by a comment',
    ],
    [
      '/* eslint-disable RULE */',
      'block-disable',
      `block \`eslint-disable\` is forbidden; ${NEXT_LINE_FORM}`,
    ],
    [
      'f(); // eslint-disable-line RULE',
      'line-disable',
      `\`eslint-disable-line\` is forbidden; ${NEXT_LINE_FORM}`,
    ],
    ['/* eslint RULE: "off" */', 'config', 'inline `eslint` config comments are forbidden'],
    ['/* eslint {"RULE": "off"} */', 'config', 'inline `eslint` config comments are forbidden'],
    ['/* eslint-enable RULE */', 'enable', '`eslint-enable` is forbidden'],
  ];
  const named = (text: string, rule: string) => text.replaceAll('RULE', rule);
  it.for(SELF_CASES)(
    'protects metz/waiver-format under other prefixes: %s',
    ([form, reason, message]) => {
      const rule = 'metz/waiver-format';
      const expected = [[reason, named(String(message), rule)]];
      expect(
        reasons(named(String(form), rule), { guardedPrefixes: ['boundaries/'] }),
      ).toStrictEqual(expected);
    },
  );
  it.for(SELF_CASES)(
    'protects the waiver rule under the id it is given: %s',
    ([form, reason, message]) => {
      const rule = 'sandi/waiver-format';
      const expected = [[reason, named(String(message), rule)]];
      const policy = { waiverRule: rule, marker: 'OK:', ...METZ_ONLY };
      expect(reasons(named(String(form), rule), policy)).toStrictEqual(expected);
    },
  );
});
