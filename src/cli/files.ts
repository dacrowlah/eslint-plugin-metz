// The files metz-check-directives reads under a path: every file of a directory tree, skipping
// dependencies, git, StrykerJS sandboxes and build output, and refusing a symlink loop.
import { existsSync, readdirSync, realpathSync, statSync } from 'node:fs';
import { extname, join } from 'node:path';

const EXTENSIONS = new Set(['.ts', '.tsx', '.mts', '.cts', '.js', '.jsx', '.mjs', '.cjs']);
const isCode = (file: string): boolean => EXTENSIONS.has(extname(file));

const ANYWHERE = new Set(['node_modules', '.git', '.stryker-tmp']);
const BESIDE_PACKAGE_JSON = new Set(['dist', 'coverage', '.turbo', '.expo', '.wrangler']);

/**
 * node_modules, .git and .stryker-tmp (StrykerJS sandboxes) at any depth; build dirs only as direct
 * children of a package or repo root.
 */
function isSkipped(parent: string, entry: string): boolean {
  if (ANYWHERE.has(entry)) return true;
  return BESIDE_PACKAGE_JSON.has(entry) && existsSync(join(parent, 'package.json'));
}

/** The files under a directory, the last of `ancestors` by its real path. */
function filesIn(dir: string, ancestors: readonly string[]): string[] {
  const entries = readdirSync(dir).filter((entry) => !isSkipped(dir, entry));
  return entries.flatMap((entry) => within(join(dir, entry), ancestors));
}

/** A path inside the walk: a file (or a dangling link, which main() reports), or a directory
 * that must not be one of those it is inside. */
function within(path: string, ancestors: readonly string[]): string[] {
  if (statSync(path, { throwIfNoEntry: false })?.isDirectory() !== true) return [path];
  const real = realpathSync(path);
  if (ancestors.includes(real)) throw new Error(`symlink loop at ${path}`);
  return filesIn(path, [...ancestors, real]);
}

/** A file named on the command line is checked, so it must be code: a gate never passes a file
 * it skipped. */
function namedFile(path: string): string[] {
  if (isCode(path)) return [path];
  throw new Error(`not a JavaScript or TypeScript file: ${path}`);
}

/** The code file itself, or every code file under a directory; the walk starts from the root's
 * real path, so a link back to the root is a loop at the link. */
export function filesUnder(path: string): string[] {
  if (!statSync(path).isDirectory()) return namedFile(path);
  return filesIn(path, [realpathSync(path)]).filter(isCode);
}
