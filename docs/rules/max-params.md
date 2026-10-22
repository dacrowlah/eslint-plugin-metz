# metz/max-params

📝 Enforce a parameter limit that counts option-object keys and props one each (Sandi Metz rule 3).

💼⚠️ This rule is enabled in the following [configs](https://github.com/dacrowlah/eslint-plugin-metz#presets): 🔒 `strict`, 🛡️ `strict-react`. This rule _warns_ in the following [configs](https://github.com/dacrowlah/eslint-plugin-metz#presets): ✅ `recommended`, ⚛️ `recommended-react`.

<!-- end auto-generated rule header -->

Sandi Metz's rule 3: "Pass no more than four parameters into a method. Hash options are
parameters." Option keys and props count one each.

## Rule details

How much a parameter weighs:

- a positional parameter: 1;
- a destructured object parameter: one per key (`({ a, b, c })` is 3), nested keys counting their
  leaves (`{ opts: { a, b } }` is 2); an array pattern, one per element;
- an inline type literal: one per member (an index signature is one member);
- a tuple-typed rest parameter (`...args: [a: A, b: B]`): one per element;
- a named **option bag**, a type whose name matches `bagPattern` (by default ending in `Props`,
  `Options`, `Opts`, `Params` or `Args`): one per member. It must be declared in the same file as a
  type literal or an interface without `extends`; otherwise its keys cannot be counted and the rule
  reports it (`uncountable`). Generic wrappers (`Readonly`, `Partial`, `Required`, `NonNullable`,
  `PropsWithChildren`, `PropsWithoutRef`, `PropsWithRef`) count as what they wrap; a union bag counts
  its widest member; `Pick<B, 'a' | 'b'>` counts its keys and `Omit<B, …>` the rest (at least 1);
- a generic parameter counts as its constraint (`<P extends CardProps>(p: P)`);
- a component typed through its context counts its props: `const Card: FC<CardProps> = (p) => …`,
  through `memo`, `forwardRef`, `satisfies` and `as` too;
- any other named type (`Race`, `RacerRowModel`) is a parameter object and counts **1**. That is the
  sanctioned fix when you are over the limit.

`...rest` in a destructured parameter is reported (`restBag`): it hides how many options are passed.
Overload signatures, abstract methods and `declare function` are checked like implementations.

```ts
type CardProps = { title: string; body: string; footer: string; onPress: () => void; icon: Icon };
// ❌ CardProps has 5 members
function Card(props: CardProps) {}

// ❌ 5 parameters
function draw(x: number, y: number, w: number, h: number, color: string) {}

// ✅ a parameter object counts 1
type Rect = { x: number; y: number; w: number; h: number };
function draw(rect: Rect, color: string) {}
```

## Options

<!-- begin auto-generated rule options list -->

| Name         | Description                                                                                                                          | Type    |
| :----------- | :----------------------------------------------------------------------------------------------------------------------------------- | :------ |
| `bagPattern` | Regular expression for the names of option-bag types, whose members count one each. Default `(Props\|Options\|Opts\|Params\|Args)$`. | String  |
| `max`        | Most parameters a function takes, counting option and prop keys. Default 4.                                                          | Integer |

<!-- end auto-generated rule options list -->

Each option can also be set in shared settings, under `settings.metz["max-params"]` (README,
"Customizing").

## When not to use it

At a boundary whose signature is fixed by a platform (`fetch(request, env, ctx)` in a Worker): waive
the one site with a reasoned `eslint-disable-next-line` (see [`metz/waiver-format`](waiver-format.md)).
