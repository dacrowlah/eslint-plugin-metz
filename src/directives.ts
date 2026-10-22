// ESLint directive-comment parsing shared by metz/waiver-format (editor feedback) and the
// standalone directive checker (the gate). It uses ESLint's own ConfigCommentParser and ESLint's
// rule for line comments, so the plugin reads a comment exactly the way ESLint does.
import { ConfigCommentParser } from '@eslint/plugin-kit';

/** The waiver policy's defaults, shared by the rule and the checker. */
export const WAIVER_DEFAULTS = {
  /** The label a waiver's description starts with. */
  marker: 'WAIVER:',
  /** The fewest letters or digits a waiver's reason holds. */
  minReasonLength: 20,
  /** Rules whose id starts with one of these need a waiver; `''` guards every rule. */
  guardedPrefixes: [''],
};

/** ESLint's directive labels: eslint, eslint-env, eslint-enable, eslint-disable[-line|-next-line], global(s), exported. */
export type Directive = { kind: string; rules: string[]; description: string };

const parser = new ConfigCommentParser();
/** What a reason is measured in: spaces, punctuation, zero-width characters and comment
 * decoration pad a reason without saying anything. */
const LETTER_OR_DIGIT = /[\p{L}\p{N}]/gu;

/** How many letters and digits the reason after `marker` holds; 0 when the description does not
 * start with the marker. */
export function waiverReasonLength(description: string, marker: string): number {
  if (!description.startsWith(marker)) return 0;
  return description.slice(marker.length).match(LETTER_OR_DIGIT)?.length ?? 0;
}

/** The rules of `rules` whose id starts with one of `prefixes`. */
export const guardedRules = (rules: readonly string[], prefixes: readonly string[]): string[] =>
  rules.filter((rule) => prefixes.some((prefix) => rule.startsWith(prefix)));

/** In a line comment ESLint reads only these labels as directives (source-code.js). */
const LINE_KINDS = new Set(['eslint-disable-line', 'eslint-disable-next-line']);

function ruleNames(kind: string, value: string): string[] {
  if (kind === 'eslint') {
    const parsed = parser.parseJSONLikeConfig(value);
    return parsed.ok ? Object.keys(parsed.config) : [];
  }
  const lists = kind.startsWith('eslint-disable') || kind === 'eslint-enable';
  return lists ? Object.keys(parser.parseListConfig(value)) : [];
}

/** A comment as the parser returns it: its kind and its text without the delimiters. */
export type CommentText = { readonly type: string; readonly value: string };

/** The directive in a comment; null when ESLint would not see one there. */
export function parseDirective(comment: CommentText): Directive | null {
  const d = parser.parseDirective(comment.value);
  if (!d || (comment.type === 'Line' && !LINE_KINDS.has(d.label))) return null;
  return { kind: d.label, rules: ruleNames(d.label, d.value), description: d.justification };
}
