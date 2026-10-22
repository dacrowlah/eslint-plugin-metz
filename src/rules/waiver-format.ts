// metz/waiver-format — Rule zero: "break these rules only if you have a good reason or your pair
// lets you." Every eslint-disable directive that names a guarded rule (by default every rule) must:
//   - be `eslint-disable-next-line` (no block, file-wide or same-line disables), and
//   - carry a description `-- <marker> <reason of at least minReasonLength letters or digits>`.
// Also reported: inline `eslint` config comments and `eslint-enable` comments that name a guarded
// rule (only a next-line waiver may change one), and, unless allowPrettierIgnore, every
// `prettier-ignore` comment (Prettier only honours the bare comment, so it cannot carry a waiver;
// counted lines assume Prettier output).
// This rule is editor feedback: a comment can switch it off, so src/directives-check.ts (the
// metz-check-directives bin) is the gate, and it also reports a rule-less disable, which this rule
// ignores.
import { createRule } from '../create-rule.ts';
import { WAIVER_DEFAULTS } from '../directives.ts';
import { optionsSchema, resolveOptions, type RuleSpec } from '../options.ts';
import { type MessageIds, waiverListeners, type WaiverSettings } from '../waiver-checks.ts';

type Options = [Partial<WaiverSettings>];

/** The rule's name, options and defaults (pinned by test/rule-specs.test.ts). */
export const RULE = {
  name: 'waiver-format',
  defaults: { ...WAIVER_DEFAULTS, allowPrettierIgnore: false },
  properties: {
    minReasonLength: {
      type: 'integer',
      minimum: 1,
      description:
        'Fewest letters or digits the reason after the marker holds (spaces and punctuation do not count). Default 20.',
    },
    marker: {
      type: 'string',
      minLength: 1,
      description: "The label a waiver's `-- description` starts with. Default `WAIVER:`.",
    },
    guardedPrefixes: {
      type: 'array',
      items: { type: 'string' },
      description:
        'Rule id prefixes that need a waiver to disable (`metz/`, `boundaries/`). Default `[""]`: every rule.',
    },
    allowPrettierIgnore: {
      type: 'boolean',
      description: 'Allow `prettier-ignore` comments, which cannot carry a waiver. Default false.',
    },
  },
} satisfies RuleSpec<WaiverSettings>;

export default createRule<Options, MessageIds>({
  name: RULE.name,
  meta: {
    type: 'problem',
    docs: {
      description:
        'Require every rule waiver to be a next-line disable with a written reason (Sandi Metz rule zero)',
    },
    schema: optionsSchema(RULE.properties),
    defaultOptions: [{}],
    messages: {
      nextLineOnly: 'Waive {{rules}} only with `eslint-disable-next-line`, one site at a time.',
      inlineConfig:
        'Do not change {{rules}} with `/* eslint */` or `eslint-enable` comments. Only a next-line waiver may.',
      prettierIgnore:
        '`prettier-ignore` is banned: it defeats counted lines, and Prettier ignores a waiver reason on it. Format the code instead.',
      missingWaiver:
        'Disabling {{rules}} needs `-- {{marker}} <reason, at least {{min}} letters or digits>`.',
    },
  },
  create(context, [given]) {
    return waiverListeners(context, resolveOptions(context, RULE, given));
  },
});
