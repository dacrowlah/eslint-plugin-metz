// metz/max-counted-lines — Sandi Metz rules 1 & 2 measured in counted lines (CL).
//   file            : whole module, imports/re-exports excluded            (default 100)
//   function        : body of any non-component function / method / hook,
//                     and of a class `static {}` block                      (default 5)
//   componentLogic  : component body minus its final `return <jsx/>`, plus every condition
//                     anywhere in that return (a `?:` test, a non-JSX branch that is not a
//                     literal, the left operand of `&&` / `||` / `??`), but not inside a nested
//                     function's body                                       (default 5)
//   componentJsx    : the rest of the final `return <jsx/>` statement      (default 15)
// A JSX comment (`{/* ... */}`) is a comment: it never counts.
import { createRule } from '../create-rule.ts';
import { HANDLERS, type LineLimits } from '../line-limits.ts';
import { listen } from '../listen.ts';
import { optionsSchema, resolveOptions, type RuleSpec } from '../options.ts';

type Options = [Partial<LineLimits>];
type MessageIds = 'file' | 'function' | 'componentLogic' | 'componentJsx';

/** The rule's name, options and defaults (pinned by test/rule-specs.test.ts). */
export const RULE = {
  name: 'max-counted-lines',
  defaults: { file: 100, function: 5, componentLogic: 5, componentJsx: 15, exemptCallbacksOf: [] },
  properties: {
    file: {
      type: 'integer',
      minimum: 1,
      description: 'Most counted lines in a module, imports and re-exports excluded. Default 100.',
    },
    function: {
      type: 'integer',
      minimum: 1,
      description:
        'Most counted lines in the body of a function, method, hook or `static {}` block that is not a component. Default 5.',
    },
    componentLogic: {
      type: 'integer',
      minimum: 0,
      description:
        "Most counted lines of a component's logic: its body before the final JSX `return`, plus every condition inside that return. Default 5.",
    },
    componentJsx: {
      type: 'integer',
      minimum: 1,
      description: "Most counted lines of a component's final JSX `return`. Default 15.",
    },
    exemptCallbacksOf: {
      type: 'array',
      items: { type: 'string' },
      description:
        'Callees whose callbacks are not measured, matched by the name a call starts from (`describe` also matches `describe.each(rows)(...)`). Default none.',
    },
  },
} satisfies RuleSpec<LineLimits>;

export default createRule<Options, MessageIds>({
  name: RULE.name,
  meta: {
    type: 'suggestion',
    docs: {
      description:
        'Enforce counted-line limits per file, function and component (Sandi Metz rules 1 and 2)',
    },
    schema: optionsSchema(RULE.properties),
    defaultOptions: [{}],
    messages: {
      file: 'Module has {{n}} counted lines (max {{max}}). Extract a collaborator module.',
      function:
        '{{name}} has {{n}} counted lines (max {{max}}). Extract smaller, well-named functions.',
      componentLogic:
        'Component {{name}} has {{n}} counted lines of logic before its JSX (max {{max}}). Move logic into its view-model hook or a pure presenter.',
      componentJsx:
        'Component {{name}} returns {{n}} counted lines of JSX (max {{max}}). Extract subcomponents (one per file).',
    },
  },
  create(context, [given]) {
    const limits = resolveOptions(context, RULE, given);
    const source = context.sourceCode;
    return listen(HANDLERS, { context, source, limits, skip: new Set<number>(), stack: [] });
  },
});
