// A component's two budgets for metz/max-counted-lines: its logic (the body before the final
// `return <jsx/>`, plus every condition anywhere in that return: a `?:` test, a non-JSX branch that
// is not a literal, the left operand of `&&` / `||` / `??`, but not inside a nested function's
// body) and its JSX (the rest of that final return).
import { AST_NODE_TYPES as AST, type TSESLint, type TSESTree } from '@typescript-eslint/utils';
import { EXPRESSION_FUNCTIONS, type Fn, isJsxish, isNothing } from './ast.ts';

type Token = TSESTree.Token;
type Source = TSESLint.SourceCode;
/** The final `return <jsx/>` (or the JSX expression body), and what it returns. */
type Tail = { readonly tail: TSESTree.Node; readonly returned: TSESTree.Node };
type Parts = {
  readonly src: Source;
  readonly fn: Fn;
  readonly tail: Tail | null;
  /** The start offsets of the tail's condition tokens. */
  readonly logic: ReadonlySet<number>;
};

/** Body tokens without the body's own outer braces. */
export function bodyTokens(src: Source, fn: Fn): Token[] {
  const tokens = src.getTokens(fn.body);
  return fn.body.type === AST.BlockStatement ? tokens.slice(1, -1) : tokens;
}

const tailOf = (tail: TSESTree.Node, returned: TSESTree.Node | null | undefined): Tail | null =>
  returned && isJsxish(returned) ? { tail, returned } : null;

function jsxTail(fn: Fn): Tail | null {
  if (fn.body.type !== AST.BlockStatement) return tailOf(fn.body, fn.body);
  const statements = fn.body.body;
  const last = statements.at(-1);
  return last?.type === AST.ReturnStatement ? tailOf(last, last.argument) : null;
}

/** JSX, a choice of JSX, or an array of JSX: it stays in the JSX budget (its own conditions are
 * found by the walk). */
const holdsJsx = (e: TSESTree.Node): boolean =>
  isJsxish(e) || (e.type === AST.ArrayExpression && e.elements.some(isJsxish));
const isLogicBranch = (b: TSESTree.Node): boolean => !holdsJsx(b) && !isNothing(b);

/** The conditions one node holds itself: a `?:` test and each branch that is neither JSX nor a
 * literal, or the left operand of `&&` / `||` / `??`. The walk finds the ones nested in them. */
function logicIn(e: TSESTree.Node): TSESTree.Node[] {
  if (e.type === AST.LogicalExpression) return holdsJsx(e.left) ? [] : [e.left];
  if (e.type !== AST.ConditionalExpression) return [];
  return [e.test, ...[e.consequent, e.alternate].filter(isLogicBranch)];
}

/** A node's child nodes, in every field but `parent`. */
const childrenOf = (n: TSESTree.Node): TSESTree.Node[] =>
  Object.entries(n)
    .filter(([key]) => key !== 'parent')
    .flatMap(([, v]: [string, unknown]) => [v].flat())
    .filter((v): v is TSESTree.Node => typeof v === 'object' && v !== null && 'type' in v);

/** Every condition anywhere in the returned JSX (children, attribute values, and anything inside
 * a `{...}`: `[s.a, ok && s.b]`, `t(ok ? 'a' : 'b')`, `{...(ok ? p : q)}`), stopping at nested
 * functions, whose bodies are their own. */
const nestedLogic = (n: TSESTree.Node): TSESTree.Node[] =>
  EXPRESSION_FUNCTIONS.has(n.type) ? [] : [...logicIn(n), ...childrenOf(n).flatMap(nestedLogic)];

/** The bodies of the outermost functions inside a node: their lines are their own, not this
 * logic (a `map` arrow in a non-JSX branch keeps its JSX in the JSX budget). */
const fnBodies = (n: TSESTree.Node): TSESTree.Node[] =>
  EXPRESSION_FUNCTIONS.has(n.type)
    ? [(n as TSESTree.ArrowFunctionExpression).body]
    : childrenOf(n).flatMap(fnBodies);

const startsOf = (src: Source, nodes: readonly TSESTree.Node[]): Set<number> =>
  new Set(nodes.flatMap((n) => src.getTokens(n)).map((t) => t.range[0]));

/** The start offsets of the conditions in the returned JSX, less the functions inside them. */
function logicStarts(src: Source, tail: Tail | null): Set<number> {
  const logic = tail ? nestedLogic(tail.returned) : [];
  const inner = startsOf(src, logic.flatMap(fnBodies));
  return new Set([...startsOf(src, logic)].filter((r) => !inner.has(r)));
}

/** The tail's tokens, less its conditions. */
const jsxTokens = ({ src, tail, logic }: Parts): Token[] =>
  (tail ? src.getTokens(tail.tail) : []).filter((t) => !logic.has(t.range[0]));

/** The body's tokens, less the tail's, but with the tail's conditions. */
function logicTokens({ src, fn, tail, logic }: Parts): Token[] {
  const tailStarts = startsOf(src, tail ? [tail.tail] : []);
  return bodyTokens(src, fn).filter((t) => !tailStarts.has(t.range[0]) || logic.has(t.range[0]));
}

/** The tokens of a component's logic and of its JSX. */
export function componentBudget(src: Source, fn: Fn): { logic: Token[]; jsx: Token[] } {
  const tail = jsxTail(fn);
  const parts = { src, fn, tail, logic: logicStarts(src, tail) };
  return { logic: logicTokens(parts), jsx: jsxTokens(parts) };
}
