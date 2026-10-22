// Usage: node scripts/clean.mjs <dir>...
// Removes each directory, if present, before a build, so a renamed or deleted source file never
// leaves a stale module in dist/. Plain JavaScript on purpose: `prepare` runs it on every git
// install, and Node 22.13 to 22.17 (inside `engines`) cannot run a .ts file.
import { rmSync } from 'node:fs';

for (const dir of process.argv.slice(2)) rmSync(dir, { recursive: true, force: true });
