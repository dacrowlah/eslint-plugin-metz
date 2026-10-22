import rule from '../src/rules/waiver-format.ts';
import { RuleTester } from '@typescript-eslint/rule-tester';
import './setup.ts';

// Directives name core rules here because the tester only knows the rule under test.
const ruleTester = new RuleTester({ linterOptions: { reportUnusedDisableDirectives: 'off' } });

ruleTester.run('waiver-format', rule, {
  valid: [
    '// eslint-disable-next-line max-params -- WAIVER: Workers fetch(request, env, ctx, extra) is fixed by the platform\nf();',
    '// eslint-disable-next-line no-console -- WAIVER: the CLI prints its report here\nf();',
    '// eslint-disable-next-line max-params -- WAIVER: abcdefghij 0123456789\nf();', // exactly the minimum
    '// keep prettier-ignore out of this file\nf();', // only a comment that starts with it
    // In a line comment ESLint reads only the next-line and same-line disables as directives.
    '// eslint config lives at the repo root\nf();',
    '// eslint-enable max-params\nf();',
    '// eslint-disable max-params\nf();',
  ],
  invalid: [
    { code: '/* eslint no-console: "off" */\nf();', errors: [{ messageId: 'inlineConfig' }] },
    { code: '/* eslint-enable no-console */\nf();', errors: [{ messageId: 'inlineConfig' }] },
    {
      code: '// eslint-disable-next-line no-console -- debugging aid\nf();',
      errors: [
        { messageId: 'missingWaiver', data: { rules: 'no-console', min: 20, marker: 'WAIVER:' } },
      ],
    },
    {
      // 19 letters and digits, padded with spaces, punctuation and a zero-width space
      code: '// eslint-disable-next-line max-params -- WAIVER: abcdefghij \u200b.... 012345678\nf();',
      errors: [{ messageId: 'missingWaiver' }],
    },
    { code: '// prettier-ignore-start\nf();', errors: [{ messageId: 'prettierIgnore' }] },
    { code: '// prettier-ignore-end\nf();', errors: [{ messageId: 'prettierIgnore' }] },
    {
      code: '// prettier-ignore -- WAIVER: aligned lookup table reads better as columns\nf();',
      errors: [{ messageId: 'prettierIgnore' }],
    },
    { code: '/* eslint max-params: "off" */\nf();', errors: [{ messageId: 'inlineConfig' }] },
    {
      code: '/* eslint max-params: ["error", { "max": 99 }] */\nf();',
      errors: [{ messageId: 'inlineConfig' }],
    },
    { code: '/* eslint max-lines: "off" */\nf();', errors: [{ messageId: 'inlineConfig' }] },
    {
      code: '/* eslint no-console: 0, complexity: 0 */\nf();',
      errors: [{ messageId: 'inlineConfig' }],
    },
    { code: '/* eslint-enable max-params */\nf();', errors: [{ messageId: 'inlineConfig' }] },
    { code: '// prettier-ignore\nf();', errors: [{ messageId: 'prettierIgnore' }] },
    { code: '//prettier-ignore\nf();', errors: [{ messageId: 'prettierIgnore' }] },
    {
      code: '/* eslint max-lines: 0, complexity: 0 */\nf();',
      errors: [
        {
          messageId: 'inlineConfig',
          data: { rules: 'max-lines, complexity', min: 20, marker: 'WAIVER:' },
        },
      ],
    },
    {
      code: '// prettier-ignore -- WAIVER: short\nf();',
      errors: [{ messageId: 'prettierIgnore' }],
    },
    {
      code: 'const x = <V>{/* prettier-ignore */}</V>;',
      filename: 'file.tsx',
      errors: [{ messageId: 'prettierIgnore' }],
    },
    {
      code: '// eslint-disable-next-line max-params\nf();',
      errors: [{ messageId: 'missingWaiver' }],
    },
    {
      code: '// eslint-disable-next-line max-lines -- WAIVER: too long\nf();',
      errors: [{ messageId: 'missingWaiver' }],
    },
    {
      code: '/* eslint-disable max-lines -- WAIVER: generated racer table from the rulebook */\nf();',
      errors: [{ messageId: 'nextLineOnly' }],
    },
    {
      code: 'f(); // eslint-disable-line complexity',
      errors: [{ messageId: 'nextLineOnly' }, { messageId: 'missingWaiver' }],
    },
  ],
});
