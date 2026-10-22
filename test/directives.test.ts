import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
import { findForbiddenDirectives, type Reason } from '../src/directives-check.ts';
import { BIN_TIMEOUT, fixture, runCli, runMain } from './cli-harness.ts';

const WAIVER = '-- WAIVER: Workers fetch(request, env, ctx, extra) is fixed by the platform';

// Each forbidden comment, under the one reason it is reported for (directive-violations.test.ts
// pins each reason's full violation; check-directives-cli.test.ts pins the CLI's output).
const FORBIDDEN: Partial<Readonly<Record<Reason, Readonly<Record<string, string>>>>> = {
  config: {
    'a: waiver-format switched off with a named rule':
      '/* eslint metz/waiver-format: "off", metz/max-params: "off" */\nf();',
    'a: waiver-format reconfigured with an empty option':
      '/* eslint metz/waiver-format: ["error", { "guardedPrefixes": [] }] */\nf();',
    'b: brace form': '/* eslint {"metz/max-params": "off"} */\nf();',
    'b: brace form with single quotes': "/* eslint { 'max-lines': 'off' } */\nf();",
    'c: unbalanced bracket inside a string':
      '/* eslint no-restricted-syntax: ["error", {"selector":"WithStatement","message":"no with (ever"}], metz/max-params: "off" */\nf();',
    'c: escaped quote inside a string':
      '/* eslint no-console: ["error", { "message": "say \\"hi" }], max-params: "off" */\nf();',
    'allow-list: eslint config comment of another rule': '/* eslint no-console: "off" */\nf();',
    'commaless config': '/* eslint no-console: 0 metz/max-params: 0 */\nf();',
    'commaless config with array value': '/* eslint no-console: [0] metz/max-params: 0 */\nf();',
    'unicode-escaped rule names': '/* eslint "metz\\u002fmax-params": 0, "max-lines": 0 */\nf();',
    'backtick pseudo-string':
      '/* eslint no-restricted-globals: ["error", `x], metz/max-params: 0, id-denylist: ["error", `y] */\nf();',
    'apostrophe pseudo-string':
      '/* eslint no-restricted-globals: ["error", it\'s], metz/max-params: 0, no-console: ["error", it\'s] */\nf();',
    'unmatched paren':
      '/* eslint no-restricted-globals: ["error", a(b], metz/max-params: 0 */\nf();',
    'comment inside JSX': '<V>{/* eslint metz/max-params: "off" */}</V>;',
  },
  enable: {
    'allow-list: eslint-enable of another rule': '/* eslint-enable no-console */\nf();',
    'rule 1: eslint-enable of a named rule': '/* eslint-enable max-params */\nf();',
  },
  'block-disable': {
    'a: block disable of waiver-format and a named rule':
      '/* eslint-disable metz/waiver-format, metz/max-params */\nf();',
    'allow-list: block eslint-disable of another rule': '/* eslint-disable no-console */\nf();',
    'engine purity: block disable of boundaries/no-unknown': `/* eslint-disable boundaries/no-unknown ${WAIVER} */\nf();`,
    'quoted names in block disable':
      '/* eslint-disable "metz/waiver-format", "metz/max-params" */\nf();',
    'blanket block disable': '/* eslint-disable */\nf();',
    'blanket disable inside JSX': '<V>{/* eslint-disable */}</V>;',
    'rule 3: block eslint-disable of a named rule': `/* eslint-disable max-lines ${WAIVER} */\nf();`,
  },
  'line-disable': {
    'a: same-line disable of a named rule and waiver-format':
      'f(); // eslint-disable-line metz/max-params, metz/waiver-format',
    'allow-list: eslint-disable-line of another rule': 'f(); // eslint-disable-line no-console',
    'quoted names in eslint-disable-line':
      'f(); // eslint-disable-line "metz/max-params", "metz/waiver-format"',
    'blanket eslint-disable-line': 'f(); // eslint-disable-line',
    'rule 3: block eslint-disable-line of a named rule': `f(); /* eslint-disable-line complexity ${WAIVER} */`,
  },
  blanket: { 'rule-less eslint-disable-next-line': '// eslint-disable-next-line\nf();' },
  'self-disable': {
    'a: next-line disable of waiver-format (even with a reason)': `// eslint-disable-next-line metz/waiver-format ${WAIVER}\nf();`,
    'quoted name in next-line disable of waiver-format': `// eslint-disable-next-line "metz/waiver-format" ${WAIVER}\nf();`,
  },
  'missing-description': {
    'allow-list: next-line disable without a description':
      '// eslint-disable-next-line no-console\nf();',
    // ESLint reads a next-line label in a line comment as a directive, whatever follows it.
    'prose after a next-line label': '// eslint-disable-next-line is how waivers are written\nf();',
    'engine purity: next-line no-restricted-properties without a waiver':
      '// eslint-disable-next-line no-restricted-properties\nf();',
    'dynamic code: next-line no-new-func without a waiver':
      '// eslint-disable-next-line no-new-func\nf();',
  },
  'missing-waiver': {
    'allow-list: next-line disable of a named rule with a short waiver':
      '// eslint-disable-next-line max-params -- WAIVER: too short\nf();',
    'allow-list: next-line disable of a named rule with no waiver':
      '// eslint-disable-next-line max-params -- because\nf();',
    'engine purity: next-line no-restricted-syntax without a waiver':
      '// eslint-disable-next-line no-restricted-syntax -- needs a clock\nf();',
    'engine purity: next-line @typescript-eslint/no-restricted-imports with a short waiver':
      '// eslint-disable-next-line @typescript-eslint/no-restricted-imports -- WAIVER: short\nf();',
    'engine layering: next-line boundaries/dependencies without a waiver':
      '// eslint-disable-next-line boundaries/dependencies -- shortcut\nf();',
    'engine immutability: next-line functional/immutable-data without a waiver':
      '// eslint-disable-next-line functional/immutable-data -- faster\nf();',
    'dynamic code: next-line no-eval without a waiver':
      '// eslint-disable-next-line no-eval -- legacy\nf();',
    'dynamic code: next-line no-implied-eval with a short waiver':
      '// eslint-disable-next-line no-implied-eval -- WAIVER: short\nf();',
    'dynamic code: next-line @typescript-eslint/no-implied-eval without a waiver':
      '// eslint-disable-next-line @typescript-eslint/no-implied-eval -- legacy\nf();',
    'every rule: next-line disable of no-console with a description':
      '// eslint-disable-next-line no-console -- debugging aid\nf();',
    // At least 20 letters or digits: spaces, punctuation, zero-width characters and comment
    // decoration do not count.
    'padding: 19 letters spread out by spaces':
      '// eslint-disable-next-line max-params -- WAIVER: a b c d e f g h i j k l m n o p q r s\nf();',
    'padding: a run of punctuation':
      '// eslint-disable-next-line max-params -- WAIVER: ............................ ok\nf();',
    'padding: zero-width characters':
      '// eslint-disable-next-line max-params -- WAIVER: short\u200b\u200b\u200b\u200b\u200b\u200b\u200b\u200b\u200b\u200b\u200b\u200b\u200b\u200b\u200b\nf();',
    'padding: comment decoration':
      '/* eslint-disable-next-line max-params -- WAIVER: short * * * * * * * * * * */\nf();',
    'padding: 19 letters and digits, one short':
      '// eslint-disable-next-line max-params -- WAIVER: abcdefghij 012345678\nf();',
  },
  unparseable: {
    'unparseable directive-like block comment': '/* eslint-disable-nextline max-params */\nf();',
  },
};

const CLEAN: Record<string, string> = {
  'next-line waiver of a named rule': `// eslint-disable-next-line max-params ${WAIVER}\nf();`,
  'next-line waiver of an engine purity rule': `// eslint-disable-next-line no-restricted-syntax ${WAIVER}\nf();`,
  'next-line waiver of no-eval': `// eslint-disable-next-line no-eval ${WAIVER}\nf();`,
  'next-line waiver of a layering rule': `// eslint-disable-next-line boundaries/dependencies ${WAIVER}\nf();`,
  'next-line waiver of exactly 20 letters and digits':
    '// eslint-disable-next-line max-params -- WAIVER: abcdefghij 0123456789\nf();',
  // In a line comment ESLint reads only `eslint-disable-line` and `eslint-disable-next-line` as
  // directives, so prose that starts with `eslint` is not one.
  'prose line comment about the eslint config': '// eslint config lives at the repo root\nf();',
  'prose line comment naming a plugin': '// eslint-plugin-react-hooks needs the flat config\nf();',
  'line comment with an enable label': '// eslint-enable max-params\nf();',
  'line comment with a block-disable label': '// eslint-disable max-params\nf();',
  'line comment with an unknown eslint label': '// eslint-disable-nextline max-params\nf();',
  'global / globals / exported / eslint-env comments':
    '/* global foo */\n/* globals bar: true */\n/* exported baz */\n/* eslint-env node */\nf();',
  'a rule name only inside a string': 'const s = "/* eslint metz/max-params: off */";',
  'a rule name only inside a template literal':
    'const s = `// eslint-disable-line metz/waiver-format`;',
  'comment whose first word is an Object.prototype name': '// toString is not a directive',
  'plain comment': '// we never write eslint metz/max-params: off here',
  // Stryker comments are not ESLint directives: tooling's half of check-directives checks them.
  'a Stryker comment': '// Stryker disable next-line StringLiteral: equivalent\nf();',
};

const REPORTED = Object.entries(FORBIDDEN).flatMap(([reason, cases]) =>
  Object.entries(cases).map(([name, source]) => [name, source, reason] as const),
);
const lint = (source: string, filename = 'a.tsx') => findForbiddenDirectives(source, filename);

describe('findForbiddenDirectives', () => {
  it('has a case for 51 comments and every ESLint directive reason (parse-error has its own test)', () => {
    expect([REPORTED.length, Object.keys(FORBIDDEN).length]).toStrictEqual([51, 9]);
  });
  it.each(REPORTED)('reports %s', (_, source, reason) => {
    expect(lint(source).map((v) => v.reason)).toStrictEqual([reason]);
  });
  it.each(Object.entries(CLEAN))('allows %s', (_, source) => {
    expect(lint(source)).toStrictEqual([]);
  });
  it('reports the position and the directive', () => {
    expect(lint('\n  /* eslint max-params: "off" */')).toStrictEqual([
      {
        line: 2,
        column: 3,
        reason: 'config',
        rules: ['max-params'],
        message: 'inline `eslint` config comments are forbidden',
      },
    ]);
  });
});

// The one child-process run: the bin passes the real argv and console to main().
describe('check-directives bin', () => {
  it('prints and exits exactly as main() does', { timeout: BIN_TIMEOUT }, (ctx) => {
    const dir = fixture(ctx, { 'bad.ts': '/* eslint-enable no-console */', 'ok.ts': 'f();' });
    const bad = `${join(dir, 'bad.ts')}:1:1 \`eslint-enable\` is forbidden\n1 forbidden directive(s)\n`;
    const usage = {
      code: 2,
      out: '',
      err: 'Usage: metz-check-directives [--min-reason-length <n>] [--marker <text>] [--guarded-prefix <prefix>]... [--waiver-rule <rule>] <path>...\n',
    };
    expect([runCli(dir), runCli()]).toStrictEqual([{ code: 1, out: bad, err: '' }, usage]);
    expect([runMain(dir), runMain()]).toStrictEqual([{ code: 1, out: bad, err: '' }, usage]);
  });
});
