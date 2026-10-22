# metz/screen-view-model

📝 Require a screen to call exactly one view-model hook and never reach through it (Sandi Metz rule 4).

💼⚠️ This rule is enabled in the 🛡️ `strict-react` [config](https://github.com/dacrowlah/eslint-plugin-metz#presets). This rule _warns_ in the ⚛️ `recommended-react` [config](https://github.com/dacrowlah/eslint-plugin-metz#presets).

<!-- end auto-generated rule header -->

Sandi Metz's rule 4 for React screens: "Controllers can instantiate only one object. Therefore,
views can only know about one instance variable and views should only send messages to that
object." A screen gets everything from one view-model hook, and only passes its slices on.

## Rule details

Apply this rule to screen files only: the React presets use `SCREEN_FILES` (`**/*Screen.{jsx,tsx}`). That
glob follows the default `screenSuffix`; if you change the suffix, replace the presets' `screens`
block with a glob for your own names.

- A screen calls **exactly one hook** (`exactlyOne`), and it must match `viewModelPattern`
  (`notViewModel`). Hooks are recognised under any local name: an aliased import, a default import
  named for its module (`import query from './useQuery'`), a variable holding one, and React 19's
  bare `use(...)`.
- The view model is bound to **one identifier**, or destructured **one level deep** (`binding`).
- It may be used only as `vm.x`, as `vm.x()`, or passed whole to the screen's own view.
  Everything else **reaches through** it (`reachThrough`): `vm.a.b`, `vm.a!.b`, `(vm.a as A).b`,
  `vm.getA().b`, a slice bound to a local and read (`const b = vm.board; b.cells`), through a fallback
  or choice (`vm.board ?? EMPTY`), destructured again, looped over, aliased, or passed to a function.
  `typeof vm` in a type position is fine.
- It is never spread into JSX (`spread`), and only the screen's **own view** takes it whole
  (`wholeViewModel`): the screen's name without `screenSuffix`, plus `viewSuffix` (`RaceScreen` →
  `RaceView`).
- A default-exported anonymous function is the screen, and goes by its file's name.

```tsx
// ❌ two hooks, and a read through the view model
export function RaceScreen() {
  const vm = useRaceViewModel();
  const theme = useTheme();
  return <Board cells={vm.board.cells} />;
}
```

```tsx
// ✅ one view-model hook; slices passed on; the whole view model only to RaceView
export function RaceScreen() {
  const vm = useRaceViewModel();
  return <RaceView vm={vm} />;
}
```

## Options

<!-- begin auto-generated rule options list -->

| Name               | Description                                                                                                       | Type   |
| :----------------- | :---------------------------------------------------------------------------------------------------------------- | :----- |
| `screenSuffix`     | Suffix removed from a screen's name to name its own view (`RaceScreen` -> `Race`). Default `Screen`.              | String |
| `viewModelPattern` | Regular expression the screen's one hook must match. Default `^use[A-Z]\w*ViewModel$`.                            | String |
| `viewSuffix`       | Suffix added to name the one component that may take the whole view model (`Race` -> `RaceView`). Default `View`. | String |

<!-- end auto-generated rule options list -->

Each option can also be set in shared settings, under `settings.metz["screen-view-model"]`
(README, "Customizing").
