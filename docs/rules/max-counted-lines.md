# metz/max-counted-lines

📝 Enforce counted-line limits per file, function and component (Sandi Metz rules 1 and 2).

💼⚠️ This rule is enabled in the following [configs](https://github.com/dacrowlah/eslint-plugin-metz#presets): 🔒 `strict`, 🛡️ `strict-react`. This rule _warns_ in the following [configs](https://github.com/dacrowlah/eslint-plugin-metz#presets): ✅ `recommended`, ⚛️ `recommended-react`.

<!-- end auto-generated rule header -->

Sandi Metz's rules 1 and 2, "Classes can be no longer than one hundred lines of code" and
"Methods can be no longer than five lines of code", measured in **counted lines** of
Prettier-formatted code.

## Rule details

A physical line is **counted** when it holds at least one token that is not:

- a comment (a JSX comment, `{/* … */}`, is a comment too);
- closing or separator punctuation: `}` `)` `]` `;` `,` `>` `/`;
- part of a JSX closing tag;
- part of an `import` or `export … from` declaration (in the file count).

Blank lines never count, and a multi-line token (a template literal, JSX text) counts each of its
non-blank lines. A function's count covers its **body only**: the signature never counts, even when
Prettier wraps it. The lines of nested callbacks count toward the outer function as well as their
own.

Four limits:

| Limit            | Measures                                                                                  | Default |
| ---------------- | ----------------------------------------------------------------------------------------- | ------- |
| `file`           | the whole module, imports and re-exports excluded                                         | 100     |
| `function`       | the body of any function, method, hook or class `static {}` block that is not a component | 5       |
| `componentLogic` | a component's body before its final JSX `return`, plus every condition inside that return | 5       |
| `componentJsx`   | the rest of the component's final JSX `return`                                            | 15      |

A **component** is a PascalCase function that returns JSX. Its _logic_ budget includes every
condition anywhere in its returned JSX: a `?:` test, a branch that is neither JSX nor a literal, and
the left operand of `&&`, `||` and `??` (`<View>{ok && <A />}</View>`, `label={ok ? x : y}`,
`style={[s.row, active && s.active]}`). Nothing inside a nested function's body counts toward it: an
`onPress` arrow's body is its own. A line holding both a condition and JSX counts in both budgets.

Examples with the defaults:

```ts
// ❌ move has 6 counted lines (max 5): the signature and the closing brace never count
function move(racer: Racer, by: number) {
  const from = racer.space;
  const to = Math.min(from + by, FINISH);
  if (to === FINISH) finish(racer);
  log(racer, from, to);
  const moved = { ...racer, space: to };
  return moved;
}
```

```ts
// ✅ 4 counted lines
function move(racer: Racer, by: number) {
  const to = Math.min(racer.space + by, FINISH);
  if (to === FINISH) finish(racer);
  log(racer, racer.space, to);
  return { ...racer, space: to };
}
```

Format with Prettier before you count: the counts assume its output, which is why
[`metz/waiver-format`](waiver-format.md) reports `prettier-ignore` by default.

## Options

<!-- begin auto-generated rule options list -->

| Name                | Description                                                                                                                                          | Type     |
| :------------------ | :--------------------------------------------------------------------------------------------------------------------------------------------------- | :------- |
| `componentJsx`      | Most counted lines of a component's final JSX `return`. Default 15.                                                                                  | Integer  |
| `componentLogic`    | Most counted lines of a component's logic: its body before the final JSX `return`, plus every condition inside that return. Default 5.               | Integer  |
| `exemptCallbacksOf` | Callees whose callbacks are not measured, matched by the name a call starts from (`describe` also matches `describe.each(rows)(...)`). Default none. | String[] |
| `file`              | Most counted lines in a module, imports and re-exports excluded. Default 100.                                                                        | Integer  |
| `function`          | Most counted lines in the body of a function, method, hook or `static {}` block that is not a component. Default 5.                                  | Integer  |

<!-- end auto-generated rule options list -->

Each option can also be set once for every preset block in shared settings, under
`settings.metz["max-counted-lines"]`; a rule option wins over a shared setting, which wins over the
default (see the README, "Customizing").

`exemptCallbacksOf` lists callees whose callbacks are not measured at all, matched by the name a
call starts from: `describe` also matches `describe.skip(...)` and `describe.each(rows)(...)`, but
not `x.describe(...)`. The presets' test-file block exempts `describe` and `suite`, whose callbacks
are containers, not methods.

## When not to use it

When a team has not agreed to Sandi Metz's rules. To adopt them gradually, use the `recommended`
preset (warnings) or ESLint's bulk suppressions with `strict` (README, "Migration").
