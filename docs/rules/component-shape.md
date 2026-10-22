# metz/component-shape

📝 Enforce one component per file, no render helpers or nested components, and a JSX depth limit.

💼⚠️ This rule is enabled in the 🛡️ `strict-react` [config](https://github.com/dacrowlah/eslint-plugin-metz#presets). This rule _warns_ in the ⚛️ `recommended-react` [config](https://github.com/dacrowlah/eslint-plugin-metz#presets).

<!-- end auto-generated rule header -->

Components are the "classes" of a React UI, so Sandi Metz's one-class-per-file applies to them: one
component per file, no render helpers, no components inside components, and shallow JSX.

## Rule details

- Exactly **one component per file**: a module-level, PascalCase function that returns JSX
  (`onePerFile`). A module-level function returning JSX must be named PascalCase (`renderHelper`)
  and must not be anonymous (`anonymous`).
- **No other function may return JSX**: no `renderX()` helpers (`renderHelper`) and no component
  defined inside another scope (`nestedComponent`). A function counts as returning JSX when
  anything it returns can be JSX: directly, through a local variable (destructuring at any depth,
  assignments, index writes, `push`), an array, a conditional, a lookup table read by key
  (`ICONS[kind]`), `xs.map((x) => <X />)`, `Array.from`, `Array.of`, `fill`, `concat`, or
  `as` / `satisfies` / `!`.
- The one exception is an **inline arrow** whose body is JSX (or a choice between JSX and nothing),
  handed to a non-hook call or a JSX attribute: `rows.map((r) => <Row key={r.id} row={r} />)`,
  `renderItem={({ item }) => <Row row={item} />}`, or a property of an object handed over that way
  (`screenOptions={{ headerRight: () => <Btn /> }}`). `memo(() => <X />)` is a component, and a
  `useCallback`/`useMemo` callback is not the exception.
- **JSX depth** inside one return is limited (`jsxDepth`); the root element is depth 0.

```tsx
// ❌ a render helper, and a second component
function renderRow(row: Row) {
  return <RacerRow row={row} />;
}
export function Board() {
  return <List>{rows.map(renderRow)}</List>;
}
export function Footer() {
  return <Text>end</Text>;
}
```

```tsx
// ✅ Board.tsx: one component, an inline arrow, RacerRow and Footer in their own files
export function Board({ rows }: BoardProps) {
  return (
    <List>
      {rows.map((row) => (
        <RacerRow key={row.id} row={row} />
      ))}
    </List>
  );
}
```

The React presets apply this rule to `.jsx` and `.tsx` files that are not tests (`JSX_FILES`, less
`TEST_FILES`).

## Options

<!-- begin auto-generated rule options list -->

| Name          | Description                                                                       | Type    |
| :------------ | :-------------------------------------------------------------------------------- | :------ |
| `maxJsxDepth` | Deepest JSX nesting inside one return, the root element being depth 0. Default 3. | Integer |

<!-- end auto-generated rule options list -->

The option can also be set in shared settings, under `settings.metz["component-shape"]` (README,
"Customizing").
