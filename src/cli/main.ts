// The metz-check-directives CLI as a function, so its logic runs in the test process (and under
// Stryker). `check-directives.ts` is the thin bin that calls it with the real argv and console.
// Exit status: 0 clean, 1 forbidden directives found, 2 usage error or unreadable path.
import { existsSync, readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { type CheckPolicy, findForbiddenDirectives } from '../directives-check.ts';
import { filesUnder } from './files.ts';
import { requestOf, UsageError } from './request.ts';

export { USAGE } from './request.ts';

/** Where the CLI writes: one call per line, without the newline. */
export type Io = { readonly out: (line: string) => void; readonly err: (line: string) => void };

const PROGRAM = 'metz-check-directives';

type Finding = { readonly line: number; readonly column: number; readonly message: string };

/** A code file's forbidden directives. A dangling link named like code is one finding: the gate
 * cannot read it, so it never passes it. */
function findingsIn(file: string, policy: CheckPolicy): readonly Finding[] {
  if (!existsSync(file)) return [{ line: 1, column: 1, message: DANGLING }];
  return findForbiddenDirectives(readFileSync(file, 'utf8'), file, policy);
}
const DANGLING = 'dangling symbolic link: its target is missing, so it cannot be checked';

function report(file: string, policy: CheckPolicy, io: Io): number {
  const findings = findingsIn(file, policy);
  for (const f of findings) io.out(`${file}:${String(f.line)}:${String(f.column)} ${f.message}`);
  return findings.length;
}

/** Each file once, under the first path it was reached by, when roots overlap (`src src/a.ts`). */
function unique(files: readonly string[]): string[] {
  const seen = new Set<string>();
  return files.filter((file) => !seen.has(resolve(file)) && Boolean(seen.add(resolve(file))));
}

function check(argv: readonly string[], io: Io): number {
  const { paths, policy } = requestOf(argv);
  const files = unique(paths.flatMap((p) => filesUnder(p)));
  const total = files.reduce((n, f) => n + report(f, policy, io), 0);
  if (total > 0) io.out(`${String(total)} forbidden directive(s)`);
  return total > 0 ? 1 : 0;
}

/** A usage error prints its lines; any other error (a missing path, a symlink loop) its message. */
function failure(e: unknown, io: Io): number {
  const lines = e instanceof UsageError ? e.lines : [`${PROGRAM}: ${(e as Error).message}`];
  for (const line of lines) io.err(line);
  return 2;
}

/** Checks every code file under the paths in `argv` (files or directories), reading the waiver
 * policy from its flags, and returns the exit status. */
export function main(argv: readonly string[], io: Io): number {
  try {
    return check(argv, io);
  } catch (e) {
    return failure(e, io);
  }
}
