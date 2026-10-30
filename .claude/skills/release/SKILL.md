---
name: release
description: Bump the Coffee Nerd version for a release (every pull request that changes the app ships as one on merge). Use when preparing a pull request for merge, or when asked for a release or a version bump.
argument-hint: "[X.Y.Z]"
---
Every merge to `main` that changes the app is a release. The version bump goes **in the pull
request**, as its last commit; on merge, `.github/workflows/release.yml` tags `vX.Y.Z`, publishes
the GitHub release from the CHANGELOG section and pushes the Docker image as
`ghcr.io/albertflindt/coffee-nerd:X.Y.Z` and `:latest`. CI's "Version bumped" check fails a pull
request that changes the app without a bump (docs, CI and `.claude/` changes alone are exempt).

Release version $ARGUMENTS (X.Y.Z). Without one, pick it from the changes since the last tag:
patch for fixes, minor for new features, major for changes that break a backup, an export or an install.

1. On the pull request branch: `node scripts/version.mjs bump X.Y.Z`. It sets `package.json`,
   `package-lock.json` and the "Latest release" line in `PROGRESS.md`; update its "Last updated" date too.
2. Write by hand in `CHANGELOG.md`: a `## X.Y.Z (YYYY-MM-DD)` section at the top, user-facing,
   with `### Added`, `### Changed` or `### Fixed` and one bullet per change, in plain words.
3. `npm run lint` (it runs `node scripts/version.mjs check`), commit "Release X.Y.Z: <summary>", push.
4. After the merge, confirm the release appeared (`mcp__github__get_release_by_tag`, or
   `gh release view vX.Y.Z`). If the workflow failed, rerun it from the Actions tab; it only
   releases a version that has no tag yet.
