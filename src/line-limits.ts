// The listeners of metz/max-counted-lines: each function body, component budget, class `static {}`
// block and module, measured in counted lines against its limit.
import { AST_NODE_TYPES as AST, type TSESLint, type TSESTree } from '@typescript-eslint/utils';
import { type Fn, isJsxish, reportedName } from './ast.ts';
import { bodyTokens, componentBudget } from './component-budget.ts';
import { countedLines, markSkipped, type SkipSet } from './counted-lines.ts';
import { functionHandlers, type Handlers, popFrame } from './listen.ts';
import { isPascal } from './names.ts';

export type LineLimits = {
  file: number;
  function: number;
  componentLogic: number;
  componentJsx: number;
  exemptCallbacksOf: readonly string[];
};
/** Each limit is reported by the message of its name. */
type Limit = 'file' | 'function' | 'componentLogic' | 'componentJsx';
type Frame = { readonly fn: Fn; returnsJsx: boolean };
export type Lines = {
  readonly context: Readonly<TSESLint.RuleContext<Limit, [Partial<LineLimits>]>>;
  readonly source: TSESLint.SourceCode;
  readonly limits: LineLimits;
  readonly skip: SkipSet;
  readonly stack: Frame[];
};
/** Where a measure is reported, and the name it reports. */
type At = { readonly node: TSESTree.Node; readonly name?: string };

/** Reports `at` when `tokens` hold more counted lines than `limit` allows. */
function measure(s: Lines, limit: Limit, tokens: readonly TSESTree.Token[], at: At): void {
  const n = countedLines(tokens, s.skip);
  const data = { n, max: s.limits[limit], name: at.name };
  if (n > data.max) s.context.report({ node: at.node, messageId: limit, data });
}

/** The identifier a callee starts from, through members and calls: `describe` for
 * `describe.skip(...)` and `describe.each(rows)(...)`; null when it starts elsewhere
 * (`x.describe(...)` starts from `x`). */
function rootOf(callee: TSESTree.Node): string | null {
  if (callee.type === AST.Identifier) return callee.name;
  if (callee.type === AST.MemberExpression) return rootOf(callee.object);
  if (callee.type === AST.TaggedTemplateExpression) return rootOf(callee.tag);
  return callee.type === AST.CallExpression ? rootOf(callee.callee) : null;
}

const isExempt = ({ parent: p }: Fn, { limits }: Lines): boolean =>
  p.type === AST.CallExpression &&
  limits.exemptCallbacksOf.some((name) => name === rootOf(p.callee));

function measureComponent(fn: Fn, name: string, s: Lines): void {
  const { logic, jsx } = componentBudget(s.source, fn);
  measure(s, 'componentLogic', logic, { node: fn, name });
  measure(s, 'componentJsx', jsx, { node: fn, name });
}

function measureFunction({ fn, returnsJsx }: Frame, s: Lines): void {
  const name = reportedName(fn);
  if (returnsJsx && isPascal(name)) measureComponent(fn, name, s);
  else measure(s, 'function', bodyTokens(s.source, fn), { node: fn, name });
}

/** Tokens that never count: closing JSX tags, imports and re-exports. */
const skipNode = (node: TSESTree.Node, s: Lines): void => {
  markSkipped(s.skip, s.source.getTokens(node));
};

export const HANDLERS: Handlers<Lines> = {
  ...functionHandlers<Lines>(
    (fn, s) => s.stack.push({ fn, returnsJsx: isJsxish(fn.body) }),
    (_, s) => {
      const frame = popFrame(s.stack);
      if (!isExempt(frame.fn, s)) measureFunction(frame, s);
    },
  ),
  ReturnStatement: (node: TSESTree.ReturnStatement, s: Lines) => {
    const top = s.stack.at(-1);
    if (top && isJsxish(node.argument)) top.returnsJsx = true;
  },
  JSXClosingElement: skipNode,
  JSXClosingFragment: skipNode,
  // `{/* comment */}`: only braces around a comment.
  JSXEmptyExpression: (node: TSESTree.JSXEmptyExpression, s: Lines) => {
    skipNode(node.parent, s);
  },
  ImportDeclaration: skipNode,
  ExportAllDeclaration: skipNode,
  'ExportNamedDeclaration[source]': skipNode,
  // A class `static {}` block is a body like a method's: the function limit.
  'StaticBlock:exit': (block: TSESTree.StaticBlock, s: Lines) => {
    const tokens = s.source.getTokens(block).slice(2, -1);
    measure(s, 'function', tokens, { node: block, name: '(static block)' });
  },
  'Program:exit': (program: TSESTree.Program, s: Lines) => {
    const tokens = s.source.ast.tokens;
    measure(s, 'file', tokens, { node: program.body[0] ?? program });
  },
};
