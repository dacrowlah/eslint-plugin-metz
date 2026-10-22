# metz/waiver-format

📝 Require every rule waiver to be a next-line disable with a written reason (Sandi Metz rule zero).

💼 This rule is enabled in the following [configs](https://github.com/dacrowlah/eslint-plugin-metz#presets): 🔒 `strict`, 🛡️ `strict-react`.

<!-- end auto-generated rule header -->

Sandi Metz's rule zero: "You should break these rules only if you have a good reason or your pair
lets you." A rule is broken one site at a time, with the reason written down.

## Rule details

Every directive that names a **guarded** rule (by default, every rule) must be an
`eslint-disable-next-line` (`nextLineOnly`) whose description is the **marker** followed by a
**reason** of at least `minReasonLength` letters or digits (`missingWaiver`):

```ts
// eslint-disable-next-line metz/max-params -- WAIVER: Workers fetch(request, env, ctx) is fixed by the platform
export default { fetch(request: Request, env: Env, ctx: Context, extra: Extra) {} };
```

Spaces, punctuation, zero-width characters and comment decoration do not count toward the reason.
Inline config comments and `eslint-enable` that name a guarded rule are reported
(`inlineConfig`): only a next-line waiver may change a rule. Unless `allowPrettierIgnore` is set,
every `prettier-ignore` comment is reported too (`prettierIgnore`): Prettier honours only the bare
comment, so it cannot carry a reason, and counted lines assume Prettier output.

This rule is editor feedback. A comment can switch it off, so the gate is the
`metz-check-directives` CLI (README, "The directive checker"), which reads the comments itself and
also reports a rule-less disable and any directive naming the waiver rule, in every form and
whatever `guardedPrefixes` says.

```ts
// ❌ block disable; no reason; a reason without the marker; too short
/* eslint-disable max-lines */
// eslint-disable-next-line complexity
// eslint-disable-next-line complexity -- legacy
// eslint-disable-next-line complexity -- WAIVER: legacy
```

The waiver policy is opt-in: `strict` turns this rule on, `recommended` leaves it off.

## Options

<!-- begin auto-generated rule options list -->

| Name                  | Description                                                                                                   | Type     |
| :-------------------- | :------------------------------------------------------------------------------------------------------------ | :------- |
| `allowPrettierIgnore` | Allow `prettier-ignore` comments, which cannot carry a waiver. Default false.                                 | Boolean  |
| `guardedPrefixes`     | Rule id prefixes that need a waiver to disable (`metz/`, `boundaries/`). Default `[""]`: every rule.          | String[] |
| `marker`              | The label a waiver's `-- description` starts with. Default `WAIVER:`.                                         | String   |
| `minReasonLength`     | Fewest letters or digits the reason after the marker holds (spaces and punctuation do not count). Default 20. | Integer  |

<!-- end auto-generated rule options list -->

- `guardedPrefixes`: rule ids starting with one of these need a waiver. The default `[""]` guards
  every rule; `["metz/", "boundaries/"]` guards only those plugins' rules, and leaves directives
  that name only other rules alone.
- `marker`: the label the description starts with, `WAIVER:` by default; it must not be empty.
- `minReasonLength`: the fewest letters or digits after the marker, 20 by default.

Each option can also be set in shared settings, under `settings.metz["waiver-format"]` (README,
"Customizing"). Pass the same policy to the directive checker with its flags.
