# eslint-plugin-metz

ESLint rules for [Sandi Metz's rules for developers](https://thoughtbot.com/blog/sandi-metz-rules-for-developers):
small files, five-line functions, four parameters (option keys count), one component per file, one
view model per screen, and waivers that carry a written reason. For ESLint 10 flat config, in
JavaScript and TypeScript, with React and React Native support.

- [Install](#install)
- [Usage](#usage)
- [Presets](#presets)
- [Overrides](#overrides)
- [Customizing](#customizing)
- [Rules](#rules)
- [The directive checker](#the-directive-checker)
- [Migration](#migration)
- [Why these rules](#why-these-rules)
- [Versioning](#versioning)

## Install

Requirements: ESLint 10 (flat config only), Node.js `^22.13.0 || >=24` (Node 20 reached end of
life in April 2026), and `@typescript-eslint/parser` 8 with TypeScript, which the rules and the
directive checker parse with.

The package is ESM-only, and ESLint loads it from any config file. From CommonJS, `require()` (Node
22.12 and later) returns the module namespace, so take the plugin from `default`:
`const metz = require('eslint-plugin-metz').default;`.

```sh
pnpm add -D eslint-plugin-metz eslint typescript-eslint @typescript-eslint/parser typescript@~6.0
```

`typescript-eslint` is what the [Usage](#usage) examples configure TypeScript with; the plugin
itself needs only the parser. TypeScript stays on 6.0 (the package's `typescript` peer range), since
typescript-eslint 8 does not support TypeScript 7 yet.

Releases published to npm from GitHub Actions carry
[provenance](https://docs.npmjs.com/generating-provenance-statements); check them with
`npm audit signatures`.

## Usage

```js
// eslint.config.js
import { defineConfig } from 'eslint/config';
import tseslint from 'typescript-eslint';
import metz from 'eslint-plugin-metz';

export default defineConfig([
  tseslint.configs.recommended,
  metz.configs.strict, // or 'recommended', 'strict-react', 'recommended-react'
]);
```

Each preset is an array of config objects. `defineConfig` flattens nested arrays; a plain exported
array does not, so there you spread the preset (an unspread one fails with `TypeError: Unexpected
array`):

```js
// eslint.config.js, without defineConfig
import tseslint from 'typescript-eslint';
import metz from 'eslint-plugin-metz';

export default [...tseslint.configs.recommended, ...metz.configs.strict];
```

Every preset registers the plugin under `metz`, so its rules are `metz/<rule>`, and you can also
name it yourself (`plugins: { metz }`): the presets reference the same plugin object.

## Presets

| Preset              | Severity | Limits                                                                                  | Waiver policy | React rules                                              |
| ------------------- | -------- | --------------------------------------------------------------------------------------- | ------------- | -------------------------------------------------------- |
| `strict`            | error    | Sandi Metz's numbers: file 100, function 5, 4 parameters; a component's logic 5, JSX 15 | on            | —                                                        |
| `recommended`       | warn     | the same numbers                                                                        | off           | —                                                        |
| `strict-react`      | error    | as `strict`                                                                             | on            | one component per file, JSX depth 3, one view-model hook |
| `recommended-react` | warn     | as `recommended`                                                                        | off           | as `strict-react`, as warnings                           |

Every preset also carries the [override blocks](#overrides): longer limits for test files, and none
for tool config files and `.d.ts` files.

- **`strict`** is Sandi Metz's numbers as errors, with rule zero enforced by
  [`metz/waiver-format`](docs/rules/waiver-format.md). The component limits (logic 5, JSX 15) are
  part of [`max-counted-lines`](docs/rules/max-counted-lines.md), so they apply in every preset.
- **`recommended`** is the gentle way in: the same numbers, as **warnings**, and no waiver policy.
  Warnings show every place the code breaks a rule, in the editor and in `eslint` output, without
  failing a run ([ESLint: "warn" is for a rule you intend to make an error](https://eslint.org/docs/latest/use/configure/rules#rule-severities));
  the numbers stay Metz's, because loosened numbers would be invented ones. See
  [Migration](#migration) for ratcheting it down to `strict`.
- **The React variants** add [`metz/component-shape`](docs/rules/component-shape.md) (one component
  per file, no render helpers, JSX depth 3) on `.jsx`/`.tsx` files and
  [`metz/screen-view-model`](docs/rules/screen-view-model.md) on screen files
  (`*Screen.jsx`/`*Screen.tsx`), test files excepted.

Every preset is an array of named flat-config objects (spread it into a plain config array; see
[Usage](#usage)). A change to any preset follows [Versioning](#versioning).

## Overrides

Each preset includes override blocks for the usual exceptions, each named, each with an exported
glob:

| Block                            | Files (export)                                            | What changes                                                                                       |
| -------------------------------- | --------------------------------------------------------- | -------------------------------------------------------------------------------------------------- |
| `metz/<preset>/tests`            | `TEST_FILES`: `**/*.{test,spec}.*`, `**/__tests__/**`     | `max-counted-lines` with `TEST_LIMITS`: file 150, function 10, `describe`/`suite` callbacks exempt |
| `metz/<preset>/config-files`     | `CONFIG_FILES`: `**/*.config.{js,cjs,mjs,ts,cts,mts}`     | `max-counted-lines` and `max-params` off: tool config files are data                               |
| `metz/<preset>/declarations`     | `DECLARATION_FILES`: `**/*.d.{ts,mts,cts}`                | `max-counted-lines` and `max-params` off: their shape is someone else's API                        |
| `metz/<preset>-react/components` | `JSX_FILES`: `**/*.{jsx,tsx}`, less `TEST_FILES`          | `component-shape` on                                                                               |
| `metz/<preset>-react/screens`    | `SCREEN_FILES`: `**/*Screen.{jsx,tsx}`, less `TEST_FILES` | `screen-view-model` on                                                                             |

`CONFIG_FILES` is narrow on purpose: a JSX file named `*.config.tsx` and a dotfile such as
`.babelrc.ts` hold code, so they keep every limit. **It matches at any depth**: `src/app.config.ts`
or `src/routes.config.ts` is exempt from the line and parameter limits too. To exempt only the tool
config files at your repository root, drop the block by name and add your own:

```js
...metz.configs.strict.filter((block) => block.name !== 'metz/strict/config-files'),
{
  files: ['*.config.{js,cjs,mjs,ts,cts,mts}'],
  rules: { 'metz/max-counted-lines': 'off', 'metz/max-params': 'off' },
},
```

`SCREEN_FILES` follows `screen-view-model`'s
default `screenSuffix` (`Screen`): if you change the suffix, replace the `screens` block with your
own glob. The exported globs and `TEST_LIMITS` are frozen, because every preset uses those very
values; spread them into your own arrays.

To **extend** an override, add a block with the exported values; to **replace** one, drop it by name
and add your own:

```js
import metz, { TEST_FILES, TEST_LIMITS } from 'eslint-plugin-metz';

export default defineConfig([
  // Drop the test block, then treat stories like tests too.
  metz.configs.strict.filter((block) => block.name !== 'metz/strict/tests'),
  {
    files: [...TEST_FILES, '**/*.stories.tsx'],
    rules: { 'metz/max-counted-lines': ['error', { ...TEST_LIMITS, function: 12 }] },
  },
]);
```

Static presets plus exported building blocks are what ESLint's plugin guide describes (configs are
plain flat-config objects under `configs`), and they compose with `defineConfig`, `extends` and
`files` like any other config, so no factory function is needed.

## Customizing

Every limit is a rule option, validated by the rule's schema: a misspelt option is an error.
To set a limit once for every preset block, use ESLint's
[shared settings](https://eslint.org/docs/latest/use/configure/configuration-files#configure-shared-settings),
namespaced under `metz` and keyed by rule, with exactly the rule's options:

```js
export default defineConfig([
  metz.configs.strict,
  {
    settings: {
      metz: {
        'max-counted-lines': { file: 120 },
        'max-params': { bagPattern: '(Props|Options|Config)$' },
        'waiver-format': { marker: 'WAIVER:', minReasonLength: 30 },
      },
    },
  },
]);
```

**Precedence**, for each option on its own:

1. the rule's own option in the config (`'metz/max-params': ['error', { max: 3 }]`);
2. the shared setting `settings.metz["<rule>"].<option>`;
3. the rule's default (Sandi Metz's number).

So the presets' test block, which sets `TEST_LIMITS` as rule options, keeps them over shared
settings, and shared settings fill in the rest. **Set limits in shared settings, not as rule
options in a later block:** ESLint replaces a rule's options wholesale, so a later
`'metz/max-counted-lines': ['error', { file: 120 }]` with no `files` also replaces `TEST_LIMITS` for
test files (back to function 5, `describe` no longer exempt).

Shared settings are validated against the same schema as the rule's options; an unknown rule name,
an unknown option (`toString` included) or a value of the wrong type throws when the rule runs.
Settings of a rule that no block turns on are not read, so they are not checked either.

## Rules

<!-- begin auto-generated rules list -->

💼 [Configurations](https://github.com/dacrowlah/eslint-plugin-metz#presets) enabled in.\
⚠️ [Configurations](https://github.com/dacrowlah/eslint-plugin-metz#presets) set to warn in.\
✅ Set in the `recommended` [configuration](https://github.com/dacrowlah/eslint-plugin-metz#presets).\
⚛️ Set in the `recommended-react` [configuration](https://github.com/dacrowlah/eslint-plugin-metz#presets).\
🔒 Set in the `strict` [configuration](https://github.com/dacrowlah/eslint-plugin-metz#presets).\
🛡️ Set in the `strict-react` [configuration](https://github.com/dacrowlah/eslint-plugin-metz#presets).\
⚙️ Has configuration options.

| Name                                                 | Description                                                                                         | 💼    | ⚠️    | ⚙️  |
| :--------------------------------------------------- | :-------------------------------------------------------------------------------------------------- | :---- | :---- | :-- |
| [component-shape](docs/rules/component-shape.md)     | Enforce one component per file, no render helpers or nested components, and a JSX depth limit       | 🛡️    | ⚛️    | ⚙️  |
| [max-counted-lines](docs/rules/max-counted-lines.md) | Enforce counted-line limits per file, function and component (Sandi Metz rules 1 and 2)             | 🔒 🛡️ | ✅ ⚛️ | ⚙️  |
| [max-params](docs/rules/max-params.md)               | Enforce a parameter limit that counts option-object keys and props one each (Sandi Metz rule 3)     | 🔒 🛡️ | ✅ ⚛️ | ⚙️  |
| [screen-view-model](docs/rules/screen-view-model.md) | Require a screen to call exactly one view-model hook and never reach through it (Sandi Metz rule 4) | 🛡️    | ⚛️    | ⚙️  |
| [waiver-format](docs/rules/waiver-format.md)         | Require every rule waiver to be a next-line disable with a written reason (Sandi Metz rule zero)    | 🔒 🛡️ |       | ⚙️  |

<!-- end auto-generated rules list -->

## The directive checker

`metz/waiver-format` is editor feedback: an inline comment can switch it off. The gate is a CLI that
reads every comment itself, the way ESLint does, and is a fail-closed allow-list: the only ESLint
directive allowed is `eslint-disable-next-line <named rules> -- <marker> <reason>`. It reports block
and same-line disables, `eslint-enable`, inline config comments, a rule-less disable, any directive
naming the waiver rule itself (whatever `--guarded-prefix` says), and any `eslint…` comment ESLint
cannot parse. With `--guarded-prefix`, a directive naming only unguarded rules is left alone.

```sh
metz-check-directives [--min-reason-length <n>] [--marker <text>] \
  [--guarded-prefix <prefix>]... [--waiver-rule <rule>] <path>...
```

It checks every `.ts`, `.tsx`, `.mts`, `.cts`, `.js`, `.jsx`, `.mjs` and `.cjs` file under each
directory once (overlapping paths are read once), skipping `node_modules`, `.git` and `.stryker-tmp` everywhere and `dist`, `coverage`,
`.turbo`, `.expo` and `.wrangler` beside a `package.json` (name a directory explicitly to check one
of those). A file named on the command line must have one of those extensions. A dangling link
named like a code file is reported as a finding (its target is missing, so it cannot be checked);
any other dangling link is ignored. `--marker` and
`--waiver-rule` must not be empty. Exit status: 0 clean, 1 forbidden directives found, 2 a usage
error, a missing or unsupported path, or a symlink loop. Run it in CI next to ESLint:

```json
"scripts": { "lint": "eslint . && metz-check-directives src test" }
```

The same check is a function: `import { findForbiddenDirectives } from 'eslint-plugin-metz/directives'`.

## Migration

Adopting the rules in an existing codebase:

1. **See the size of it.** Start with `recommended` (or `recommended-react`): every break is a
   warning, and nothing fails.
2. **Stop the growth.** Run ESLint with `--max-warnings <today's count>` in CI, and lower the number
   as you go.
3. **Switch to `strict`, with the waiver policy still off**, when the warnings are gone: add
   `{ rules: { 'metz/waiver-format': 'off' } }` after it. To switch earlier, use ESLint's
   [bulk suppressions](https://eslint.org/docs/latest/use/suppressions): with `strict` on, run
   `eslint --suppress-all` once and commit `eslint-suppressions.json`; new code must pass, existing
   violations stay recorded, and `eslint --prune-suppressions` drops each one you fix. (Suppressions
   apply only to rules at `"error"`, which is why they pair with `strict`.)
4. **Turn the waiver policy on last:** remove that `'off'` line, rewrite each remaining disable as a
   reasoned `eslint-disable-next-line`, and add `metz-check-directives` to CI.

To raise one limit while you migrate, set it in shared settings and lower it step by step.

## Why these rules

In 2013 Sandi Metz gave the developers she was coaching four rules, as recorded by Caleb Hearth in
[Sandi Metz' Rules For Developers](https://thoughtbot.com/blog/sandi-metz-rules-for-developers)
(thoughtbot):

1. "Classes can be no longer than one hundred lines of code."
2. "Methods can be no longer than five lines of code."
3. "Pass no more than four parameters into a method. Hash options are parameters."
4. "Controllers can instantiate only one object. Therefore, views can only know about one instance
   variable and views should only send messages to that object."

And rule zero: "You should break these rules only if you have a good reason or your pair lets you."

The rules stand in for what _Practical Object-Oriented Design_ asks of code: small public
interfaces, single responsibilities, visible dependencies, code that is cheap to change. This
plugin measures the first three in **counted lines** of Prettier-formatted code
([`max-counted-lines`](docs/rules/max-counted-lines.md)) and in parameters with option keys counted
([`max-params`](docs/rules/max-params.md)); treats a React component as the "class" of a UI
([`component-shape`](docs/rules/component-shape.md)); reads rule 4 for screens and their view-model
hooks ([`screen-view-model`](docs/rules/screen-view-model.md)); and turns rule zero into reasoned
waivers ([`waiver-format`](docs/rules/waiver-format.md)). The rules are Sandi Metz's; this plugin is
an independent implementation and is not endorsed by her.

## Versioning

This is the package's one semver policy; the changelog links here.
The package follows [Semantic Versioning](https://semver.org/):

| Kind      | The change                                                                                                                                                                                                                                                                                                                                                                    |
| --------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| **Major** | Anything that can make a passing lint fail or a config stop loading: a new rule in a preset; a stricter value in a preset or a changed default; a new error a rule reports on code it accepted; a removed or renamed option, rule, preset, override block, glob or export; a narrowed glob; a raised minimum ESLint, Node, `@typescript-eslint/parser` or TypeScript version. |
| **Minor** | A new rule outside the presets; a new option whose default keeps today's behaviour; a new preset or export; fewer reports.                                                                                                                                                                                                                                                    |
| **Patch** | A false positive or a crash fixed; docs.                                                                                                                                                                                                                                                                                                                                      |

Every change is recorded in [CHANGELOG.md](CHANGELOG.md).

## License

[MIT](LICENSE) © Ryan Crowley
