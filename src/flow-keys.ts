// Keys for the JSX flow (jsx-flow.ts): which values an object literal holds under a key, and the
// key path from a destructuring pattern down to one of its names.
import { AST_NODE_TYPES as AST, type TSESLint, type TSESTree } from '@typescript-eslint/utils';

/** A key as written: a name or a literal; `null` for any other (computed) key. */
export const keyName = (key: TSESTree.Node): string | null => {
  if (key.type === AST.Identifier) return key.name;
  return key.type === AST.Literal ? String(key.value) : null;
};

/** Whether a property is read under `key` (`null`: any key). */
const isUnder = (p: TSESTree.Property, key: string | null): boolean =>
  key === null || (!p.computed && keyName(p.key) === key);

/** The values an object literal holds under `key`; under every key when the key is not known
 * (`null`: a computed key in a pattern). */
export const valuesAt = (object: TSESTree.ObjectExpression, key: string | null): TSESTree.Node[] =>
  object.properties.flatMap((p) => (p.type === AST.Property && isUnder(p, key) ? [p.value] : []));

/** The keys from a declaration's pattern down to the identifier: `{ a: { el } }` is a, el; a
 * computed key is not known (`null`). */
export function pathTo(id: TSESTree.Node): (string | null)[] {
  const keys: (string | null)[] = [];
  for (let n = id; n.parent?.type === AST.Property; n = n.parent.parent)
    keys.unshift(n.parent.computed ? null : keyName(n.parent.key));
  return keys;
}

/** What `written` holds along `keys`; the whole value when it is not an object literal. */
export function along(written: TSESTree.Node, keys: readonly (string | null)[]): TSESTree.Node[] {
  if (keys.length === 0 || written.type !== AST.ObjectExpression) return [written];
  const [key, ...rest] = keys;
  return valuesAt(written, key ?? null).flatMap((v) => along(v, rest));
}

/** The key a member reads: its name, a literal key, or `null` (any key) for a computed one. */
export const memberKey = (
  e: TSESTree.MemberExpression,
  source: TSESLint.SourceCode,
): string | null => {
  if (!e.computed) return source.getText(e.property);
  return e.property.type === AST.Literal ? String(e.property.value) : null;
};

/** A computed key that is a name all the same: a string literal (`o['icon']`), or a template
 * literal with no substitution (``o[`icon`]``). */
export const isNamedKey = (key: TSESTree.Node): boolean =>
  (key.type === AST.Literal && typeof key.value === 'string') ||
  (key.type === AST.TemplateLiteral && key.expressions.length === 0);
