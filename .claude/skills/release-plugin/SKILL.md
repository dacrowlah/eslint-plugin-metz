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
   `corepack pnpm version X.Y.Z --no-git-tag-version --no-git-checks` (step 2 left the tree
   dirty, which pnpm otherwise refuses). Run `corepack pnpm docs:generate` (rule docs link to
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

5. **Review, then commit on a branch.** Stage the release (`git add -A`) and have a general and an
   adversarial review of the staged diff (CLAUDE.md, owner's preferences); fix what they find and
   rerun step 4. Only then commit the bump, authored `Ryan Crowley <dacrowlah@gmail.com>`:
   `git switch -c release/vX.Y.Z && git commit -am "release: vX.Y.Z"`.

6. **Ask the owner** to push and to merge (unless already approved for this release), then open
   the pull request: `git push -u origin release/vX.Y.Z && gh pr create --fill`. **A release goes
   through a pull request.** The gate has three parts, all required: the Claude code review
   (`.github/workflows/claude-code-review.yml`) has posted its review on the PR (a "Code review"
   comment, even if "No issues found"), the release reviewer has approved the staged diff
   (step 5), and CI (`ci.yml`) is green. A green review check with no review comment on the PR
   means the run failed to review: treat it as failed, not passed (see "Trust and access").

   **Merge by fast-forward, the one method:** once the PR's checks pass, with the owner's OK,
   `git push origin release/vX.Y.Z:main`. It keeps the signed commit, its SHA and its author, so
   `main` and the tag hold exactly the commit that step 4 gated, and GitHub marks the PR merged.
   The repository offers only "Rebase and merge" (squash and merge commits are disabled, and
   GitHub requires one method), but **never use that button either**: it rewrites the commit,
   losing the signature and changing the SHA, so the tag would sit on a commit nobody gated. GitHub
   deletes the remote branch after the merge; the local `release/vX.Y.Z` remains for the tag below.
   If `main` moved, rebase the branch and rerun step 4 first.

   Then tag that same commit, annotated (a lightweight tag is wrong: `git describe` and GitHub
   releases read the annotation), and push the tag:
   `git tag -a vX.Y.Z "$(git rev-parse release/vX.Y.Z)" -m "eslint-plugin-metz vX.Y.Z" && git push origin vX.Y.Z`.
   The tag push starts the `Release` workflow
   (`.github/workflows/release.yml`: its header and step names say what it checks and does).
   Watch it:
   `gh run watch --exit-status $(gh run list --workflow release.yml --branch vX.Y.Z --limit 1 --json databaseId --jq '.[0].databaseId')`
   (`--branch` pins the new tag's run, not the previous release's).
   If `pack` fails, nothing was published: fix, and cut a new patch version (or, with the owner's
   OK, move the unpublished tag). Once npm has a version it never accepts it again.
   If `publish` fails, ask npm whether it took the version before re-running anything:
   `npm view eslint-plugin-metz@X.Y.Z version`. npm can take minutes to list a new version (on
   2026-10-22 it listed 0.1.1 about five minutes after the CLI's `+ eslint-plugin-metz@0.1.1`
   line), so wait. Once it is listed, re-run only the failed job, `gh run rerun <run-id> --failed`:
   its skip step passes. A re-run before then publishes again, and npm refuses the version. If it
   is still not listed after about ten minutes, npm did not take it: check "Trust and access", fix
   the cause, then re-run the failed job (the skip step does not skip, and it publishes).

7. **Verify the published package** in a throwaway project:

   ```bash
   npm view eslint-plugin-metz@X.Y.Z version dist.attestations.provenance
   dir=$(mktemp -d) && cd "$dir"
   printf '{"type":"module","devDependencies":{"eslint-plugin-metz":"X.Y.Z","eslint":"^10","@typescript-eslint/parser":"^8","typescript":"~6.0"}}' > package.json
   npm install && npm audit signatures
   node -e "import('eslint-plugin-metz').then((m) => console.log(m.default.meta))"
   ```

   If `npm view` prints nothing, npm has not listed the version yet: see the listing lag in step 6. `npm view` must print the provenance predicate, `npm audit signatures` must report a verified
   attestation for `eslint-plugin-metz`, and the meta must print `version: 'X.Y.Z'`.

8. **Bump consumers**, each as its own reviewed change in that repository, under that repository's
   rules (its own checks and reviews before commit). Set the
   dependency to `X.Y.Z` (a consumer still on a `github:…#vX.Y.Z` spec moves to the npm version and
   drops its `allowBuilds` entry for the plugin), run `corepack pnpm install`, and for a breaking
   release apply the CHANGELOG's migration there.

## Trust and access

These hold for every release; check them if a publish is refused.

- npm's trusted publisher for the package names the GitHub user `dacrowlah`, repository
  `eslint-plugin-metz`, workflow `release.yml` and environment `npm` (every field
  case-sensitive). It matches those, not the ref, so the `npm` environment's deployment rule
  (only tags `v*`, in the repository's Settings → Environments) is what stops a branch from
  publishing. A tag ruleset for `v*` lets only the owner create or move release tags, and fork
  pull request workflows need approval for every external contributor. The live publisher
  allows two permissions, publish and stage publish. Should it ever need registering again
  (npm CLI 11.15.0 or later; it must complete a publish within 2 days or it expires), this
  command reproduces the live configuration exactly, both `--allow-` flags included:

  ```bash
  npm trust github eslint-plugin-metz --repository dacrowlah/eslint-plugin-metz \
    --file release.yml --environment npm --allow-publish --allow-stage-publish
  ```

- The review workflow has three settings that look removable and are not. Do not "simplify" them:
  - `--allowedTools` lists the `code-review` plugin's own `gh` commands (`gh pr comment`,
    `gh pr diff`, `gh pr view`, `gh pr list`, `gh issue view`, `gh issue list`, `gh search`) and
    the inline-comment tool, granted to its subagents too. Without them the subagents' commands
    are refused and the job ends green having reviewed nothing. `gh api` stays out: it can write.
  - `--model claude-opus-5-5`: Opus runs the plugin's subagents to completion; the run that
    posted its first review used it.
  - `CLAUDE_CODE_DISABLE_BACKGROUND_TASKS` and `CLAUDE_CODE_DISABLE_CRON` (both `'1'`): the action
    stops reading at the first result, so a subagent left in the background, or a scheduled
    wake-up, dies with the job and the review never posts. These keep the subagents in the
    foreground.
- `npm trust` needs two-factor authentication on the npm account; trusted publishing itself does
  not use it.
- The package's npmjs.com Settings → Publishing access should read "Require two-factor
  authentication and disallow tokens" (not verifiable without an OTP). Trusted publishing is
  unaffected.
- npm generates provenance only in CI and only for a public repository: the repository stays
  public, and a version published by hand (0.1.1, the first real version; npm also lists a `0.0.0-stage`
  placeholder) carries none.

## Common mistakes

- Choosing the bump from how big the diff looks; a one-line default change is breaking.
- Tagging before `pnpm check` and `pnpm mutate` pass on the release commit.
- A lightweight tag, or a tag on a commit that is not on `main` (the workflow refuses it).
- Editing `meta.version` or docs URLs by hand: they come from `package.json`.
- Renaming `release.yml` or its `npm` environment: the trusted publisher names both, exactly.
- Handing npm a tarball path without `./` or `/` in front: npm reads `release/x.tgz` as the
  GitHub repository `release/x.tgz` and fails in `git ls-remote`. The workflow keeps the path in
  one `TARBALL` variable and dry-runs the publish command (with `--force`, so a version npm already
  has passes) in its `pack` job.
- Rehearsing with `npm publish --dry-run` and its scripts: npm hands the dry run on to `attw`'s
  own `npm pack`, which then writes no tarball, so `prepublishOnly` fails. Run `pnpm check`, then
  `npm publish --dry-run --ignore-scripts`.
- Setting `publishConfig.provenance`: it makes every publish outside CI fail. The workflow passes
  `--provenance` itself.
- A prerelease tag (`vX.Y.Z-rc.1`) or a backport below the current `latest`: npm refuses either
  without `--tag`, and the workflow passes none, so `publish` fails. Add a dist-tag to the
  workflow before cutting one.
- Bumping a consumer in the same change as the release, or without that repository's review.
