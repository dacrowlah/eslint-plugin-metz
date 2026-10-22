// The file globs the presets use, exported so a project can reuse, extend or replace them. Each
// is the one home of its glob: the presets and the docs read them from here.

/** A value frozen in place: the presets use the very arrays exported here, so no project can
 * change them for everyone. Typed as ESLint's mutable `files` arrays, so `files: TEST_FILES`
 * type-checks in a consumer's config; a write throws at run time. */
export function frozen<T extends object>(value: T): T {
  Object.freeze(value);
  return value;
}

/** Every source extension ESLint's JavaScript and TypeScript parsers read. */
const SOURCE = '{js,jsx,mjs,cjs,ts,tsx,mts,cts}';

/** Test files: `*.test.*` and `*.spec.*`, and anything under a `__tests__` directory. */
export const TEST_FILES = frozen([`**/*.{test,spec}.${SOURCE}`, `**/__tests__/**/*.${SOURCE}`]);

/** Tool configuration files named `<tool>.config.<ext>` (`vite.config.ts`, `eslint.config.js`):
 * data, not design. JSX files (`app.config.tsx`) and dotfiles (`.babelrc.ts`) hold code, so they
 * keep every limit. */
export const CONFIG_FILES = frozen(['**/*.config.{js,cjs,mjs,ts,cts,mts}']);

/** TypeScript declaration files: their shape is dictated by the code they describe. */
export const DECLARATION_FILES = frozen(['**/*.d.{ts,mts,cts}']);

/** Files that can hold components. */
export const JSX_FILES = frozen(['**/*.{jsx,tsx}']);

/** Screen components, named `<Name>Screen`: the screen-view-model rule's default `screenSuffix`.
 * A project that changes `screenSuffix` replaces the `-react/screens` block with its own glob. */
export const SCREEN_FILES = frozen(['**/*Screen.{jsx,tsx}']);
