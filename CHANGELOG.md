# Changelog

All notable changes to this package are recorded here. The format follows
[Keep a Changelog](https://keepachangelog.com/en/1.1.0/), and the package follows
[Semantic Versioning](https://semver.org/spec/v2.0.0.html) with the policy in the
[README's Versioning section](README.md#versioning).

## [Unreleased]

## [1.0.0] - 2026-10-24

The first stable release. No rule, preset, option, message or export changed.

### Added

- An "Adopting in an existing codebase" guide in the README (freeze findings with ESLint bulk
  suppressions, touch it and fix it, a CI script that enforces it) and suggested instructions for
  a team's `CLAUDE.md` or `AGENTS.md`.

### Changed

- From this release the README's Versioning policy applies in full: a change that can make a
  passing lint fail is a major release.
- The README documents installing from npm only; the git-install section is removed.

## [0.1.3] - 2026-10-22

Patch: internal only; no rule, preset, option, message or export changed.

### Changed

- The name a report gives an unnamed function, `(anonymous function)`, has one home
  (`reportedName` in `src/ast.ts`), shared by `max-counted-lines` and `max-params`. Reports are
  unchanged.
- The release process drops its finished first-publish steps; every release publishes from GitHub
  Actions through trusted publishing, with provenance. No change to the package.
- Pull requests from branches of this repository get an automated Claude code review
  (`.github/workflows/claude-code-review.yml`). No change to the package.

## [0.1.2] - 2026-10-22

The first release published from GitHub Actions through npm trusted publishing, with provenance.
Patch: the release workflow only; no rule, preset or export changed.

### Fixed

- The release workflow hands npm the tarball as `./release/…`; without the `./`, npm read the path
  as a GitHub repository, and the v0.1.1 run's `publish` job failed (0.1.1 itself was published by
  hand). Its `pack` job now dry-runs that publish command. No change to the package.

## [0.1.1] - 2026-10-22

The first release on npm. Patch: documentation and packaging only; no rule, preset or export
changed.

### Fixed

- The README shows how to use a preset in a plain exported config array: spread it
  (`export default [...metz.configs.strict]`). A preset is an array, and an unspread one fails with
  `TypeError: Unexpected array`; `defineConfig([metz.configs.strict])` is unchanged.

### Changed

- Published to the public npm registry as `eslint-plugin-metz`, and the repository is public.
  Install with `pnpm add -D eslint-plugin-metz`; the git-tag install still works. Releases
  published from GitHub Actions through npm trusted publishing carry provenance.

## [0.1.0] - 2026-10-21

First standalone release.

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

[Unreleased]: https://github.com/dacrowlah/eslint-plugin-metz/compare/v1.0.0...HEAD
[1.0.0]: https://github.com/dacrowlah/eslint-plugin-metz/compare/v0.1.3...v1.0.0
[0.1.3]: https://github.com/dacrowlah/eslint-plugin-metz/compare/v0.1.2...v0.1.3
[0.1.2]: https://github.com/dacrowlah/eslint-plugin-metz/compare/v0.1.1...v0.1.2
[0.1.1]: https://github.com/dacrowlah/eslint-plugin-metz/compare/v0.1.0...v0.1.1
[0.1.0]: https://github.com/dacrowlah/eslint-plugin-metz/releases/tag/v0.1.0
