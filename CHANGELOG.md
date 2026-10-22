# Changelog

All notable changes to this package are recorded here. The format follows
[Keep a Changelog](https://keepachangelog.com/en/1.1.0/), and the package follows
[Semantic Versioning](https://semver.org/spec/v2.0.0.html) with the policy in the
[README's Versioning section](README.md#versioning).

## [Unreleased]

## [0.1.0] - 2026-10-21

First standalone release, extracted from an application monorepo, where the rules were developed
and mutation-tested.

### Added

- Rules: `max-counted-lines`, `max-params`, `component-shape`, `screen-view-model`,
  `waiver-format`.
- Presets: `recommended` (warnings), `strict` (errors and the waiver policy), and
  `recommended-react` / `strict-react`, each with named override blocks for test files, tool
  config files and `.d.ts` files.
- Shared settings: every rule option can be set once under `settings.metz["<rule>"]`, validated
  like rule options. Precedence: rule options, then shared settings, then defaults.
- Exported globs (`TEST_FILES`, `CONFIG_FILES`, `DECLARATION_FILES`, `JSX_FILES`, `SCREEN_FILES`)
  and `TEST_LIMITS`, frozen, for extending the overrides. `CONFIG_FILES` is
  `**/*.config.{js,cjs,mjs,ts,cts,mts}` only: JSX config files and dotfiles keep every limit.
- `waiver-format` options `marker` (non-empty), `guardedPrefixes` and `allowPrettierIgnore`;
  `screen-view-model` options `screenSuffix` and `viewSuffix`.
- The `metz-check-directives` bin and the `eslint-plugin-metz/directives` entry, the directive
  gate that runs outside ESLint, with flags for the same waiver policy. It protects the waiver rule
  itself in every directive form, whatever is guarded, and refuses a named file it cannot check.
- Requires ESLint 10 (flat config only), `@typescript-eslint/parser` 8 and Node.js
  `^22.13.0 || >=24`. ESM only.

[Unreleased]: https://github.com/dacrowlah/eslint-plugin-metz/compare/v0.1.0...HEAD
[0.1.0]: https://github.com/dacrowlah/eslint-plugin-metz/releases/tag/v0.1.0
