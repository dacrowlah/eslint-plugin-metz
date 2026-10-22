import { spawnSync, type SpawnSyncReturns } from 'node:child_process';
import { mkdirSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { main } from '../src/cli/main.ts';
import { type Finishing, tempDir } from './temp-dir.ts';

const CLI = join(import.meta.dirname, '../src/cli/check-directives.ts');

/** A killed child carries its signal; a normal exit has none. */
type Result = { code: number; out: string; err: string; signal?: NodeJS.Signals };

/** Two runs of the bin in child processes take about 0.7 to 0.8 s idle and 5.2 to 5.5 s under
 * heavy load, past the 5 s default: about 50 times idle, sized to the work. A Stryker run costs the
 * same: the bin runs in a child, where no mutant is active. A test that runs the bin takes it;
 * every other test keeps the default. */
export const BIN_TIMEOUT = 40_000;

/** What a child process gives back: its exit code and streams, and its signal when it was killed. A
 * child that could not run (or wrote past the buffer) throws its error. */
export const outcomeOf = (r: SpawnSyncReturns<string>): Result => {
  if (r.error) throw r.error;
  const signal = r.signal ? { signal: r.signal } : {};
  return { code: r.status ?? -1, out: r.stdout, err: r.stderr, ...signal };
};

/** The bin in a child process: what a user sees, every stream. Slow; for the smoke test. */
export const runCli = (...args: string[]): Result =>
  outcomeOf(spawnSync(process.execPath, [CLI, ...args], { encoding: 'utf8' }));

const text = (lines: readonly string[]): string => lines.map((line) => `${line}\n`).join('');

/** The CLI's main() in this process, its output shaped like runCli's (one `\n` per line). */
export const runMain = (...args: string[]): Result => {
  const out: string[] = [];
  const err: string[] = [];
  const code = main(args, { out: (line) => out.push(line), err: (line) => err.push(line) });
  return { code, out: text(out), err: text(err) };
};

/** A temp dir holding `files` (path to source), removed when the test of `context` finishes. */
export const fixture = (context: Finishing, files: Record<string, string>): string => {
  const dir = tempDir(context, 'metz-directives-');
  for (const [name, source] of Object.entries(files)) {
    mkdirSync(dirname(join(dir, name)), { recursive: true });
    writeFileSync(join(dir, name), source);
  }
  return dir;
};
