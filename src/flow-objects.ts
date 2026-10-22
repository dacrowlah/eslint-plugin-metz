// The object literals an expression can be, for the JSX flow (jsx-flow.ts): a property read off
// one of them (`ICONS[kind]`, `{ el: <V /> }.el`) is what the object holds under that key.
import { AST_NODE_TYPES as AST, type TSESTree } from '@typescript-eslint/utils';
import type { Wrapped } from './ast.ts';
import { dispatch, type NodeHandlers } from './dispatch.ts';
import { memberKey, valuesAt } from './flow-keys.ts';
import { assignedTo } from './flow-writes.ts';
import type { JsxFlow } from './jsx-flow.ts';

/** One walk: the flow it reads, and the nodes it has followed (each is followed once, so
 * variables that alias each other, a swap, end it). */
export type Walk = { readonly flow: JsxFlow; readonly seen: Set<TSESTree.Node> };

const objectsIn = (nodes: readonly TSESTree.Node[], w: Walk): TSESTree.ObjectExpression[] =>
  nodes.flatMap((n) => objectsOf(n, w));
/** Through TS-only syntax (`{...} as const`, `satisfies`) or an optional chain. */
const operandObjects = (e: Wrapped | TSESTree.ChainExpression, w: Walk) =>
  objectsOf(e.expression, w);

const OBJECTS: NodeHandlers<[Walk], TSESTree.ObjectExpression[]> = {
  [AST.ObjectExpression]: (e) => [e],
  [AST.TSAsExpression]: operandObjects,
  [AST.TSSatisfiesExpression]: operandObjects,
  [AST.TSNonNullExpression]: operandObjects,
  [AST.TSTypeAssertion]: operandObjects,
  [AST.ChainExpression]: operandObjects,
  // A value read off one (`T[size][kind]`), and what a variable holds.
  [AST.MemberExpression]: (e, w) => objectsIn(readOff(e, w), w),
  [AST.Identifier]: (e, w) => objectsIn(assignedTo(e, w.flow.source), w),
};

/** The object literals an expression can be: itself, through TS-only syntax or an optional
 * chain, through a variable, or a value read off one. */
function objectsOf(e: TSESTree.Node, w: Walk): TSESTree.ObjectExpression[] {
  if (w.seen.has(e)) return [];
  w.seen.add(e);
  return dispatch(OBJECTS, e, () => [], w);
}

/** The values a member reads off the object literals its object can be. */
export const readOff = (e: TSESTree.MemberExpression, w: Walk): TSESTree.Node[] =>
  objectsOf(e.object, w).flatMap((o) => valuesAt(o, memberKey(e, w.flow.source)));
