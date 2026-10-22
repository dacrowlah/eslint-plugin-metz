// Why the directive checker (directives-check.ts) forbids a directive, and what it says. The only
// ESLint directive allowed is `eslint-disable-next-line <named rule(s)> -- <marker> <reason>`;
// a directive naming only unguarded rules is left alone.
import { type Directive, guardedRules, WAIVER_DEFAULTS, waiverReasonLength } from './directives.ts';

export type Reason =
  | 'config'
  | 'enable'
  | 'block-disable'
  | 'line-disable'
  | 'blanket'
  | 'self-disable'
  | 'missing-description'
  | 'missing-waiver'
  | 'unparseable'
  | 'parse-error';

/** The checker's waiver policy; every field is optional, and an absent one takes its default. */
export type CheckPolicy = {
  /** Fewest letters or digits a waiver's reason holds. Default 20. */
  readonly minReasonLength?: number | undefined;
  /** The label a waiver's description starts with. Default `WAIVER:`. */
  readonly marker?: string | undefined;
  /** Rule id prefixes that need a waiver. Default `['']`: every rule. */
  readonly guardedPrefixes?: readonly string[] | undefined;
  /** The rule that polices waivers, which no comment may name. Default `metz/waiver-format`. */
  readonly waiverRule?: string | undefined;
};
export type Resolved = Required<{ readonly [K in keyof CheckPolicy]: NonNullable<CheckPolicy[K]> }>;

/** The checker's defaults: the waiver policy's, and the waiver rule under the `metz` namespace. */
export const CHECK_DEFAULTS: Resolved = { ...WAIVER_DEFAULTS, waiverRule: 'metz/waiver-format' };

export const resolvePolicy = (p: CheckPolicy): Resolved => ({
  minReasonLength: p.minReasonLength ?? CHECK_DEFAULTS.minReasonLength,
  marker: p.marker ?? CHECK_DEFAULTS.marker,
  guardedPrefixes: p.guardedPrefixes ?? CHECK_DEFAULTS.guardedPrefixes,
  waiverRule: p.waiverRule ?? CHECK_DEFAULTS.waiverRule,
});

const MESSAGES: Record<Reason, string> = {
  config: 'inline `eslint` config comments are forbidden',
  enable: '`eslint-enable` is forbidden',
  'block-disable':
    'block `eslint-disable` is forbidden; use `// eslint-disable-next-line <rule> -- <reason>`',
  'line-disable':
    '`eslint-disable-line` is forbidden; use `// eslint-disable-next-line <rule> -- <reason>`',
  blanket: '`eslint-disable-next-line` must name the rule(s) it waives',
  'self-disable': '{{rule}} may not be disabled by a comment',
  'missing-description': '`eslint-disable-next-line` needs `-- <description>`',
  'missing-waiver':
    'waiving a rule needs `-- {{marker}} <reason of at least {{min}} letters or digits>`',
  unparseable: 'this directive-like comment cannot be parsed by ESLint, so it cannot be checked',
  'parse-error': 'cannot parse this file, so its directives cannot be checked',
};

export const messageOf = (reason: Reason, o: Resolved): string =>
  MESSAGES[reason]
    .replace('{{min}}', String(o.minReasonLength))
    .replace('{{marker}}', o.marker)
    .replace('{{rule}}', o.waiverRule);

const isGuarded = (d: Directive, o: Resolved): boolean =>
  guardedRules(d.rules, o.guardedPrefixes).length > 0;

/** A guarded next-line waiver needs a description that is a reason after the marker. */
function waiverReason(d: Directive, o: Resolved): Reason | null {
  if (d.description === '') return 'missing-description';
  return waiverReasonLength(d.description, o.marker) < o.minReasonLength ? 'missing-waiver' : null;
}

function nextLineReason(d: Directive, o: Resolved): Reason | null {
  if (d.rules.length === 0) return 'blanket';
  if (d.rules.includes(o.waiverRule)) return 'self-disable';
  return isGuarded(d, o) ? waiverReason(d, o) : null;
}

/** kind -> reason for forbidden kinds; the only allowed kinds (next-line, no-effect ones) are absent. */
const FORBIDDEN_KINDS = new Map<string, Reason>([
  ['eslint', 'config'],
  ['eslint-enable', 'enable'],
  ['eslint-disable', 'block-disable'],
  ['eslint-disable-line', 'line-disable'],
]);

/** Directives that do not change rule behaviour. */
const INERT_KINDS = new Set(['eslint-env']);

/** A forbidden kind is allowed only when every rule it names is unguarded and none is the waiver
 * rule itself (protected whatever is guarded); naming none, it reaches every rule. Any other
 * `eslint…` label is one ESLint cannot parse. */
function otherReason(d: Directive, o: Resolved): Reason | null {
  const forbidden = FORBIDDEN_KINDS.get(d.kind);
  if (forbidden) return reachesGuarded(d, o) ? forbidden : null;
  return isUnparseable(d) ? 'unparseable' : null;
}
const reachesGuarded = (d: Directive, o: Resolved): boolean =>
  d.rules.length === 0 || d.rules.includes(o.waiverRule) || isGuarded(d, o);
const isUnparseable = (d: Directive): boolean =>
  d.kind.startsWith('eslint') && !INERT_KINDS.has(d.kind);

/** Why a directive is forbidden, or null when it is allowed. */
export const reasonFor = (d: Directive, o: Resolved): Reason | null =>
  d.kind === 'eslint-disable-next-line' ? nextLineReason(d, o) : otherReason(d, o);
