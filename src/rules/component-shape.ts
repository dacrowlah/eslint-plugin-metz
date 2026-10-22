// metz/component-shape — components are the "classes" of the UI layer.
//   - exactly one component per .tsx file (module-level, PascalCase, returns JSX);
//   - no other function may return JSX ("renderX()" helpers, nested components), except an inline
//     arrow whose body only produces JSX, handed to a non-hook call or prop (src/inline-arrow.ts):
//       rows.map((row) => <RacerRow key={row.id} row={row} />)
//       renderItem={({ item }) => <RacerRow row={item} />}
//   - JSX nesting depth inside one return is limited (root element = depth 0).
import type { TSESLint, TSESTree } from '@typescript-eslint/utils';
import { EXPRESSION_FUNCTIONS, type Fn, fnName, isModuleLevel, JSX_NODES } from '../ast.ts';
import { createRule } from '../create-rule.ts';
import { isInlineJsxArrow } from '../inline-arrow.ts';
import { type JsxFlow, reachesJsx } from '../jsx-flow.ts';
import { functionHandlers, type Handlers, listen, popFrame } from '../listen.ts';
import { isPascal } from '../names.ts';
import { optionsSchema, resolveOptions, type RuleSpec } from '../options.ts';

type Settings = { maxJsxDepth: number };
type Options = [Partial<Settings>];
type MessageIds = 'renderHelper' | 'nestedComponent' | 'anonymous' | 'onePerFile' | 'jsxDepth';
type Frame = { fn: Fn; returned: TSESTree.Node[] };
type Shape = {
  readonly context: Readonly<TSESLint.RuleContext<MessageIds, Options>>;
  readonly maxJsxDepth: number;
  readonly flow: JsxFlow;
  readonly stack: Frame[];
  /** The module-level components met so far. */
  readonly components: Fn[];
};

/** The rule's name, options and defaults (pinned by test/rule-specs.test.ts). */
export const RULE = {
  name: 'component-shape',
  defaults: { maxJsxDepth: 3 },
  properties: {
    maxJsxDepth: {
      type: 'integer',
      minimum: 0,
      description:
        'Deepest JSX nesting inside one return, the root element being depth 0. Default 3.',
    },
  },
} satisfies RuleSpec<Settings>;

/** Function boundaries end the walk, except inline `(x) => <X />` arrows, which continue the tree. */
const isBoundary = (n: TSESTree.Node, s: Shape): boolean =>
  EXPRESSION_FUNCTIONS.has(n.type) && !s.flow.isInlineArrow(n as Fn);

function checkDepth(node: TSESTree.JSXElement | TSESTree.JSXFragment, s: Shape): void {
  let depth = 0;
  for (let p: TSESTree.Node | undefined = node.parent; p && !isBoundary(p, s); p = p.parent)
    if (JSX_NODES.has(p.type)) depth++;
  const data = { depth, max: s.maxJsxDepth };
  if (depth > s.maxJsxDepth) s.context.report({ node, messageId: 'jsxDepth', data });
}

/** What is wrong with a module-level function that returns JSX, if anything: it is anonymous, not
 * PascalCase, or a second component. */
function moduleLevelProblem(fn: Fn, name: string | null, s: Shape): MessageIds | null {
  if (name === null) return 'anonymous';
  if (!isPascal(name)) return 'renderHelper';
  s.components.push(fn);
  return s.components.length > 1 ? 'onePerFile' : null;
}
const nestedProblem = (name: string | null): MessageIds =>
  isPascal(name) ? 'nestedComponent' : 'renderHelper';

/** A function returning JSX: nested in another scope, or a module-level one with a problem. */
function classify(fn: Fn, s: Shape): void {
  if (s.flow.isInlineArrow(fn)) return;
  const name = fnName(fn);
  const messageId = isModuleLevel(fn) ? moduleLevelProblem(fn, name, s) : nestedProblem(name);
  if (messageId) s.context.report({ node: fn, messageId, data: { name: name ?? '(anonymous)' } });
}

const HANDLERS: Handlers<Shape> = {
  // A block body reaches no JSX itself: its return statements are added as they are met.
  ...functionHandlers<Shape>(
    (fn, s) => s.stack.push({ fn, returned: [fn.body] }),
    // A function is JSX-producing when something it returns can evaluate to JSX.
    (_, s) => {
      const frame = popFrame(s.stack);
      if (frame.returned.some((e) => reachesJsx(e, s.flow))) classify(frame.fn, s);
    },
  ),
  ReturnStatement: ({ argument }: TSESTree.ReturnStatement, s: Shape) => {
    if (argument) s.stack.at(-1)?.returned.push(argument);
  },
  JSXElement: checkDepth,
  JSXFragment: checkDepth,
};

export default createRule<Options, MessageIds>({
  name: RULE.name,
  meta: {
    type: 'suggestion',
    docs: {
      description:
        'Enforce one component per file, no render helpers or nested components, and a JSX depth limit',
    },
    schema: optionsSchema(RULE.properties),
    defaultOptions: [{}],
    messages: {
      renderHelper:
        '`{{name}}` returns JSX but is not a component. Extract a component into its own file instead of a render helper.',
      nestedComponent:
        'Component `{{name}}` is defined inside another scope. Move it to its own file.',
      anonymous: 'Components must be named PascalCase functions.',
      onePerFile: 'Second component `{{name}}` in this file. One component per file.',
      jsxDepth: 'JSX nested {{depth}} levels deep (max {{max}}). Extract a subcomponent.',
    },
  },
  create(context, [given]) {
    const source = context.sourceCode;
    const flow = { source, isInlineArrow: (fn: Fn) => isInlineJsxArrow(fn, source) };
    const { maxJsxDepth } = resolveOptions(context, RULE, given);
    return listen(HANDLERS, { context, maxJsxDepth, flow, stack: [], components: [] });
  },
});
