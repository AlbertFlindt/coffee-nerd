---
name: release
description: Set the Coffee Nerd version in a pull request (every merge that changes the app publishes a pre-release), and make a stable release when asked. Use when preparing a pull request for merge, or when asked for a release, a version bump or whether it's time to release.
argument-hint: "[X.Y.Z]"
---
`main` carries the version being worked towards, with a `## X.Y.Z (unreleased)` section at the
top of `CHANGELOG.md`. Once CI passes on `main` after a merge that changes the app,
`.github/workflows/release.yml` moves the one pre-release `vX.Y.Z-pre` (GitHub marks it
pre-release; "latest" stays stable) and the image `ghcr.io/albertflindt/coffee-nerd:X.Y.Z-pre` to
that merge; older pre-releases and their images are deleted.
A stable release is a release pull request that dates the section; it publishes `:X.Y.Z` and
`:latest`. CI's "Version and changelog" check fails a pull request that changes the app without
a version above the latest stable one and a CHANGELOG entry.

## Versions
- **Patch** (1.4.0 → 1.4.1): fixes and small changes.
- **Minor** (1.4.x → 1.5.0): a new feature.
- **Major** (1.x → 2.0.0): a milestone in `ROADMAP.md` is done. Never for anything else. A change
  that breaks a backup, an export or an install waits for one, and the CHANGELOG says so.

## In every pull request that changes the app
1. If the top CHANGELOG section is dated (the last version is out), start the next one:
   `node scripts/version.mjs bump X.Y.Z` with the patch or minor above it. If it's
   "(unreleased)" and this pull request adds a feature to a patch version, bump it to the minor;
   the script renames the section. Otherwise leave the version alone.
2. Add one user-facing bullet in plain words under `### Added`, `### Changed` or `### Fixed`.
3. `npm run lint`, commit, push. No "Release" commit.

## Stable release (only when asked)
When asked whether it's time, check these and say which don't hold:
- CI is green on `main`, and the latest pre-release has run on the home server and been used at
  the machine for **3 days** with no new bug. A fix for a bug that hurts daily use may go as soon
  as it's verified on the phone.
- Every entry in the section is verified, or listed under "Not verified" in `PROGRESS.md`.
- No feature in the section is half done.
- For a major: every item of its milestone in `ROADMAP.md` is checked.

Then, on a release branch:
1. `node scripts/version.mjs release`: dates the section and sets "Latest release" in `PROGRESS.md`.
2. Prune `PROGRESS.md`: delete what this release made true or obsolete (shipped next steps, fixed
   issues, items now verified). In `ROADMAP.md`, check the shipped items; drop a finished milestone.
3. `npm run lint`, commit "Release X.Y.Z: <summary>", open the pull request.
4. After the merge, confirm the release appeared (`mcp__github__get_release_by_tag`, or
   `gh release view vX.Y.Z`). If the workflow failed, rerun it from the Actions tab.
