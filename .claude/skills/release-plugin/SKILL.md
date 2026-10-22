---
name: release-plugin
description: Use when cutting, tagging or shipping a new version of eslint-plugin-metz, when asked to "release", "bump the version", "tag vX.Y.Z" or "publish", or when a consumer needs a newer plugin version.
---

# Releasing eslint-plugin-metz

## Overview

A release is an annotated tag `vX.Y.Z` on `main` of the public repository
`github.com/dacrowlah/eslint-plugin-metz`. Pushing the tag runs `.github/workflows/release.yml`,
which publishes the package to npm as `eslint-plugin-metz` through
[trusted publishing](https://docs.npmjs.com/trusted-publishers) (OIDC: no npm token exists
anywhere) with provenance. **The version is decided by the semver policy in `README.md`
"Versioning", never by the size of the diff.** This file is the one home of the release process.

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
   npm publish --dry-run --ignore-scripts   # files: only dist/, CHANGELOG.md, LICENSE,
                                            # README.md, package.json; no npm warning
   ```

   `pnpm mutate` must report a 100 mutation score (its break threshold). Any survivor blocks the
   release: add the killing test, or ask the owner about a waiver.

   Then **run the README as a user would**, since it is the npm landing page and ships frozen with
   the version: its install line verbatim (only the plugin pointed at the packed tarball), then
   ESLint with each Usage example. Both must exit 1 with exactly one `metz/max-counted-lines`
   finding; a crash (exit 2) means the README does not work as written (unpinned, the line once
   installed TypeScript 7, which typescript-eslint 8 refuses).

   ````bash
   repo=$PWD dir=$(mktemp -d)
   npm pack --ignore-scripts --pack-destination "$dir" >/dev/null 2>&1
   cd "$dir" && echo '{"type":"module"}' > package.json && mkdir src
   printf 'export function six() {\n  g(1);\n  g(2);\n  g(3);\n  g(4);\n  g(5);\n  g(6);\n}\n' > src/six.js
   install=$(sed -n '/^```sh$/{n;p;q;}' "$repo/README.md") && echo "$install"
   eval "${install/eslint-plugin-metz /eslint-plugin-metz@file:$(echo "$dir"/*.tgz) }"
   awk '/^```js$/{f=1;n++;next} /^```$/{f=0} f{print > ("usage" n ".js")}' "$repo/README.md"
   for n in 1 2; do cp "usage$n.js" eslint.config.js; npx eslint src > out.txt 2>&1
     echo "usage $n: exit $?, $(grep -c metz/max-counted-lines out.txt) finding(s)"; done
   cd "$repo"
   ````

5. **Review, then commit.** Stage the release (`git add -A`) and have a general and an adversarial
   review of the staged diff (CLAUDE.md, owner's preferences); fix what they find and rerun step 4.
   Only then commit the bump, authored `Ryan Crowley <dacrowlah@gmail.com>`:
   `git commit -am "release: vX.Y.Z"`. Then the **annotated** tag:
   `git tag -a vX.Y.Z -m "eslint-plugin-metz vX.Y.Z"`. A lightweight tag is wrong: `git describe`
   and GitHub releases read the annotation.

6. **Ask the owner** to push (unless already approved for this release), then
   `git push origin main && git push origin vX.Y.Z`. The tag push starts the `Release` workflow
   (`.github/workflows/release.yml`: its header and step names say what it checks and does).
   Watch it:
   `gh run watch --exit-status $(gh run list --workflow release.yml --limit 1 --json databaseId --jq '.[0].databaseId')`.
   If `pack` fails, nothing was published: fix, and cut a new patch version (or, with the owner's
   OK, move the unpublished tag). Once npm has a version it never accepts it again.

7. **Verify the published package** in a throwaway project:

   ```bash
   npm view eslint-plugin-metz@X.Y.Z version dist.attestations.provenance
   dir=$(mktemp -d) && cd "$dir"
   printf '{"type":"module","devDependencies":{"eslint-plugin-metz":"X.Y.Z","eslint":"^10","@typescript-eslint/parser":"^8","typescript":"~6.0"}}' > package.json
   npm install && npm audit signatures
   node -e "import('eslint-plugin-metz').then((m) => console.log(m.default.meta))"
   ```

   `npm view` must print the provenance predicate, `npm audit signatures` must report a verified
   attestation for `eslint-plugin-metz`, and the meta must print `version: 'X.Y.Z'`.

8. **Bump consumers**, each as its own reviewed change in that repository, under that repository's
   rules (its own checks and reviews before commit). Set the
   dependency to `X.Y.Z` (a consumer still on a `github:…#vX.Y.Z` spec moves to the npm version and
   drops its `allowBuilds` entry for the plugin), run `corepack pnpm install`, and for a breaking
   release apply the CHANGELOG's migration there.

## The first publish (0.1.1 only)

npm configures a trusted publisher only on a package that already exists
([`npm trust`](https://docs.npmjs.com/cli/v11/commands/npm-trust): "The package you're configuring
must already exist on the npm registry"), so 0.1.1 is published once by hand and carries no
provenance. Steps 1 to 4 as above, then, in this order:

1. **Commit** the release (step 5's review and commit), but do not tag it yet.
2. **Scrub the history** (the owner's decision and procedure). The scrubbed history goes to a
   freshly recreated GitHub repository, not a force-push: GitHub keeps force-pushed-over commits
   reachable by SHA. Every tag, `v0.1.1` included, is created after the rewrite, annotated, on the
   rewritten release commit; the rewrite changes its SHA.
3. **Publish by hand**, on the owner's machine, at that commit with a clean working tree
   (`git status` empty): `npm login` just before publishing (its session token lasts about 2
   hours), then `corepack pnpm install --frozen-lockfile && npm publish` (`prepublishOnly` runs
   `pnpm check`; `publishConfig.access` is `public`). Do not pass `--provenance`: npm generates
   provenance only in CI and refuses it elsewhere. Then `npm logout`, which revokes the session
   token. Two-factor authentication on the npm account is strongly recommended, and the owner's
   choice for this publish; if npm refuses the publish without it, enable it
   (`npm profile enable-2fa auth-and-writes`, or on npmjs.com) and publish again.
4. **Push `main` and the annotated tag `v0.1.1`.** The `Release` workflow runs `pack` in full, and
   `publish` skips with a notice, since npm already has 0.1.1.
5. **Make the repository public:**
   `gh repo edit dacrowlah/eslint-plugin-metz --visibility public --accept-visibility-change-consequences`.
   npm generates provenance only for a public repository.
6. **Before 0.1.2**, in this order:
   - In the GitHub repository's settings: Environments → `npm` (the v0.1.1 run created it): a
     deployment rule allowing only tags `v*`, and optionally a required reviewer. npm's trusted
     publisher matches the repository, workflow file and environment, not the ref, so this rule
     is what stops a branch from publishing. Rules → a tag ruleset for `v*`, so only the owner
     creates or moves release tags. Actions → fork pull request workflows: require approval for
     all external contributors.
   - Enable two-factor authentication on the npm account, if it is off: `npm trust` needs it.
   - Just before pushing the 0.1.2 tag, register the trusted publisher. A new one must complete a
     publish within 2 days or it expires (delete it and create it again), so not earlier. With
     npm CLI 11.15.0 or later:

     ```bash
     npm trust github eslint-plugin-metz --repository dacrowlah/eslint-plugin-metz \
       --file release.yml --environment npm --allow-publish
     ```

     or, on npmjs.com, Settings → Trusted publishing: GitHub Actions, user `dacrowlah`,
     repository `eslint-plugin-metz`, workflow `release.yml`, environment `npm` (every field
     case-sensitive).

   - Under Settings → Publishing access, choose "Require two-factor authentication and disallow
     tokens" (trusted publishing is unaffected).

   0.1.2, and every release after it, follows steps 6 to 8 with provenance. Then delete this
   section.

## Common mistakes

- Choosing the bump from how big the diff looks; a one-line default change is breaking.
- Tagging before `pnpm check` and `pnpm mutate` pass on the release commit.
- A lightweight tag, or a tag on a commit that is not on `main` (the workflow refuses it).
- Editing `meta.version` or docs URLs by hand: they come from `package.json`.
- Renaming `release.yml` or its `npm` environment: the trusted publisher names both, exactly.
- Rehearsing with `npm publish --dry-run` and its scripts: npm hands the dry run on to `attw`'s
  own `npm pack`, which then writes no tarball, so `prepublishOnly` fails. Run `pnpm check`, then
  `npm publish --dry-run --ignore-scripts`.
- Setting `publishConfig.provenance`: it makes every publish outside CI fail. The workflow passes
  `--provenance` itself.
- A prerelease tag (`vX.Y.Z-rc.1`) or a backport below the current `latest`: npm refuses either
  without `--tag`, and the workflow passes none, so `publish` fails. Add a dist-tag to the
  workflow before cutting one.
- Bumping a consumer in the same change as the release, or without that repository's review.
