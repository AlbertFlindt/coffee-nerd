# Progress / handoff
**Last updated:** 2026-11-12. **Latest release:** 1.4.0 (details in `CHANGELOG.md`).
How things work: `docs/SPEC.md`.

## Current state
The whole app is built: the shot form, the Journal and shot detail, the Library (Beans, Gear,
Puck prep, Tags), My setup, Home, Insights, the step-by-step start, offline use as an installed
app, and Settings with steps, backup, exports and import. For contributors: `CONTRIBUTING.md`,
`CODE_OF_CONDUCT.md`, and in `.github/` the bug report and feature request forms and the pull
request template.

**Verified:**
- Every screen has an end-to-end test at 412 × 915 against the production build, on an empty
  and on a seeded database. Domain logic and repository functions have unit and integration tests.
- On a Pixel 8a (2026-10-26): installed from Chrome, the app opens standalone with the status bar,
  and Android's gesture bar is dark. Offline use works in Chrome, Vanadium and Firefox.
- On a Pixel 8a (2026-10-27): the app left open across an update, then opened in airplane mode,
  runs the new version's own scripts.
- No secrets in the git history (2026-10-30): every commit on every branch searched for keys,
  tokens, private keys, passwords and committed `.env` or database files. Only `.env.example` and
  the published test passwords turned up.
- The Docker image is public (2026-10-30): `ghcr.io/albertflindt/coffee-nerd:latest` and `:1.0.2`
  download without signing in.

**Not verified:**
- Safari on iPhone and iPad.
- Phones shorter than about 740 px: the shot form then scrolls inside itself, so Setup and Tasting
  can scroll out of view.

## Known issues / limitations
- **Offline means the server didn't answer:** the "Offline" line also shows after a server restart
  (a Docker update) and goes at the next page that reaches it. After 4 seconds without an answer a
  kept page opens from its copy; a page the phone hasn't kept waits as long as the browser does.
- **What the phone keeps:** Home, the Journal (as last filtered) and the shot form for every open
  bean, after every change and at most once a minute. Other pages only once opened online.
  Reloading the shot form offline when the Journal opened it opens Home instead.
- **Across an update:** while a new version waits, a window still on the old scripts that moves
  between pages offline reads the newer version's data.
- **Shot form drafts** have no age limit and no look of their own. A draft for a deleted shot stays
  in the browser until sign-out. A Save that reached the server just as the app closed opens again
  as an unsaved form; saving it again makes a second shot, to delete by hand.
- **Waiting shots** are sent when the app opens, when the phone is back online, every 30 seconds
  while shots wait and right after a shot is kept. One that finishes its bean gets no "Undo" bar
  when it arrives. The next shot copies a waiting shot's values as they are; routine and gear
  changes since apply once the server has it. Over plain http a save that can't reach the server
  also waits on the phone.
- **A password reset** clears a phone's kept pages only when that phone next reaches the server.
- **The backup copies every account** on the server, password hashes included.
- **Import** only goes into an empty journal (`docs/SPEC.md` §4.8); outside Docker, `node build`
  takes files up to 512 KB (about 600 shots) unless `BODY_SIZE_LIMIT` is set.
- **Editing a shot on an exact tie** between two recipes: the form and the server can pick a
  different recipe for the tag.
- **A routine kept only by a Brew next mark** counts as used, so it is archived, not deleted.
- **"+" on a Library page** returns to Home after saving the shot, not to the Library page.
- **Home's graph chips** are 36 px tall as screen 6 draws them, and the Roast age and Consistency
  rows 30 px, under the 44 px target. Two recipes with the same grind and dose read the same on
  Consistency, the second with "(2)".
- **Insights tap targets** are under 44 px: chart rows are 30–40 px, each week of the weekly line
  about 25 px. The weekly line's first week reads "12 weeks ago" though it starts 11 weeks ago.
  Most consistent beans shows the 4 steadiest; a name over about 14 letters runs into the bars.
- **Edit My setup** with more than two of your own features scrolls its form area.
- **Range fields** open the decimal keypad; an iPhone's has no dash, so "0-5" can't be typed there.
- **The manifest and `theme-color`** repeat the dark background color as a fixed value: change them
  by hand if the background token changes.
- **`main` isn't protected by GitHub** yet (on the roadmap). The push-guard hook is the only safeguard,
  and it doesn't see merges made through the GitHub API.
- **The push guard** also blocks a command whose commit text looks like a push to `main`. Safe side.
- **Seeded end-to-end files** share one database and run in name order (`shot-*`, then `tab-*`);
  a file can't run alone after an earlier one fails.
- **The seeded shot history** (`npm run db:seed -- --history`) is tuned by hand for the Insights
  screenshot. Early in the week (a Monday) the weekly line ends last week.
- **The Journal end-to-end test** would see one more day in a run that crosses midnight in
  Copenhagen (the seed's time zone).
- **Three code comments still mention the removed `docs/screens/`** (`src/app.css`,
  `scripts/screenshot.mjs`, `playwright.config.ts`). The fix waits on branch `docs-screens-comments`
  to go in with the next app change, because CI counts edits to those files as an app change that
  needs a CHANGELOG entry.
- **`npm audit`:** 4 moderate advisories from an old esbuild inside drizzle-kit (development only,
  not in the Docker image). Recheck when drizzle-kit updates.
