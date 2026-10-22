import rule from '../src/rules/max-params.ts';
import { ruleTester, tsx } from './setup.ts';

ruleTester.run('max-params', rule, {
  valid: [
    // Outside a bag, an imported named type is a parameter object: it counts 1.
    "import type { Five } from './five';\nexport function f(p: Five, q: Readonly<Five>, a: A, b: B) {}",
    'function canonical(value: { readonly [key: string]: Json }, a: A, b: B, c: C) {}', // an inline dictionary is one member
    'type Json = string | { readonly [key: string]: Json };\nfunction canonical(value: Json, a: A, b: B, c: C) {}',
    'type HeaderProps = { title: string; insets: { top: number; bottom: number; left: number; right: number } };\nexport function Header(p: HeaderProps, a: A, b: B) {}',
    'function f(p: { opts: { a: A; b: B; c: C; d: D; e: E } }) {}',
    'function f(...args: string[]) {}',
    'function f({ a, b }: { a: A; b: B }, [c, d]: [C, D]) {}',
    'type CardProps = { a: A };\nexport function Card(p: PropsWithChildren<CardProps>) {}',
    'function f(a: number, b: number, c: number, d: number) {}',
    'function move(state: RaceState, move: Move) {}', // named domain types are parameter objects: 1 each
    'function f(this: void, a: A, b: B, c: C, d: D) {}',
    'function f({ a, b }: { a: A; b: B }, c: C, d: D) {}',
    tsx(
      'type RowProps = { row: RowModel; onPress: () => void };\nexport function Row({ row, onPress }: RowProps) { return <V />; }',
    ),
    tsx(
      'interface RowProps { row: RowModel }\nexport function Row(props: Readonly<RowProps>) { return <V />; }',
    ),
  ],
  invalid: [
    {
      code: 'type XOptions = Readonly<{ [k: string]: V }>;\nexport function f(p: XOptions) {}',
      errors: [{ messageId: 'uncountable' }],
    },
    // A bag whose body is a type declared elsewhere has keys this file cannot count.
    {
      code: "import type { Five } from './five';\ntype RunOptions = Readonly<Five>;\nexport function f(p: RunOptions) {}",
      errors: [{ messageId: 'uncountable' }],
    },
    {
      code: "import type { Dict } from './dict';\ntype RunOptions = Dict;\nexport function f(p: RunOptions) {}",
      errors: [{ messageId: 'uncountable' }],
    },
    {
      code: "import type * as T from './t';\ntype RunOptions = Readonly<T.Five>;\nexport function f(p: RunOptions) {}",
      errors: [{ messageId: 'uncountable' }],
    },
    // A Record or an index-signature alias has unknowable keys, however the bag wraps it.
    {
      code: 'type RunOptions = Record<string, number>;\nexport function f(p: RunOptions) {}',
      errors: [{ messageId: 'uncountable' }],
    },
    {
      code: 'type RunOptions = Readonly<Record<string, number>>;\nexport function f(p: RunOptions) {}',
      errors: [{ messageId: 'uncountable' }],
    },
    {
      code: 'type Dict = { readonly [k: string]: number };\ntype RunOptions = Readonly<Dict>;\nexport function f(p: RunOptions) {}',
      errors: [{ messageId: 'uncountable' }],
    },
    {
      code: 'type Dict = { readonly [k: string]: number };\ntype RunOptions = Dict;\nexport function f(p: RunOptions) {}',
      errors: [{ messageId: 'uncountable' }],
    },
    {
      code: 'type Base = { a: A; b: B; c: C };\ntype RunOptions = Readonly<Base> & { d: D; e: E };\nexport function f(p: RunOptions) {}',
      errors: [{ messageId: 'tooMany' }],
    },
    {
      code: 'type XOptions = { a: A } & { [k: string]: V };\nexport function f(p: XOptions) {}',
      errors: [{ messageId: 'uncountable' }],
    },
    {
      code: 'type XOptions = { a: A } | Partial<{ [k: string]: V }>;\nexport function f(p: XOptions) {}',
      errors: [{ messageId: 'uncountable' }],
    },
    {
      code: 'function f(bag: { a: A; b: B; [key: string]: Json }, c: C, d: D) {}',
      errors: [{ messageId: 'tooMany', data: { n: 5, max: 4, name: 'f' } }],
    },
    {
      code: 'type CardProps = { a: A; b: B; c: C; d: D; e: E };\nexport function Card(p: PropsWithChildren<CardProps>) {}',
      errors: [{ messageId: 'tooMany', data: { n: 5, max: 4, name: 'Card' } }],
    },
    {
      code: 'type MoveOptions = { a: A; b: B; c: C; d: D; e: E };\nexport function move(o: Partial<MoveOptions>) {}',
      errors: [{ messageId: 'tooMany', data: { n: 5, max: 4, name: 'move' } }],
    },
    {
      code: 'type CardProps = { a: A; b: B; c: C; d: D; e: E };\nexport function Card<P extends CardProps>(p: P) {}',
      errors: [{ messageId: 'tooMany', data: { n: 5, max: 4, name: 'Card' } }],
    },
    {
      code: "type CardProps = { k: 'a'; a: A; b: B; c: C; d: D } | { k: 'b'; e: E; f: F; g: G; h: H; i: I };\nexport function Card(p: CardProps) {}",
      errors: [{ messageId: 'tooMany', data: { n: 6, max: 4, name: 'Card' } }],
    },
    {
      code: 'type CardProps = { [K in Keys]: string };\nexport function Card(p: CardProps) {}',
      errors: [{ messageId: 'uncountable' }],
    },
    {
      code: 'type CardProps = { [key: string]: unknown };\nexport function Card(p: CardProps) {}',
      errors: [{ messageId: 'uncountable' }],
    },
    {
      code: 'export function move([a, b, c, d, e]) {}',
      errors: [{ messageId: 'tooMany', data: { n: 5, max: 4, name: 'move' } }],
    },
    {
      code: 'export function move([a, b]: readonly [A, B, C, D, E]) {}',
      errors: [{ messageId: 'tooMany', data: { n: 5, max: 4, name: 'move' } }],
    },
    {
      code: 'export function move(...args: [a: A, b: B, c: C, d: D, e: E]) {}',
      errors: [{ messageId: 'tooMany', data: { n: 5, max: 4, name: 'move' } }],
    },
    {
      code: 'export function move({ opts: { a, b, c, d, e } }) {}',
      errors: [{ messageId: 'tooMany', data: { n: 5, max: 4, name: 'move' } }],
    },
    {
      code: 'export function move(a: A, b: B, c: C, d: D, e: E): void;\nexport function move(...args: unknown[]) {}',
      errors: [{ messageId: 'tooMany', data: { n: 5, max: 4, name: 'move' } }],
    },
    {
      code: 'declare function move(a: A, b: B, c: C, d: D, e: E): void;',
      errors: [{ messageId: 'tooMany', data: { n: 5, max: 4, name: 'move' } }],
    },
    {
      code: 'function f(a, b, c, d, e) {}',
      errors: [{ messageId: 'tooMany', data: { n: 5, max: 4, name: 'f' } }],
    },
    {
      code: 'function f(a: A, opts: { x: X; y: Y; z: Z }) {}',
      errors: [{ messageId: 'tooMany', data: { n: 4, max: 3, name: 'f' } }],
      options: [{ max: 3, bagPattern: '(Props|Options|Opts|Params|Args)$' }],
    },
    {
      code: 'const f = ({ a, b, c, d, e }) => a;',
      errors: [{ messageId: 'tooMany', data: { n: 5, max: 4, name: 'f' } }],
    },
    {
      ...tsx(
        'type CardProps = { a: A; b: B; c: C; d: D; e: E };\nexport function Card(p: CardProps) { return <V />; }',
      ),
      errors: [{ messageId: 'tooMany', data: { n: 5, max: 4, name: 'Card' } }],
    },
    {
      ...tsx(
        'import type { CardProps } from "./x";\nexport function Card(p: CardProps) { return <V />; }',
      ),
      errors: [{ messageId: 'uncountable' }],
    },
    {
      ...tsx(
        'interface CardProps extends ViewProps { a: A }\nexport function Card(p: CardProps) { return <V />; }',
      ),
      errors: [{ messageId: 'uncountable' }],
    },
    {
      ...tsx('export function Card(p: React.ComponentProps<typeof View>) { return <V />; }'),
      errors: [{ messageId: 'uncountable' }],
    },
    {
      ...tsx(
        'type CardProps = { a: A };\nexport function Card({ a, ...rest }: CardProps) { return <V />; }',
      ),
      errors: [{ messageId: 'restBag' }],
    },
  ],
});
