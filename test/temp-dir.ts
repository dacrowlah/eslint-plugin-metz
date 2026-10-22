import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

// A temp dir for one test. A dir belongs to the
// test whose context made it: removed, contents and all, when that test finishes, and a removal
// error fails that test. Taking the context works in concurrent tests too.
export type Finishing = { onTestFinished: (fn: () => void) => void };

export const tempDir = (context: Finishing, prefix: string): string => {
  const dir = mkdtempSync(join(tmpdir(), prefix));
  context.onTestFinished(() => {
    rmSync(dir, { recursive: true, force: true });
  });
  return dir;
};
