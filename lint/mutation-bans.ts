import { syntaxBans } from './tag.ts';

const ban = syntaxBans('mutation');

/** Code Stryker would mutate: a function, an operator, a condition, a call, an interpolation. */
const CODE = [
  'BinaryExpression',
  'LogicalExpression',
  'ConditionalExpression',
  'CallExpression',
  'NewExpression',
  'UpdateExpression',
  'UnaryExpression',
  'TemplateLiteral[expressions.length>0]',
  ':function',
].join(', ');

/**
 * Bans for source StrykerJS mutates. Its instrumenter (10.0.0) counts every `as` expression as a
 * type and skips its whole subtree, so code inside `x as T` or `{ … } as const satisfies T` is
 * never mutated, and `pnpm mutate` still passes a file with other killable code. Cast only a plain
 * value: a name, a member, a literal, or a literal object or array of those. Test files are not
 * mutated.
 */
export const MUTATION_SYNTAX_BANS = [
  ban(
    'no-code-in-as',
    `TSAsExpression :matches(${CODE})`,
    'Stryker mutates nothing inside an `as` expression: compute the value first and cast only a plain value (a name, a member or a literal), or annotate the table (`const t: T = {...}`) or use `satisfies` alone.',
  ),
];
