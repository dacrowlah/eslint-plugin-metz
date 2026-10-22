// The one exception to "no function returns JSX": an inline arrow whose body only produces JSX,
// handed to a non-hook call or a JSX attribute or child (or chosen on the way by `?:`, `??`, `||`):
//   rows.map((row) => <Row row={row} />)            renderItem={({ item }) => <Row row={item} />}
// or as a property value of an object handed over that way, or spread into one (Expo Router
// options, a test wrapper):
//   screenOptions={{ headerRight: () => <Btn /> }}   nav.setOptions({ headerRight: () => <Btn /> })
// Its body is JSX, or a choice between JSX and nothing (`ok ? <A /> : <B />`, `ok && <A />`,
// `ok ? <A /> : null`). Component wrappers (`memo(() => <V />)`) and hook callbacks
// (`useCallback(() => <V />)`, under any local name) are not inline, and neither is an arrow
// called in place.
import { AST_NODE_TYPES as AST, type TSESLint, type TSESTree } from '@typescript-eslint/utils';
import { type Fn, isNothing, JSX_NODES, unwrapComponent } from './ast.ts';
import { hookName } from './hooks.ts';

const isJsxOrNothing = (b: TSESTree.Node): boolean => isJsxBody(b) || isNothing(b);

/** JSX, or a `?:` / `&&` that only chooses between JSX and nothing. */
function isJsxBody(e: TSESTree.Node): boolean {
  if (JSX_NODES.has(e.type)) return true;
  if (e.type === AST.LogicalExpression) return e.operator === '&&' && isJsxBody(e.right);
  return e.type === AST.ConditionalExpression && [e.consequent, e.alternate].every(isJsxOrNothing);
}

/** A value handed on as a branch of `?:` (not its test) or the fallback of `??` / `||` (not `&&`,
 * whose left value is not "nothing"). */
const handsOn = (p: TSESTree.Node, n: TSESTree.Node): boolean =>
  (p.type === AST.ConditionalExpression && p.test !== n) ||
  (p.type === AST.LogicalExpression && p.operator !== '&&' && p.right === n);
/** The node itself, or the outermost choice that hands it on (`ok ? () => <A /> : undefined`). */
const chosen = (n: TSESTree.Node): TSESTree.Node =>
  n.parent && handsOn(n.parent, n) ? chosen(n.parent) : n;

/** What a spread would take: the choice, also the right of `&&` (`...(ok && { a })` spreads
 * nothing when `ok` is falsy). Past `chosen`, a logical holding it on the right is an `&&`. */
const spreadArgument = (n: TSESTree.Node): TSESTree.Node => {
  const c = chosen(n);
  const p = c.parent;
  return p?.type === AST.LogicalExpression && p.right === c ? spreadArgument(p) : c;
};

/** The object literal, or the outermost object it is spread into (`{ ...(ok ? { a } : {}) }`,
 * `{ ...(ok && { a }) }`). */
const spreadInto = (o: TSESTree.Node): TSESTree.Node => {
  const s = spreadArgument(o).parent;
  const into = s?.type === AST.SpreadElement && s.parent.type === AST.ObjectExpression;
  return into ? spreadInto(s.parent) : chosen(o);
};

/** An object literal is handed over by the arrow it is the concise body of, or the block-bodied
 * arrow that returns it (React Navigation's `options={({ route }) => ({ headerRight: () => <Btn
 * /> })}`); otherwise by itself. An object literal always sits in some node. */
function objectHandedOver(object: TSESTree.Node): TSESTree.Node {
  const holder = object.parent as TSESTree.Node;
  if (holder.type === AST.ArrowFunctionExpression) return holder;
  return returningArrow(holder) ?? object;
}

/** The block-bodied arrow a `return` statement returns from: a statement whose parent's parent
 * is an arrow sits in that arrow's block body. */
function returningArrow(holder: TSESTree.Node): TSESTree.Node | null {
  if (holder.type !== AST.ReturnStatement) return null;
  const outerFn = holder.parent.parent;
  return outerFn?.type === AST.ArrowFunctionExpression ? outerFn : null;
}

/** Where the arrow is handed over: itself (or the choice that holds it), or, when it is a
 * property value (of an object literal: a property whose value is a function is never in a
 * pattern), where that object, or the one it is spread into, is handed over. */
function handedOver(fn: Fn): TSESTree.Node {
  const top = chosen(fn);
  const p = top.parent;
  if (p?.type !== AST.Property || p.value !== top) return top;
  return objectHandedOver(spreadInto(p.parent));
}

/** Passed as an argument (never the callee) of a call that is not a hook call. */
function isNonHookArgument(node: TSESTree.Node, source: TSESLint.SourceCode): boolean {
  const p = node.parent;
  if (p?.type !== AST.CallExpression || p.callee === node) return false;
  return hookName(p, source.getScope(p)) === null;
}

export function isInlineJsxArrow(fn: Fn, source: TSESLint.SourceCode): boolean {
  if (!isJsxBody(fn.body) || unwrapComponent(fn) !== fn) return false;
  const node = handedOver(fn);
  if (node.parent?.type === AST.JSXExpressionContainer) return true;
  return isNonHookArgument(node, source);
}
