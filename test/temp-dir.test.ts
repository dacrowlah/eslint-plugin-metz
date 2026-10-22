import { chmodSync, existsSync, mkdirSync, rmSync, writeFileSync } from 'node:fs';
import { basename, join } from 'node:path';
import { describe, expect, it } from 'vitest';
import { tempDir } from './temp-dir.ts';
import { thrownBy } from './thrown.ts';

// Self-test of metz's own temp-dir helper: a dir belongs to the test whose context made it.
type Finished = () => void;
const fakeContext = (finished: Finished[]) => ({
  onTestFinished: (fn: Finished) => {
    finished.push(fn);
  },
});
const runAll = (finished: readonly Finished[]): void => {
  finished.forEach((fn) => {
    fn();
  });
};

/** A read-only subdir holding a file: the dir cannot be removed until it is unlocked. */
const locked = (dir: string): string => {
  mkdirSync(join(dir, 'sub'));
  writeFileSync(join(dir, 'sub/f.txt'), 'x');
  chmodSync(join(dir, 'sub'), 0o500);
  return dir;
};

describe('tempDir(context, prefix)', () => {
  it('makes an empty dir named by the prefix, and removes it, contents and all, when the test finishes', () => {
    const finished: Finished[] = [];
    const dir = tempDir(fakeContext(finished), 'metz-temp-');
    writeFileSync(join(dir, 'f.txt'), 'x');
    expect([basename(dir).replace(/\w{6}$/, ''), existsSync(dir), finished.length]).toStrictEqual([
      'metz-temp-',
      true,
      1,
    ]);
    runAll(finished);
    expect(existsSync(dir)).toBe(false);
  });
  it('is quiet when the test removed the dir itself', () => {
    const finished: Finished[] = [];
    rmSync(tempDir(fakeContext(finished), 'metz-temp-gone-'), { recursive: true });
    // Paired with the Stryker mutant it kills: `force: false` throws ENOENT here.
    expect(() => {
      runAll(finished);
    }).not.toThrow();
  });
  it('fails the test, naming the dir, when it cannot remove it', () => {
    const finished: Finished[] = [];
    const dir = locked(tempDir(fakeContext(finished), 'metz-temp-locked-'));
    const failure = thrownBy(() => {
      runAll(finished);
    });
    // The errno code and wording vary by platform: the failure is what rmSync throws for the dir.
    expect(failure).toStrictEqual(
      thrownBy(() => {
        rmSync(dir, { recursive: true, force: true });
      }),
    );
    chmodSync(join(dir, 'sub'), 0o700);
    runAll(finished);
    expect(existsSync(dir)).toBe(false);
  });
});

describe('tempDir with a real test context', () => {
  // The check is registered before the dir is made: Vitest runs a test's onTestFinished hooks
  // last in, first out, so it runs after tempDir's removal, and a failure there fails the test.
  it('belongs to the test that made it, and is gone once that test finishes', (ctx) => {
    let made = '';
    ctx.onTestFinished(() => {
      const prefix = 'metz-temp-real-';
      expect([basename(made).slice(0, prefix.length), existsSync(made)]).toStrictEqual([
        prefix,
        false,
      ]);
    });
    made = tempDir(ctx, 'metz-temp-real-');
    expect(existsSync(made)).toBe(true);
  });
});
