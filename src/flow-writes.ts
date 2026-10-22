// What a local variable can hold, for the JSX flow (jsx-flow.ts): every value written to it, by
// its declaration (destructuring at any depth), an assignment, an index write or a filling method.
import { AST_NODE_TYPES as AST, type TSESLint, type TSESTree } from '@typescript-eslint/utils';
import { along, isNamedKey, pathTo } from './flow-keys.ts';

/** Methods that put their arguments into the array they are called on. */
const FILLERS = new Set(['push', 'unshift', 'splice']);

/** What a write to the variable stores; `const { a: { el } } = { a: { el: <V /> } }` stores the
 * value at that path. A variable with a write has a definition. */
function storedBy(
  ref: TSESLint.Scope.Reference,
  variable: TSESLint.Scope.Variable,
): TSESTree.Node[] {
  const written = ref.writeExpr;
  if (!written) return [];
  return along(written, pathTo((variable.defs[0] as TSESLint.Scope.Definition).name));
}

/** An element written by index (`out[i] = <V />`, `out[0] = …`); a read on the right
 * (`x = out[0]`) writes nothing. */
function indexWrite(member: TSESTree.MemberExpression): TSESTree.Node[] {
  const write = member.parent;
  return write.type === AST.AssignmentExpression && write.left === member ? [write.right] : [];
}

/** The arguments of a filling method called on the variable: `out.push(<V />)`. */
function filled(member: TSESTree.MemberExpression): TSESTree.Node[] {
  const call = member.parent;
  const fills = call.type === AST.CallExpression && call.callee === member;
  return fills && FILLERS.has((member.property as TSESTree.Identifier).name) ? call.arguments : [];
}

/** What the reference writes into the variable through a member: an element by index, or the
 * arguments of a filling method. A property written by name (`o.x = <V />`, `o['x'] = <V />`) is
 * an object holding JSX, not a list of it. */
function filledBy(ref: TSESLint.Scope.Reference): TSESTree.Node[] {
  const member = ref.identifier.parent;
  if (member.type !== AST.MemberExpression || member.object !== ref.identifier) return [];
  return member.computed && !isNamedKey(member.property) ? indexWrite(member) : filled(member);
}

/** Every value written to a variable. A read has no writeExpr, so storedBy gives it nothing:
 * every reference can be asked. */
const writesTo = (variable: TSESLint.Scope.Variable): TSESTree.Node[] =>
  variable.references.flatMap((r) => [...storedBy(r, variable), ...filledBy(r)]);

/** Every value written to the variable `id` names. */
export function assignedTo(id: TSESTree.Identifier, source: TSESLint.SourceCode): TSESTree.Node[] {
  for (let s: TSESLint.Scope.Scope | null = source.getScope(id); s; s = s.upper) {
    const variable = s.set.get(id.name);
    if (variable) return writesTo(variable);
  }
  return [];
}
