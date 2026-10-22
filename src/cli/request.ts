// What metz-check-directives is asked to do: the paths to check, and the waiver policy its flags
// set. A bad flag, a bad value or no path at all is a usage error.
import { parseArgs } from 'node:util';
import type { CheckPolicy } from '../directives-check.ts';

export const USAGE =
  'Usage: metz-check-directives [--min-reason-length <n>] [--marker <text>] [--guarded-prefix <prefix>]... [--waiver-rule <rule>] <path>...';

/** A usage error, with the lines to print: the problem (if any), then the usage. */
export class UsageError extends Error {
  readonly lines: readonly string[];
  constructor(problem: string | null) {
    super(problem ?? USAGE);
    this.lines = problem === null ? [USAGE] : [`metz-check-directives: ${problem}`, USAGE];
  }
}

type Request = { readonly paths: readonly string[]; readonly policy: CheckPolicy };

const FLAGS = {
  'min-reason-length': { type: 'string' },
  marker: { type: 'string' },
  'guarded-prefix': { type: 'string', multiple: true },
  'waiver-rule': { type: 'string' },
} as const;
type Values = ReturnType<typeof argsOf>['values'];

const POSITIVE_INTEGER = /^[1-9]\d*$/;

function argsOf(argv: readonly string[]) {
  try {
    return parseArgs({ args: [...argv], options: FLAGS, allowPositionals: true });
  } catch (e) {
    throw new UsageError((e as Error).message);
  }
}

function lengthOf(text: string | undefined): number | undefined {
  if (text === undefined) return undefined;
  if (POSITIVE_INTEGER.test(text)) return Number(text);
  throw new UsageError(`--min-reason-length must be a positive integer, got "${text}"`);
}

/** A flag's value, which must not be empty when the flag is given. */
function nonEmpty(flag: string, value: string | undefined): string | undefined {
  if (value !== '') return value;
  throw new UsageError(`${flag} must not be empty`);
}

const policyOf = (values: Values): CheckPolicy => ({
  minReasonLength: lengthOf(values['min-reason-length']),
  marker: nonEmpty('--marker', values.marker),
  guardedPrefixes: values['guarded-prefix'],
  waiverRule: nonEmpty('--waiver-rule', values['waiver-rule']),
});

/** The paths and policy `argv` asks for; a UsageError when it asks for nothing valid. */
export function requestOf(argv: readonly string[]): Request {
  const { values, positionals } = argsOf(argv);
  const policy = policyOf(values);
  if (positionals.length === 0) throw new UsageError(null);
  return { paths: positionals, policy };
}
