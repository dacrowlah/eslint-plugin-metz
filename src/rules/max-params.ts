// metz/max-params — Sandi Metz rule 3: "Pass no more than four parameters into a method.
// Hash options are parameters."  In TS/React:
//   - each positional parameter counts 1;
//   - a destructured object parameter counts one per key ({ a, b, c } = 3);
//   - an inline type literal counts one per member;
//   - a named type ending in Props|Options|Opts|Params|Args is an options bag: one per member.
//     Generic wrappers (Readonly, Partial, PropsWithChildren...) and `<P extends XProps>` constraints are
//     unwrapped; a union bag weighs its widest member; mapped types and index signatures are uncountable.
//     It must be declared in the same file as a plain type literal / interface without `extends`,
//     otherwise its keys cannot be counted and the rule reports it;
//   - any other named type (RaceState, BoardModel, Move) is a parameter object and counts 1.
// Destructured keys (nested too) and tuple elements count one each; a nested inline object inside a
// bag is one prop; overload signatures
// (`declare function`) are checked too.
// React components are functions, so their props count too.
import { AST_NODE_TYPES as AST, type TSESLint, type TSESTree } from '@typescript-eslint/utils';
import { FN_SELECTORS, fnName, type Sig } from '../ast.ts';
import { DEFAULT_BAG_PATTERN } from '../bags.ts';
import { createRule } from '../create-rule.ts';
import { type Handlers, listen } from '../listen.ts';
import { optionsSchema, resolveOptions, type RuleSpec } from '../options.ts';
import { createWeigher, type Reporter } from '../param-weight.ts';

type Settings = { max: number; bagPattern: string };
type Options = [Partial<Settings>];
type MessageIds = 'tooMany' | 'uncountable' | 'restBag';
type ParamCheck = {
  readonly context: Readonly<TSESLint.RuleContext<MessageIds, Options>>;
  readonly max: number;
  readonly weigh: (sig: Sig, onUncountable: Reporter) => number;
  readonly uncountable: Reporter;
};

// Overloads and abstract methods are signatures without a body: checked like implementations.
const SELECTORS = [...FN_SELECTORS, AST.TSDeclareFunction, AST.TSEmptyBodyFunctionExpression];

/** The rule's name, options and defaults (pinned by test/rule-specs.test.ts). */
export const RULE = {
  name: 'max-params',
  defaults: { max: 4, bagPattern: DEFAULT_BAG_PATTERN },
  properties: {
    max: {
      type: 'integer',
      minimum: 0,
      description: 'Most parameters a function takes, counting option and prop keys. Default 4.',
    },
    bagPattern: {
      type: 'string',
      description:
        'Regular expression for the names of option-bag types, whose members count one each. Default `(Props|Options|Opts|Params|Args)$`.',
    },
  },
} satisfies RuleSpec<Settings>;

/** `...rest` in a destructured parameter hides how many options are passed. */
const hasRest = (p: TSESTree.Parameter): boolean =>
  p.type === AST.ObjectPattern && p.properties.some((x) => x.type === AST.RestElement);

function check(fn: Sig, s: ParamCheck): void {
  for (const p of fn.params.filter(hasRest)) s.context.report({ node: p, messageId: 'restBag' });
  const n = s.weigh(fn, s.uncountable);
  const data = { n, max: s.max, name: fnName(fn) ?? '(anonymous function)' };
  if (n > s.max) s.context.report({ node: fn, messageId: 'tooMany', data });
}

/** Reports a bag whose keys cannot be counted. */
const reporterFor =
  (context: ParamCheck['context']): Reporter =>
  (t) => {
    const type = context.sourceCode.getText(t);
    context.report({ node: t, messageId: 'uncountable', data: { type } });
  };

const HANDLERS: Handlers<ParamCheck> = Object.fromEntries(SELECTORS.map((sel) => [sel, check]));

export default createRule<Options, MessageIds>({
  name: RULE.name,
  meta: {
    type: 'suggestion',
    docs: {
      description:
        'Enforce a parameter limit that counts option-object keys and props one each (Sandi Metz rule 3)',
    },
    schema: optionsSchema(RULE.properties),
    defaultOptions: [{}],
    messages: {
      tooMany:
        '{{name}} takes {{n}} parameters counting option/prop keys (max {{max}}). Introduce a parameter object or presentation model.',
      uncountable:
        'Cannot count the keys of `{{type}}`. Declare option/props types in this file as a type literal or interface without `extends`.',
      restBag:
        'Do not use `...rest` in a destructured parameter; it hides how many options/props are passed.',
    },
  },
  create(context, [given]) {
    const { max, bagPattern } = resolveOptions(context, RULE, given);
    const weigh = createWeigher(bagPattern, context.sourceCode.ast);
    return listen(HANDLERS, { context, max, weigh, uncountable: reporterFor(context) });
  },
});
