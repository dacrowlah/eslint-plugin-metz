// Hook-call recognition shared by rules. A hook is `useX(...)`, React 19's bare `use(...)`, or
// `React.useX(...)`, under whatever local name it is called: an aliased import
// (`import { useQuery as query }`), a default import named for its module
// (`import query from './useQuery'`), or a variable holding one (`const q = useQuery`).
import { AST_NODE_TYPES as AST, type TSESLint, type TSESTree } from '@typescript-eslint/utils';
import { calleeName } from './ast.ts';
import { baseName, isHookName } from './names.ts';

type Scope = TSESLint.Scope.Scope | null;
/** Where to look a name up, and the names already followed (an alias cycle ends the walk). */
type Lookup = { readonly scope: Scope; readonly seen: ReadonlySet<string> };
type Named = { readonly local: string; readonly lookup: Lookup };

const NONE: ReadonlySet<string> = new Set();

/** What a variable holds: the binding its initialiser names (`useQuery`, `React.useState`), or
 * its own name when the initialiser names none (`const useThing = () => ...`). */
function heldName(init: TSESTree.Expression, { local, lookup }: Named): string {
  if (init.type === AST.Identifier) return realName(init.name, lookup);
  return calleeName(init) ?? local;
}

/** What an import binds: the name it imports (`import { useQuery as query }`). */
const importedName = (imported: TSESTree.Identifier | TSESTree.StringLiteral): string =>
  imported.type === AST.Identifier ? imported.name : imported.value;

/** A default import is named for its module when that is a hook (`import query from
 * './useQuery'`); otherwise by its local name. */
function defaultName(node: TSESTree.ImportDefaultSpecifier, local: string): string {
  const named = baseName(node.parent.source.value);
  return isHookName(named) ? named : local;
}

/** A variable named by an identifier and given a value holds what that value names. */
function declaredName(node: TSESTree.VariableDeclarator, named: Named): string {
  const held = node.id.type === AST.Identifier ? node.init : null;
  return held ? heldName(held, named) : named.local;
}

/** The name a local binding really refers to. */
function definedName(def: TSESLint.Scope.Definition, named: Named): string {
  const { node } = def;
  if (node.type === AST.ImportSpecifier) return importedName(node.imported);
  if (node.type === AST.ImportDefaultSpecifier) return defaultName(node, named.local);
  return node.type === AST.VariableDeclarator ? declaredName(node, named) : named.local;
}

/** `local`, looked up from `scope`, having followed `seen` and now `local` too. */
const following = (local: string, scope: Scope, seen: ReadonlySet<string>): Named => ({
  local,
  lookup: { scope, seen: new Set([...seen, local]) },
});

function realName(local: string, { scope, seen }: Lookup): string {
  if (seen.has(local)) return local;
  for (let s = scope; s; s = s.upper) {
    const def = s.set.get(local)?.defs[0];
    if (def) return definedName(def, following(local, s, seen));
  }
  return local;
}

/** The hook's real name (alias resolved), or null when the call is not a hook call. */
export function hookName(call: TSESTree.CallExpression, scope: Scope): string | null {
  const name = calleeName(call.callee);
  if (name === null) return null;
  const real = call.callee.type === AST.Identifier ? realName(name, { scope, seen: NONE }) : name;
  return isHookName(real) ? real : null;
}
