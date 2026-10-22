---
name: release-plugin
description: Use when cutting, tagging or shipping a new version of eslint-plugin-metz, when asked to "release", "bump the version", "tag vX.Y.Z" or "publish", or when a consumer needs a newer plugin version.
---

# Releasing eslint-plugin-metz

## Overview

A release is an annotated tag `vX.Y.Z` on `main` of the private repository
`github.com/dacrowlah/eslint-plugin-metz`. Consumers install the tag as a git dependency, which pnpm
builds on install through `prepare`. There is no npm publish yet. **The version is decided by the
semver policy in `README.md` "Versioning", never by the size of the diff.**

Pushing and publishing are the owner's: each needs the owner's OK in this conversation, unless the
owner already gave it for this release.

## Steps

1. **Decide the bump.** Read `git log v<last>..HEAD` and `CHANGELOG.md` `Unreleased`. Name the
   kind of every change from the policy in `README.md` "Versioning" (its one home), and take the
   highest. Unsure whether a change can fail a passing lint? It can: treat it as breaking.

2. **Update the changelog.** Move `Unreleased` into `## [X.Y.Z] - <today>`, grouped under
   Added / Changed / Fixed / Removed, each breaking entry marked **Breaking** with its migration.
   Update the compare links at the bottom.

3. **Bump the version** in `package.json` only (`meta.version` and the docs URLs read it):
   `corepack pnpm version X.Y.Z --no-git-tag-version`. Run `corepack pnpm docs:generate` (rule docs link to
   `blob/vX.Y.Z/...`).

4. **Run every gate**, each with its output read, exit 0:

   ```bash
   pgrep -fl stryker   # nothing else may be mutating
   corepack pnpm check > /tmp/check.log 2>&1; echo "exit=$?"; tail -30 /tmp/check.log
   corepack pnpm mutate > /tmp/mutate.log 2>&1; echo "exit=$?"; tail -40 /tmp/mutate.log
   ```

   `pnpm mutate` must report a 100 mutation score (its break threshold). Any survivor blocks the
   release: add the killing test, or ask the owner about a waiver.

5. **Review, then commit.** Stage the release (`git add -A`) and have a general and an adversarial
   review of the staged diff (CLAUDE.md, owner's preferences); fix what they find and rerun step 4.
   Only then commit the bump, authored `Ryan Crowley <dacrowlah@gmail.com>`:
   `git commit -am "release: vX.Y.Z"`. Then the **annotated** tag:
   `git tag -a vX.Y.Z -m "eslint-plugin-metz vX.Y.Z"`. A lightweight tag is wrong: `git describe`
   and GitHub releases read the annotation.

6. **Ask the owner** to push (unless already approved for this release), then
   `git push origin main && git push origin vX.Y.Z`.

7. **Verify the tag installs** from GitHub in a throwaway project:

   ```bash
   dir=$(mktemp -d) && cd "$dir"
   printf '{"type":"module","devDependencies":{"eslint-plugin-metz":"github:dacrowlah/eslint-plugin-metz#vX.Y.Z","eslint":"^10","@typescript-eslint/parser":"^8","typescript":"~6.0"}}' > package.json
   printf "allowBuilds:\n  'eslint-plugin-metz@git+https://github.com/dacrowlah/eslint-plugin-metz.git': true\n" > pnpm-workspace.yaml
   corepack pnpm install && ls node_modules/eslint-plugin-metz/dist/index.js
   node -e "import('eslint-plugin-metz').then((m) => console.log(m.default.meta))"
   ```

   The meta must print `version: 'X.Y.Z'`. If pnpm prints `ERR_PNPM_GIT_DEP_PREPARE_NOT_ALLOWED`,
   use the `allowBuilds` key it prints.

8. **Bump consumers**, each as its own reviewed change in that repository, under that repository's
   rules (its own checks and reviews before commit). Change the
   `#vX.Y.Z` in its dependency, run `corepack pnpm install`, and for a breaking release apply the
   CHANGELOG's migration there.

## Later: npm or GitHub Packages (owner's OK first)

Publishing is a separate decision for the owner. When approved: the first `npm publish` is manual
(`npm publish --access public`, with 2FA), since npm trusted publishing is configured on an existing
package; then add a trusted publisher (GitHub Actions, workflow `release.yml`, `id-token: write`,
npm CLI ≥ 11.5.1), which publishes with provenance. Consumers then switch from the `github:` spec to
`^X.Y.Z` and drop the `allowBuilds` entry.

## Common mistakes

- Choosing the bump from how big the diff looks; a one-line default change is breaking.
- Tagging before `pnpm check` and `pnpm mutate` pass on the release commit.
- A lightweight tag, or a tag on a commit that is not on `main`.
- Editing `meta.version` or docs URLs by hand: they come from `package.json`.
- Bumping a consumer in the same change as the release, or without that repository's review.
