import rule from '../src/rules/max-params.ts';
import { ruleTester, tsx } from './setup.ts';

// Props and options laundered past the count: a bag whose body is not a literal, a utility type
// around a bag, a contextually typed component, a bound declared on an enclosing class or
// function, interface merging, class-method overloads and parameter properties.
const CARD = 'type CardProps = { a: A; b: B; c: C; d: D; e: E };\n';
const SIX = 'type CardProps = { a: A; b: B; c: C; d: D; e: E; f: F };\n';
const many = (name: string, n = 5) => [
  { messageId: 'tooMany' as const, data: { name, n, max: 4 } },
];
const uncountable = (type: string) => [{ messageId: 'uncountable' as const, data: { type } }];

ruleTester.run('max-params (laundering)', rule, {
  valid: [
    'type RaceState = { a: A; b: B; c: C; d: D; e: E };\nexport function f(s: Omit<RaceState, "a">) {}',
    `${CARD}export function f(p: Pick<CardProps, 'a' | 'b'>) {}`,
    'type XProps = { a: A } | null;\nexport function f(p: XProps) {}',
    tsx('type CardProps = { a: A };\nexport const Card: FC<CardProps> = (p) => <V />;'),
    tsx(`${CARD}export const Card: FC<CardProps> = (p: Small) => <V />;`),
    'type CardProps = { a: A };\nexport class C<P extends CardProps> {\n  m(p: P) {}\n}',
  ],
  invalid: [
    {
      code: 'const five = { a: 1, b: 2, c: 3, d: 4, e: 5 };\ntype RunOptions = typeof five;\nexport function f(p: RunOptions) {}',
      errors: uncountable('RunOptions'),
    },
    {
      code: "type Holder = { opts: { a: A; b: B; c: C; d: D; e: E } };\ntype RunOptions = Holder['opts'];\nexport function f(p: RunOptions) {}",
      errors: uncountable('RunOptions'),
    },
    {
      code: 'type RunOptions = keyof Holder;\nexport function f(p: RunOptions) {}',
      errors: uncountable('RunOptions'),
    },
    {
      code: "type CardProps = Record<'a' | 'b' | 'c' | 'd' | 'e', string>;\nexport function f(p: CardProps) {}",
      errors: uncountable('CardProps'),
    },
    { code: `${CARD}export function f(p: Omit<CardProps, never>) {}`, errors: many('f') },
    { code: `${CARD}export function f(p: NonNullable<CardProps>) {}`, errors: many('f') },
    { code: `${CARD}export function f(p: Pick<CardProps, keyof CardProps>) {}`, errors: many('f') },
    {
      code: `${CARD}export function f(p: Pick<CardProps, 'a' | 'b' | 'c' | 'd' | 'e'>) {}`,
      errors: many('f'),
    },
    { code: `${CARD}export function f(p: Extract<CardProps, object>) {}`, errors: many('f') },
    { ...tsx(`${CARD}export const Card: FC<CardProps> = (p) => <V />;`), errors: many('Card') },
    {
      ...tsx(`${CARD}export const Card: React.FunctionComponent<CardProps> = (p) => <V />;`),
      errors: many('Card'),
    },
    { code: `${CARD}export class C<P extends CardProps> {\n  m(p: P) {}\n}`, errors: many('m') },
    {
      code: `${CARD}export function outer<P extends CardProps>() {\n  return (p: P) => p;\n}`,
      errors: many('(anonymous function)'),
    },
    {
      code: 'interface CardProps { a: A; b: B; c: C }\ninterface CardProps { d: D; e: E }\nexport function f(p: CardProps) {}',
      errors: many('f'),
    },
    {
      code: `${CARD}export class C {\n  m(p: CardProps): void;\n  m(p: unknown) {}\n}`,
      errors: many('m'),
    },
    {
      code: `${CARD}export abstract class C {\n  abstract m(p: CardProps): void;\n}`,
      errors: many('m'),
    },
    {
      code: 'type RunOptions = { a: A; b: B; c: C; d: D; e: E };\nexport class C {\n  constructor(private readonly o: RunOptions) {}\n}',
      errors: many('constructor'),
    },
  ],
});

// The edges of each new count: every narrowing and component type, the keys a `Pick` names, the
// empty members of a union bag, only the first parameter of a component, and a shadowed bound.
ruleTester.run('max-params (laundering edges)', rule, {
  valid: [
    `${CARD}export function f(p: Pick<CardProps, 'a'>) {}`,
    `${SIX}export function f(p: Omit<CardProps, 'a' | 'b' | 'c'>) {}`,
    // An unconstrained inner type parameter shadows the outer bound.
    `${CARD}export class C<P extends CardProps> {\n  m<P>(p: P) {}\n}`,
    tsx(`${CARD}export const Card = forwardRef<View, Small>((p, ref) => <V />);`),
    'export function f(a = 1, { b } = o, [c] = xs, d = 4) {}',
    // Only memo hands its first argument on: another wrapper, or memo's comparator, is not props.
    tsx(`${CARD}export const Card: FC<CardProps> = wrap((p) => <V />);`),
    tsx(`${CARD}export const Card: FC<CardProps> = memo(Base, (a, b) => a === b);`),
    tsx('export function A() {\n  return <V onPress={(e) => f(e)} />;\n}'),
    // An unconstrained type parameter named like a bag is not the bag.
    `${CARD}export function f<CardProps>(p: CardProps) {}`,
    'export class C {\n  constructor(private a, private b = 2, c = 3) {}\n}',
    'type XProps = { a: A } | undefined;\nexport function f(p: XProps) {}',
    'type XProps = { a: A } | never;\nexport function f(p: XProps) {}',
    `${CARD}type Small = { a: A };\nexport class C<P extends CardProps> {\n  m<P extends Small>(p: P) {}\n}`,
  ],
  invalid: [
    { code: `${CARD}export function f(p: Exclude<CardProps, never>) {}`, errors: many('f') },
    { code: `${CARD}export function f(p: Pick<CardProps>) {}`, errors: many('f') },
    { code: `${CARD}export function f(p: Exclude<CardProps, 'a'>) {}`, errors: many('f') },
    {
      code: "type XProps = { [k: string]: V };\nexport function f(p: Omit<XProps, 'a'>) {}",
      errors: uncountable("Omit<XProps, 'a'>"),
    },
    // Omit of literal keys weighs the rest: 6 - 1.
    { code: `${SIX}export function f(p: Omit<CardProps, 'a'>) {}`, errors: many('f') },
    // Props through a wrapper: memo, forwardRef's second type argument, satisfies, as.
    {
      ...tsx(`${CARD}export const Card: FC<CardProps> = memo((p) => <V />);`),
      errors: many('Card'),
    },
    {
      ...tsx(`${CARD}export const Card = forwardRef<View, CardProps>((p, ref) => <V />);`),
      errors: many('Card', 6),
    },
    {
      ...tsx(`${CARD}export const Card = ((p) => <V />) satisfies FC<CardProps>;`),
      errors: many('Card'),
    },
    { ...tsx(`${CARD}export const Card = ((p) => <V />) as FC<CardProps>;`), errors: many('Card') },
    { ...tsx(`${CARD}export const Card = memo<CardProps>((p) => <V />);`), errors: many('Card') },
    // A defaulted first parameter is still the props.
    { ...tsx(`${CARD}export const Card: FC<CardProps> = (p = x) => <V />;`), errors: many('Card') },
    { code: `${CARD}export function f(p: Pick<CardProps, 'a' | Keys>) {}`, errors: many('f') },
    ...['VFC', 'VoidFunctionComponent', 'ComponentType'].map((type) => ({
      ...tsx(`${CARD}export const Card: ${type}<CardProps> = (p) => <V />;`),
      errors: many('Card'),
    })),
    {
      ...tsx(`${CARD}export const Card: FC<CardProps> = (p, extra) => <V />;`),
      errors: many('Card', 6),
    },
  ],
});
