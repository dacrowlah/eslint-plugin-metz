// Naming conventions the rules read: components are PascalCase, hooks are `use…`, and a module is
// named for its file.
const PASCAL = /^[A-Z][A-Za-z0-9]*$/;
const HOOK = /^use($|[A-Z0-9])/; // includes React 19's bare `use(...)`

export const isPascal = (name: string | null): boolean => name !== null && PASCAL.test(name);
export const isHookName = (name: string | null): boolean => name !== null && HOOK.test(name);

/** A file's name without its directories or extensions: `./hooks/useQuery.ts` -> `useQuery`,
 * and `C:\\app\\RaceScreen.tsx` -> `RaceScreen` (ESLint gives Windows paths). */
export function baseName(path: string): string {
  const file = path.slice(Math.max(path.lastIndexOf('/'), path.lastIndexOf('\\')) + 1);
  const [name] = file.split('.');
  return name as string;
}
