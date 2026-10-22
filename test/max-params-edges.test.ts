import rule from '../src/rules/max-params.ts';
import { ruleTester } from './setup.ts';

// Edges the main table leaves open: every transparent wrapper, readonly rest tuples, cycles and
// repeats of one bag, index signatures in a named bag, qualified bag names, intersections in a
// signature, `keyof`, nested destructuring and untyped rests.
const CARD = 'type CardProps = { a: A; b: B; c: C; d: D; e: E };\n';
const TOO_MANY = [{ messageId: 'tooMany' as const, data: { name: 'f', n: 5, max: 4 } }];
const uncountable = (type: string) => [{ messageId: 'uncountable' as const, data: { type } }];

ruleTester.run('max-params (edges)', rule, {
  valid: [
    'type XProps = { a: A };\nexport function f(p: XProps, q: XProps) {}',
    `${CARD}export function f(k: keyof CardProps) {}`,
    `${CARD}export function f(...args: CardProps) {}`,
    'export function f(...args) {}',
  ],
  invalid: [
    ...['Required', 'PropsWithoutRef', 'PropsWithRef'].map((w) => ({
      code: `${CARD}export function f(p: ${w}<CardProps>) {}`,
      errors: TOO_MANY,
    })),
    { code: 'export function f(...args: readonly [A, B, C, D, E]) {}', errors: TOO_MANY },
    // A destructured parameter weighs its type when the type has more members than it names.
    { code: 'export function f({ a }: { a: A; b: B; c: C; d: D; e: E }) {}', errors: TOO_MANY },
    { code: 'export function f([a]: [A, B, C, D, E]) {}', errors: TOO_MANY },
    {
      code: 'export default function (a: A, b: B, c: C, d: D, e: E) {}',
      errors: [{ messageId: 'tooMany', data: { name: '(anonymous function)', n: 5, max: 4 } }],
    },
    { code: 'export function f(p: { a: A; b: B } & { c: C; d: D; e: E }) {}', errors: TOO_MANY },
    { code: 'export function f({ a: [v, w, x, y, z] }) {}', errors: TOO_MANY },
    {
      code: 'type LoopProps = Readonly<LoopProps>;\nexport function f(p: LoopProps) {}',
      errors: uncountable('LoopProps'),
    },
    {
      code: 'type XProps = { a: A; [k: string]: V };\nexport function f(p: XProps) {}',
      errors: uncountable('XProps'),
    },
    {
      code: 'export function f<Props extends { a: A }>(p: NS.Props) {}',
      errors: uncountable('NS.Props'),
    },
    { code: `${CARD}export function f(p: NS.CardProps) {}`, errors: uncountable('NS.CardProps') },
  ],
});
