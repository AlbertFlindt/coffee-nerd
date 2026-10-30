# Contributing to Coffee Nerd

Thanks for helping. Coffee Nerd is a self-hosted espresso journal used one-handed on a phone at
the brew station, so every change is judged by one question: does it make logging and learning
from a shot easier there?

By taking part you agree to the [code of conduct](CODE_OF_CONDUCT.md). To report a vulnerability,
don't open an issue: see [SECURITY.md](SECURITY.md).

## Issues

- **Bugs:** use the bug report form. Say which version you run (Settings shows it at the bottom),
  the phone and browser, whether the app is installed on the home screen, and the steps that show
  the problem.
- **Ideas:** use the feature request form, and start from what you were trying to do at the
  machine rather than from a solution. Check the next steps in [PROGRESS.md](PROGRESS.md) first:
  your idea may already be planned for a version.
- **Questions** about running Coffee Nerd are welcome as issues too.

## Before you build

- **Open an issue first** for anything bigger than a fix, and agree on what to build before you
  code it. A small fix can go straight to a pull request.
- **Behavior** is described in [docs/SPEC.md](docs/SPEC.md). Read the section before you change
  that behavior, and update it in the same pull request.
- **Looks** come from `design-system/` (tokens, components) and `docs/screens/` (every designed
  screen at 412 × 915). Both are synced from the design source, so don't edit them by hand. Where
  neither covers what you need, ask in the issue before inventing it.

## Setting up

Needs Node 22.

```sh
npm ci
npm run db:seed        # optional: the reference setup (sign in as Demo / coffee-nerd)
npm run dev            # http://localhost:5173
```

[CLAUDE.md](CLAUDE.md) lists every command and the architecture in short; the files in
`.claude/rules/` hold the rules for each part of the code. They are written for coding agents
and read just as well for people.

## Rules that are easy to get wrong

- Decimal quantities are stored as integer thousandths (18.0 g is `18000`). Convert only in
  `src/lib/domain/units`.
- A recipe never changes once saved. Changing what goes into its fingerprint changes recipe
  identity: open an issue first.
- Taste is never filled in for you. Not rated is `null`, never `0`.
- Rows that shots point to are archived, never deleted.
- Never edit a migration that is on `main`; add a new one with `npm run db:generate`.
- No requests outside your own server at runtime: no fonts, analytics or CDNs.
- Colors only through tokens. Screens fit the phone's viewport, only lists scroll, and touch
  targets are at least 44 px.
- UI text uses plain words in sentence case, without abbreviations. "Gear", never "Equipment".

## Pull requests

1. Branch from an up-to-date `main`; one change per pull request.
2. For domain logic, write the failing test first, and name tests after the behavior they protect.
3. Run the checks. CI runs the same ones and must be green before a merge:

   ```sh
   npm run check && npm run lint && npm test && npm run test:e2e
   ```

4. For a screen, put your screenshot in the pull request next to its reference from
   `docs/screens/` (`npm run screenshot -- <route>` takes one at 412 × 915).
5. Keep [docs/SPEC.md](docs/SPEC.md) and [PROGRESS.md](PROGRESS.md) current in the same pull request.
6. **Every merge that changes the app is a release.** Bump the version in the pull request:
   `node scripts/version.mjs bump X.Y.Z` (patch for fixes, minor for features, major for changes
   that break a backup, an export or an install), and write the `CHANGELOG.md` section by hand.
   CI's "Version bumped" check fails a pull request that changes the app without one. Changes to
   docs, CI or `.claude/` alone need no bump. Merging tags the release and publishes the Docker image.

Commit subjects are plain sentences ("Show grams left on the bean card"), with a short body saying
what changed and why.

## License

Coffee Nerd is licensed under the AGPL-3.0-only. By contributing, you agree that your
contribution is licensed under it too.
