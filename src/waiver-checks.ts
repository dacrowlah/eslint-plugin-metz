// The listener of metz/waiver-format: every comment, read as ESLint reads directives, checked
// against the waiver policy, and every `prettier-ignore` unless it is allowed.
import type { TSESLint, TSESTree } from '@typescript-eslint/utils';
import { type Directive, guardedRules, parseDirective, waiverReasonLength } from './directives.ts';
import { type Handlers, listen } from './listen.ts';

export type WaiverSettings = {
  minReasonLength: number;
  marker: string;
  guardedPrefixes: readonly string[];
  allowPrettierIgnore: boolean;
};
export type MessageIds = 'nextLineOnly' | 'missingWaiver' | 'inlineConfig' | 'prettierIgnore';
type Waivers = {
  readonly context: Readonly<TSESLint.RuleContext<MessageIds, [Partial<WaiverSettings>]>>;
  readonly source: TSESLint.SourceCode;
  readonly settings: WaiverSettings;
};

const PRETTIER = /^\s*prettier-ignore(?:-start|-end)?(?:\s|$)/;
const INLINE_CONFIG = new Set(['eslint', 'eslint-enable']);

/** What a directive naming a guarded rule breaks: only a next-line disable may change a rule, and
 * it needs a waiver reason. */
function problemsOf(d: Directive, o: WaiverSettings): MessageIds[] {
  if (INLINE_CONFIG.has(d.kind)) return ['inlineConfig'];
  const kind: MessageIds[] = d.kind === 'eslint-disable-next-line' ? [] : ['nextLineOnly'];
  const short = waiverReasonLength(d.description, o.marker) < o.minReasonLength;
  return short ? [...kind, 'missingWaiver'] : kind;
}

/** The rules a message names, and the policy it states. */
const dataOf = (rules: readonly string[], { minReasonLength, marker }: WaiverSettings) => ({
  rules: rules.join(', '),
  min: minReasonLength,
  marker,
});

type Data = ReturnType<typeof dataOf>;

function reportAll(
  comment: TSESTree.Comment,
  problems: MessageIds[],
  data: Data,
  s: Waivers,
): void {
  for (const messageId of problems) s.context.report({ loc: comment.loc, messageId, data });
}

/** A directive is checked when it names a guarded rule. */
function checkGuarded(comment: TSESTree.Comment, d: Directive, s: Waivers): void {
  const rules = guardedRules(d.rules, s.settings.guardedPrefixes);
  if (rules.length > 0) reportAll(comment, problemsOf(d, s.settings), dataOf(rules, s.settings), s);
}

function checkDirective(comment: TSESTree.Comment, s: Waivers): void {
  const d = parseDirective(comment);
  if (d) checkGuarded(comment, d, s);
}

function checkPrettier(comment: TSESTree.Comment, s: Waivers): void {
  if (!s.settings.allowPrettierIgnore && PRETTIER.test(comment.value))
    s.context.report({ loc: comment.loc, messageId: 'prettierIgnore' });
}

const HANDLERS: Handlers<Waivers> = {
  Program: (_: TSESTree.Program, s: Waivers) => {
    for (const c of s.source.getAllComments()) {
      checkDirective(c, s);
      checkPrettier(c, s);
    }
  },
};

/** The listener for one file, under `settings`. */
export const waiverListeners = (
  context: Waivers['context'],
  settings: WaiverSettings,
): TSESLint.RuleListener => listen(HANDLERS, { context, source: context.sourceCode, settings });
