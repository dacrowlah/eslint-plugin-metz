// Every ban message ends with a stable `[id]`, so a report names the exact table entry that fired
// and the lint-config tests can pin each entry (test/lint-config.test.ts).
const TAG = /\[([\w/.:-]+)\]$/;

export const tagged = (id: string, message: string): string => `${message} [${id}]`;

export const tagOf = (message: string): string | null => TAG.exec(message)?.[1] ?? null;

/** A `no-restricted-syntax` entry maker whose messages carry the tag `<scope>/<id>`. */
export const syntaxBans =
  (scope: string) =>
  (id: string, selector: string, message: string): { selector: string; message: string } => ({
    selector,
    message: tagged(`${scope}/${id}`, message),
  });
