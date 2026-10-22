import { spawnSync } from 'node:child_process';
import { mkdirSync, readdirSync, readFileSync, realpathSync, writeFileSync } from 'node:fs';
import { basename, dirname, join, relative } from 'node:path';
import { afterAll } from 'vitest';
import { outcomeOf } from '../test/cli-harness.ts';
import { FILES, PEERS } from './project.ts';

// A throwaway consumer project that installs eslint-plugin-metz the way a user does (from the
// packed tarball, or from a git tag) and lints fixtures with the installed copy alone: nothing in
// it reaches this repository's source.

/** A test that runs the consumer's eslint, tsc, node or the bin in a child process: one to six
 * seconds idle, past Vitest's 5 s default under heavy load (load average 36 seen). Every other
 * test keeps the default. */
export const RUN_TIMEOUT = 120_000;

/** This repository, which the smoke tests pack or copy. */
export const REPO = join(import.meta.dirname, '..');
/** A temp dir's owner for a whole test file: `tempDir(finishing, …)` is removed after its tests. */
export const finishing = { onTestFinished: afterAll };

/** pnpm at the version the repository's `packageManager` pins: the pnpm running this script
 * (`pnpm test:smoke`, which honours `packageManager`), or else corepack running that version. */
export function pnpmCommand(
  execpath: string | undefined,
  packageManager: string,
): [string, ...string[]] {
  const isPnpm = execpath !== undefined && basename(execpath).startsWith('pnpm');
  return isPnpm ? [execpath] : ['corepack', packageManager];
}

const MANIFEST = JSON.parse(readFileSync(join(REPO, 'package.json'), 'utf8')) as {
  packageManager: string;
};
export const PNPM = pnpmCommand(process.env['npm_execpath'], MANIFEST.packageManager);

/** What the installed package holds: the build, the files npm always ships, and the changelog. */
export const SHIPPED = [
  'CHANGELOG.md',
  'LICENSE',
  'README.md',
  'dist',
  'node_modules',
  'package.json',
];

/** Writes `files` (path to text) under `dir`. */
export function write(dir: string, files: Readonly<Record<string, string>>): void {
  for (const [name, text] of Object.entries(files)) {
    mkdirSync(dirname(join(dir, name)), { recursive: true });
    writeFileSync(join(dir, name), text);
  }
}

/** A consumer in `dir` depending on `spec` for the plugin, with its own pnpm settings. */
export function consumer(dir: string, spec: string, workspaceYaml = ''): void {
  const devDependencies = { 'eslint-plugin-metz': spec, ...PEERS };
  const manifest = { name: 'consumer', private: true, type: 'module', devDependencies };
  const own = { 'package.json': JSON.stringify(manifest), 'pnpm-workspace.yaml': workspaceYaml };
  write(dir, { ...own, ...FILES });
}

/** Runs `command` in `cwd` and returns its outcome; a command that cannot start throws. */
export const run = (cwd: string, command: string, ...args: string[]) =>
  outcomeOf(spawnSync(command, args, { cwd, encoding: 'utf8', maxBuffer: 64 * 1024 * 1024 }));

/** Runs `command`, and throws with its output unless it exits 0. */
export function succeed(cwd: string, command: string, ...args: string[]): string {
  const r = run(cwd, command, ...args);
  if (r.code !== 0)
    throw new Error(`${command} ${args.join(' ')} failed in ${cwd}:\n${r.out}${r.err}`);
  return r.out;
}

/** `pnpm install` in `cwd`, preferring the local store. */
export const install = (cwd: string): string =>
  succeed(cwd, ...PNPM, 'install', '--prefer-offline', '--config.confirmModulesPurge=false');

/** The files the consumer's installed copy of the plugin holds, sorted. */
export const installed = (cwd: string): string[] =>
  readdirSync(join(cwd, 'node_modules/eslint-plugin-metz')).sort();

/** Lines wrapped at the terminal width, up to the one ending in `: true`, joined back. */
function unwrapped(lines: readonly string[]): string {
  const end = lines.findIndex((line) => line.endsWith(': true'));
  return lines
    .slice(0, end + 1)
    .map((line) => line.trim())
    .join('');
}

/** pnpm's refusal of a git dependency's build: its error code, and the `allowBuilds` example
 * entry it prints. */
export function refusalOf(output: string): { error: string; key: string } {
  const [, after = ''] = output.split('Error: ');
  const example = (after.split('allowBuilds:\n')[1] ?? '').split('\n');
  return { error: after.split('\n')[0] ?? '', key: unwrapped(example) };
}

type EslintResult = {
  filePath: string;
  messages: { ruleId: string | null; severity: number; message: string }[];
};

const rows = (root: string, { filePath, messages }: EslintResult): string[][] =>
  messages.map((m) => [relative(root, filePath), String(m.ruleId), String(m.severity), m.message]);

/** Every finding of the consumer's own eslint, as `[file, rule, severity, message]`, sorted. */
export function findings(cwd: string): string[][] {
  const r = run(cwd, join(cwd, 'node_modules/.bin/eslint'), '--format', 'json', '.');
  const results = JSON.parse(r.out) as EslintResult[];
  const all = results.flatMap((f) => rows(realpathSync(cwd), f));
  return all.sort((a, b) => a.join(' ').localeCompare(b.join(' ')));
}
