import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
import { fixture, runMain } from './cli-harness.ts';

// The CLI's flags set the checker's waiver policy; a bad flag or value is a usage error (exit 2).
const USAGE =
  'Usage: metz-check-directives [--min-reason-length <n>] [--marker <text>] [--guarded-prefix <prefix>]... [--waiver-rule <rule>] <path>...\n';
const SHORT = '// eslint-disable-next-line max-params -- OK: four\nf();';

describe('check-directives flags', () => {
  it('pass the marker and the minimum reason length to the checker', (ctx) => {
    const dir = fixture(ctx, { 'a.ts': SHORT });
    expect(runMain('--marker', 'OK:', '--min-reason-length', '4', dir)).toStrictEqual({
      code: 0,
      out: '',
      err: '',
    });
  });
  it.for([
    ['--min-reason-length=5', '5'],
    ['--min-reason-length=12', '12'],
  ])('report a reason shorter than %s', ([flag, n], ctx) => {
    const dir = fixture(ctx, { 'a.ts': SHORT });
    const line = `${join(dir, 'a.ts')}:1:1 waiving a rule needs \`-- OK: <reason of at least ${String(n)} letters or digits>\``;
    expect(runMain('--marker=OK:', String(flag), dir)).toStrictEqual({
      code: 1,
      out: `${line}\n1 forbidden directive(s)\n`,
      err: '',
    });
  });
  it('guard only the rules under each --guarded-prefix', (ctx) => {
    const dir = fixture(ctx, {
      'a.ts': '/* eslint-disable no-console */\n/* eslint-enable x/y */',
    });
    expect(runMain('--guarded-prefix', 'metz/', '--guarded-prefix', 'x/', dir)).toStrictEqual({
      code: 1,
      out: `${join(dir, 'a.ts')}:2:1 \`eslint-enable\` is forbidden\n1 forbidden directive(s)\n`,
      err: '',
    });
  });
  it('protect the waiver rule named by --waiver-rule', (ctx) => {
    const dir = fixture(ctx, {
      'a.ts': '// eslint-disable-next-line sandi/waiver-format -- x\nf();',
    });
    expect(runMain('--waiver-rule', 'sandi/waiver-format', dir)).toStrictEqual({
      code: 1,
      out: `${join(dir, 'a.ts')}:1:1 sandi/waiver-format may not be disabled by a comment\n1 forbidden directive(s)\n`,
      err: '',
    });
  });
});

describe('check-directives flags fail with exit 2', () => {
  it.each([
    ['0', '--min-reason-length must be a positive integer, got "0"'],
    ['4.5', '--min-reason-length must be a positive integer, got "4.5"'],
    ['x', '--min-reason-length must be a positive integer, got "x"'],
    ['07', '--min-reason-length must be a positive integer, got "07"'],
  ])('on --min-reason-length %s', (value, problem) => {
    expect(runMain('--min-reason-length', value, '.')).toStrictEqual({
      code: 2,
      out: '',
      err: `metz-check-directives: ${problem}\n${USAGE}`,
    });
  });
  it.each(['--marker', '--waiver-rule'])('on an empty %s', (flag) => {
    expect(runMain(flag, '', '.')).toStrictEqual({
      code: 2,
      out: '',
      err: `metz-check-directives: ${flag} must not be empty\n${USAGE}`,
    });
  });
  it('on an unknown flag', () => {
    expect(runMain('--markr', 'OK:', '.')).toStrictEqual({
      code: 2,
      out: '',
      err: `metz-check-directives: Unknown option '--markr'. To specify a positional argument starting with a '-', place it at the end of the command after '--', as in '-- "--markr"\n${USAGE}`,
    });
  });
  it('on a flag without its value', () => {
    expect(runMain('.', '--marker')).toStrictEqual({
      code: 2,
      out: '',
      err: `metz-check-directives: Option '--marker <value>' argument missing\n${USAGE}`,
    });
  });
  it('when given flags but no paths', () => {
    expect(runMain('--marker', 'OK:')).toStrictEqual({ code: 2, out: '', err: USAGE });
  });
});
