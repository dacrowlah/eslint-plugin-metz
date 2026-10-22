// The directive gate. Inline directives can switch metz/waiver-format off, so a lint rule cannot
// police them; this checker reads the comments itself (TypeScript parser comment tokens, ESLint's own
// ConfigCommentParser) and runs outside ESLint's directive system. It is a fail-closed allow-list:
//
//   the only ESLint directive allowed is   eslint-disable-next-line <named rule(s)> -- <description>
//
// and its description must be `<marker> <reason>` with minReasonLength+ letters or digits. Forbidden:
// every `eslint` config comment, eslint-enable, block eslint-disable and eslint-disable-line that
// names a guarded rule or no rule at all, a rule-less eslint-disable-next-line, anything naming the
// waiver rule itself, and any `eslint-…` block comment ESLint cannot parse. A directive naming only
// unguarded rules (see guardedPrefixes) is left alone. `global`, `globals`, `exported` and
// `eslint-env` comments do not change rule behaviour and are left alone, and so is a line comment
// ESLint does not read as a directive (any label but eslint-disable-line and
// eslint-disable-next-line: `// eslint config lives at…` is prose).
import { parse } from '@typescript-eslint/parser';
import {
  type CheckPolicy,
  messageOf,
  type Reason,
  reasonFor,
  type Resolved,
  resolvePolicy,
} from './directive-reasons.ts';
import { type Directive, parseDirective } from './directives.ts';

export type { CheckPolicy, Reason } from './directive-reasons.ts';
export { CHECK_DEFAULTS } from './directive-reasons.ts';

export type DirectiveViolation = {
  line: number;
  column: number;
  reason: Reason;
  rules: string[];
  message: string;
};

type Comment = { type: string; value: string; loc: { start: { line: number; column: number } } };
type Found = { readonly comment: Comment; readonly directive: Directive; readonly reason: Reason };

function violation({ comment, directive, reason }: Found, o: Resolved): DirectiveViolation {
  const { line, column } = comment.loc.start;
  const message = messageOf(reason, o);
  return { line, column: column + 1, reason, rules: directive.rules, message };
}

/** The comment's directive and why it is forbidden, or nothing: not a directive, or allowed. */
function found(comment: Comment, o: Resolved): Found[] {
  const directive = parseDirective(comment);
  const reason = directive ? reasonFor(directive, o) : null;
  return directive && reason ? [{ comment, directive, reason }] : [];
}

/** The file's comments, with their locations (the parser reads JSX by the file's extension), or
 * null when the file does not parse. */
function commentsOf(source: string, filename: string): Comment[] | null {
  try {
    return parse(source, { filePath: filename }).comments;
  } catch {
    return null;
  }
}

/** A file that does not parse is one violation: its directives cannot be checked. */
const unparsed = (o: Resolved): DirectiveViolation[] => [
  { line: 1, column: 1, reason: 'parse-error', rules: [], message: messageOf('parse-error', o) },
];

/** Every forbidden directive comment in `source`, read as the file `filename`, under `policy`. */
export function findForbiddenDirectives(
  source: string,
  filename: string,
  policy: CheckPolicy = {},
): readonly DirectiveViolation[] {
  const o = resolvePolicy(policy);
  const comments = commentsOf(source, filename);
  return comments ? comments.flatMap((c) => found(c, o)).map((f) => violation(f, o)) : unparsed(o);
}
