// Shared AST helpers for eslint-plugin-metz.
import { AST_NODE_TYPES as AST, type TSESTree } from '@typescript-eslint/utils';
import { dispatch, type NodeHandlers } from './dispatch.ts';

export type Fn =
  TSESTree.FunctionDeclaration | TSESTree.FunctionExpression | TSESTree.ArrowFunctionExpression;
/** A function, or a signature without a body (an overload, `declare function`, an abstract
 * method). */
export type Sig = Fn | TSESTree.TSDeclareFunction | TSESTree.TSEmptyBodyFunctionExpression;

export const FN_SELECTORS = [
  AST.FunctionDeclaration,
  AST.FunctionExpression,
  AST.ArrowFunctionExpression,
] as const;

/** The functions an expression can hold (a function declaration only sits inside one of them). */
export const EXPRESSION_FUNCTIONS = new Set<string>([
  AST.ArrowFunctionExpression,
  AST.FunctionExpression,
]);
export const JSX_NODES = new Set<string>([AST.JSXElement, AST.JSXFragment]);

/** Calls that wrap a component and hand it on; a callee with no name (`null`) is none. */
const WRAPPERS: ReadonlySet<string | null> = new Set(['memo', 'forwardRef']);

/** TS-only syntax that hands back its operand at run time. */
export const TS_WRAPPERS = new Set<string>([
  AST.TSAsExpression,
  AST.TSSatisfiesExpression,
  AST.TSNonNullExpression,
  AST.TSTypeAssertion,
]);
export type Wrapped =
  | TSESTree.TSAsExpression
  | TSESTree.TSSatisfiesExpression
  | TSESTree.TSNonNullExpression
  | TSESTree.TSTypeAssertion;

/** A branch that says "nothing": a literal (`null`, `false`, `''`) or `undefined`. */
export const isNothing = (e: TSESTree.Node): boolean =>
  e.type === AST.Literal || (e.type === AST.Identifier && e.name === 'undefined');

/** Name of a callee: `memo` for `memo(...)` and `React.memo(...)`; otherwise null. */
export function calleeName(callee: TSESTree.Node): string | null {
  if (callee.type === AST.Identifier) return callee.name;
  if (callee.type !== AST.MemberExpression) return null;
  return callee.property.type === AST.Identifier ? callee.property.name : null;
}

function isWrapperCall(parent: TSESTree.Node, child: TSESTree.Node): boolean {
  if (parent.type !== AST.CallExpression || parent.arguments[0] !== child) return false;
  return WRAPPERS.has(calleeName(parent.callee));
}

/** Outermost node of a `memo(forwardRef(fn) as X) satisfies Y` chain, or `node` itself. */
export function unwrapComponent(node: TSESTree.Node): TSESTree.Node {
  let n = node;
  // Walking up from a function, `n` is always a TS wrapper's expression, never its type.
  for (let p = n.parent; p && (TS_WRAPPERS.has(p.type) || isWrapperCall(p, n)); p = n.parent) n = p;
  return n;
}

type Keyed = { readonly key: TSESTree.Node };
const keyOf = (p: Keyed): TSESTree.Node => p.key;
/** The node a holder names what it holds by: a variable's id, or a key. */
const HOLDER_IDS: NodeHandlers<[], TSESTree.Node> = {
  [AST.VariableDeclarator]: (p) => p.id,
  [AST.Property]: keyOf,
  [AST.MethodDefinition]: keyOf,
  [AST.TSAbstractMethodDefinition]: keyOf,
  [AST.PropertyDefinition]: keyOf,
};
const identifierName = (n: TSESTree.Node | null): string | null =>
  n?.type === AST.Identifier ? n.name : null;

/** The name its holder gives a function: a function (or its wrapper) always sits in a node. */
function heldAs(fn: Sig): string | null {
  const unwrapped = unwrapComponent(fn);
  const holder = unwrapped.parent as TSESTree.Node;
  return identifierName(dispatch(HOLDER_IDS, holder, () => null));
}

/** The binding name a function is known by, or null when anonymous. */
export const fnName = (fn: Sig): string | null => (fn.id ? fn.id.name : heldAs(fn));
/** The name a report gives a function: its binding name, or `(anonymous function)`. */
export const reportedName = (fn: Sig): string => fnName(fn) ?? '(anonymous function)';

const EXPORTS = new Set<string>([AST.ExportNamedDeclaration, AST.ExportDefaultDeclaration]);

/** The export declaration around a statement, or the statement itself. */
const exported = (n: TSESTree.Node): TSESTree.Node =>
  n.parent && EXPORTS.has(n.parent.type) ? n.parent : n;

/** True when the function is declared at module scope (optionally exported / wrapped in memo). */
export function isModuleLevel(fn: Fn): boolean {
  const n = unwrapComponent(fn);
  const statement = n.parent?.type === AST.VariableDeclarator ? n.parent.parent : n;
  return exported(statement).parent?.type === AST.Program;
}

/** What an expression hands back that can be JSX: the operand of TS-only syntax, the branches of
 * a `?:`, the right of `&&` / `||` / `??`. */
function handedBack(e: TSESTree.Node): TSESTree.Node[] {
  if (TS_WRAPPERS.has(e.type)) return [(e as Wrapped).expression];
  if (e.type === AST.ConditionalExpression) return [e.consequent, e.alternate];
  return e.type === AST.LogicalExpression ? [e.right] : [];
}

/** JSX, or a ternary / && whose result can be JSX. */
export const isJsxish = (e: TSESTree.Node | null | undefined): boolean =>
  !!e && (JSX_NODES.has(e.type) || handedBack(e).some(isJsxish));
