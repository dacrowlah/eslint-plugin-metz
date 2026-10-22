// Does an expression evaluate to JSX? Follows what a function can hand back: JSX itself,
// conditionals, `&&` / `||` / `??`, arrays, `as` / `satisfies` / `!` / `f<T>`, local variables
// (through their initialiser, destructuring at any depth, assignments, index writes and
// `push`/`unshift`/`splice`), an element read by index (`[<V />][0]`, `els?.[0]`), a property read
// off an object that holds JSX by name or by key (`{ el: <V /> }.el`, `ICONS[kind]`, a table
// declared `as const` or `satisfies`, nested tables), a method that hands elements back
// (`[<V />].filter(Boolean)`), and the arrays `xs.map((x) => <X />)`, `Array.from(xs, (x) => <X />)`,
// `Array.of(<V />)`, `fill` and `concat` build. A number or boolean read off JSX (`[<V />].length`,
// `els.indexOf(x)`) is not JSX, and neither is JSX merely passed as an argument (`render(<X />)`,
// `toast.custom((t) => <T />)`) or stored in an object that is not read back. Every walk carries a
// `seen` set, so variables that alias each other end it.
import { AST_NODE_TYPES as AST, type TSESLint, type TSESTree } from '@typescript-eslint/utils';
import type { Fn } from './ast.ts';
import { dispatch, type NodeHandlers } from './dispatch.ts';
import { readOff, type Walk } from './flow-objects.ts';
import { assignedTo } from './flow-writes.ts';

export type JsxFlow = { source: TSESLint.SourceCode; isInlineArrow: (fn: Fn) => boolean };

/** Calls that build an array from a JSX callback: `xs.map`, `xs.flatMap`, `Array.from`. */
const MAPPERS = new Set(['map', 'flatMap', 'from']);
/** Methods that hand back no element of the array they are called on. */
const NO_ELEMENT = new Set([
  ...['indexOf', 'lastIndexOf', 'findIndex', 'findLastIndex', 'includes', 'some', 'every'],
  ...['join', 'toString', 'toLocaleString', 'forEach', 'keys', 'push', 'unshift'],
]);
/** Assignments whose value is the left's old value or the right: `??=`, `||=`, `&&=`. */
const LOGICAL_ASSIGN = new Set(['??=', '||=', '&&=']);
/** Methods whose result holds their arguments: `Array(n).fill(<Star />)`, `out.concat(<V />)`. */
const RETURNS_ARGS = new Set(['fill', 'concat']);

/** A node's source text, read as written. */
function textOf(n: TSESTree.Node, w: Walk): string {
  const { source } = w.flow;
  return source.getText(n);
}

const inlineArrow = (a: TSESTree.Node, w: Walk): boolean =>
  a.type === AST.ArrowFunctionExpression && w.flow.isInlineArrow(a);
const anyReaches = (nodes: readonly (TSESTree.Node | null)[], w: Walk): boolean =>
  nodes.some((n) => reaches(n, w));

/** A mapper given an inline JSX callback: `xs.map((x) => <X />)`. */
const mapsToJsx = (call: TSESTree.CallExpression, method: string, w: Walk): boolean =>
  MAPPERS.has(method) && call.arguments.some((a) => inlineArrow(a, w));

/** A method call: a mapper with an inline JSX callback, `fill`/`concat` given JSX, or a method
 * that hands back elements of something that reaches JSX. Read as written: `xs['map']` is not
 * `xs.map`, so it is not taken for a mapper. */
function methodReaches(call: TSESTree.CallExpression, callee: TSESTree.MemberExpression, w: Walk) {
  const method = textOf(callee.property, w);
  if (mapsToJsx(call, method, w)) return true;
  if (RETURNS_ARGS.has(method) && anyReaches(call.arguments, w)) return true;
  return !NO_ELEMENT.has(method) && reaches(callee.object, w);
}

function callReaches(call: TSESTree.CallExpression, w: Walk): boolean {
  const { callee } = call;
  if (callee.type !== AST.MemberExpression) return false;
  if (textOf(callee, w) === 'Array.of') return anyReaches(call.arguments, w);
  return methodReaches(call, callee, w);
}

/** An element read by index off something that reaches JSX, or a value read off an object
 * literal (its own walk) that does. */
function memberReaches(e: TSESTree.MemberExpression, w: Walk): boolean {
  if (e.computed && reaches(e.object, w)) return true;
  return anyReaches(readOff(e, { flow: w.flow, seen: new Set() }), w);
}

type Operand =
  | TSESTree.ChainExpression
  | TSESTree.TSAsExpression
  | TSESTree.TSSatisfiesExpression
  | TSESTree.TSNonNullExpression
  | TSESTree.TSInstantiationExpression;
/** Syntax that hands back its operand: an optional chain, and TS-only syntax erased at run time
 * (`<T>x` is left out: it cannot be written in a .tsx file, and a .ts file holds no JSX). */
const operandReaches = (e: Operand, w: Walk): boolean => reaches(e.expression, w);

const REACHES: NodeHandlers<[Walk], boolean> = {
  [AST.JSXElement]: () => true,
  [AST.JSXFragment]: () => true,
  [AST.ConditionalExpression]: (e, w) => anyReaches([e.consequent, e.alternate], w),
  [AST.LogicalExpression]: (e, w) => anyReaches([e.left, e.right], w),
  [AST.ArrayExpression]: (e, w) => anyReaches(e.elements, w),
  [AST.SpreadElement]: (e, w) => reaches(e.argument, w),
  [AST.SequenceExpression]: (e, w) => reaches(e.expressions.at(-1), w),
  // A logical assignment hands back what the left held or the right (`(cache[k] ??= <Icon />)`,
  // a memo); a plain `=` in a handler (`() => (ref.current = <V />)`) stores, so is not followed.
  [AST.AssignmentExpression]: (e, w) =>
    LOGICAL_ASSIGN.has(e.operator) && anyReaches([e.right, e.left], w),
  [AST.Identifier]: (e, w) => anyReaches(assignedTo(e, w.flow.source), w),
  [AST.MemberExpression]: memberReaches,
  [AST.CallExpression]: callReaches,
  [AST.ChainExpression]: operandReaches,
  [AST.TSAsExpression]: operandReaches,
  [AST.TSSatisfiesExpression]: operandReaches,
  [AST.TSNonNullExpression]: operandReaches,
  [AST.TSInstantiationExpression]: operandReaches,
};

function reaches(e: TSESTree.Node | null | undefined, w: Walk): boolean {
  if (!e || w.seen.has(e)) return false;
  w.seen.add(e);
  return dispatch(REACHES, e, () => false, w);
}

export const reachesJsx = (e: TSESTree.Node | null | undefined, flow: JsxFlow): boolean =>
  reaches(e, { flow, seen: new Set() });
