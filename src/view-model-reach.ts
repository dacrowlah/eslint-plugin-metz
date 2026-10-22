// Reach-through for metz/screen-view-model: a slice of the view model may be passed on or called,
// but nothing may be read off it, not directly, and not through a local it is bound to
// (`const b = vm.board; b.cells`, `const { cells } = vm.board`), a fallback or choice
// (`vm.board ?? EMPTY`, `ok ? vm.a : vm.b`), or a loop over it.
import { AST_NODE_TYPES as AST, type TSESLint, type TSESTree } from '@typescript-eslint/utils';
import { TS_WRAPPERS } from './ast.ts';

/** What reporting a reach needs: the context, its source, and the reads reported already (each
 * once, however many slices lead to it: `ok ? vm.a : vm.b`). */
export type Reporting = {
  readonly context: Readonly<TSESLint.RuleContext<'reachThrough', unknown[]>>;
  readonly source: TSESLint.SourceCode;
  readonly reported: Set<TSESTree.Node>;
};
/** One walk from a slice: each declarator is followed once (a redeclared `var` cannot loop, and
 * the declarator's own write meets the declarator already seen). */
type Walk = { readonly r: Reporting; readonly seen: Set<TSESTree.Node> };

/** The node itself, or the outermost TS-only wrapper around it (`vm.board!`, `vm.board as B`). */
const outer = (n: TSESTree.Node): TSESTree.Node =>
  n.parent && TS_WRAPPERS.has(n.parent.type) ? outer(n.parent) : n;

/** The member read off `n` (through TS-only syntax), if any: `n.x` or `n[x]`. */
export const memberOf = (n: TSESTree.Node): TSESTree.MemberExpression | null => {
  const o = outer(n);
  return o.parent?.type === AST.MemberExpression && o.parent.object === o ? o.parent : null;
};

/** What a slice evaluates to: the slice itself, or the result of calling it (`vm.getBoard()`). */
const resultOf = (member: TSESTree.Node): TSESTree.Node => {
  const o = outer(member);
  return o.parent?.type === AST.CallExpression && o.parent.callee === o ? o.parent : member;
};

/** Whether `parent` hands `child` on as its value: an operand of `??`/`||`/`&&`, or a branch of
 * `?:` (not its test). */
const handsOn = (parent: TSESTree.Node, child: TSESTree.Node): boolean =>
  parent.type === AST.LogicalExpression ||
  (parent.type === AST.ConditionalExpression && parent.test !== child);

/** A loop over the slice reads its elements or keys (`for (const r of vm.rows)`, `for…in`); a
 * slice local reassigned by a loop (`for (b of others)`) is not one. */
const isLoopOver = (
  p: TSESTree.Node,
  result: TSESTree.Node,
): p is TSESTree.ForOfStatement | TSESTree.ForInStatement =>
  (p.type === AST.ForOfStatement || p.type === AST.ForInStatement) && p.right === result;

export function reportReach(node: TSESTree.Node, r: Reporting): void {
  if (r.reported.has(node)) return;
  r.reported.add(node);
  const text = r.source.getText(node);
  r.context.report({ node, messageId: 'reachThrough', data: { text } });
}

/** Every reference of a slice local: the declarator's own write is not its init, and stops at
 * once. */
function followReferences(p: TSESTree.VariableDeclarator, w: Walk): void {
  const { source } = w.r;
  const refs = source.getDeclaredVariables(p).flatMap((v) => v.references);
  for (const ref of refs) reachThrough(ref.identifier, w);
}

/** A slice bound to a local: destructuring it reads it; a name for it is followed. */
function followLocal(p: TSESTree.VariableDeclarator, w: Walk): void {
  if (w.seen.has(p)) return;
  w.seen.add(p);
  if (p.id.type === AST.Identifier) followReferences(p, w);
  else reportReach(p.id, w.r);
}

/** Where a slice's value goes: on through a fallback or a choice, into a loop, or into a local.
 * A slice's result always sits in some node. */
function followValue(result: TSESTree.Node, w: Walk): void {
  const p = result.parent as TSESTree.Node;
  if (handsOn(p, result)) reachThrough(p, w);
  else if (isLoopOver(p, result)) reportReach(p.left, w.r);
  else if (p.type === AST.VariableDeclarator) followLocal(p, w);
}

function reachThrough(slice: TSESTree.Node, w: Walk): void {
  const result = outer(resultOf(slice));
  const member = memberOf(result);
  if (member) reportReach(member, w.r);
  else followValue(result, w);
}

/** Reports every read off `slice`, wherever its value goes. */
export const reachesThrough = (slice: TSESTree.Node, r: Reporting): void => {
  reachThrough(slice, { r, seen: new Set() });
};
