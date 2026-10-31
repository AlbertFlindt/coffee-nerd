# Progress / handoff

**Last updated:** 2026-10-31. **Latest release:** 1.3.1 (details in `CHANGELOG.md`).
How things work: `docs/SPEC.md`.

## Current state

The whole app is built: the shot form, the Journal and shot detail, the Library (Beans, Gear,
Puck prep, Tags), My setup, Home, Insights, the step-by-step start, offline use as an installed
app, and Settings with steps, backup and exports. For contributors: `CONTRIBUTING.md`,
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
- Vanadium and Firefox only add a shortcut (with their badge), they don't install the app. The
  page now turns off the browser's stretch and pull-to-reload; check on the phone that Vanadium
  no longer moves the screen when dragged.
- Daily use at a real brew station.
- On the phone: the back gesture closing a sheet, and swiping a sheet down from its content.
  Tested in Chromium with touch events at 412 × 915.
- Phones shorter than about 740 px: the shot form then scrolls inside itself, so Setup and Tasting
  can scroll out of view.

**Built without a design** (kept as built; the references in `docs/screens/` don't draw them):
- Offline: the line at the top of every page ("Offline: showing what the phone kept…"), "Waiting
  to send" and "Not saved" on shots, the "Not saved" message and "Discard change" in the shot form,
  the Sign out sheet while shots wait, "This page could not open" and "This page is not on the
  phone yet".
- The Settings page (built simple).
- The sign-in and "Create your account" pages follow a design agreed from screenshots of the app
  (2026-10-30): the logo above the name and tagline, a show/hide button on password fields, one
  caption under the button. `docs/screens/` doesn't draw them yet.
- Home: the Last shot card without the values not entered, empty states, the Dial-in progress
  graph's captions, grid and short-history states, and the chevron in a point's tooltip: tapping
  the highlighted point again opens that shot, whose Back returns to Home.
- Confirmations as dialogs in the middle of the screen with the red delete choice; the screens
  still draw bottom sheets.
- The "Shot saved" bar, and the messages when a shot or a score could not be saved.
- Insights: the tap tooltip, cards without enough data, no shots yet, gaps in the weekly line.
- Gear: the "Add gear" sheet, archive confirmations, "Not set" values, basket size and grinder
  range fields, problem lines. Add your own feature and Edit My setup beyond the one example drawn.
- Shot detail: the puck prep line under the setup ("Daily routine: WDT 20 s · Distributor · Tamp
  15 kg · Puck screen"); the routine's name moved there from the gear line the screen draws.
- The step-by-step start (built from the existing pages, with "Step 1 of 5").
- Puck prep and Tags: empty states, the step sheet's edit mode, the routine builder's sheets and
  problem lines, the tag sheet with Merge and Remove, and the duplicate-tag card.
- Sheets close with the back gesture (a list inside Setup goes back to Setup first) and with a
  swipe down anywhere on them while their content is at the top; the design only drags the handle.
- The shot form's Notes field under Setup and Tasting (the screens draw notes in the Tasting
  sheet), and the roaster after each bean's name in the bean list.
- The Journal's bean filter: bags with the same name and roaster are one entry, with the roaster
  after the name, and the same recipe brewed from several bags is one entry in the recipe filter.
- The shot form's Setup and Tasting rows, the sheets without tabs, folding flavor notes, the "Use it
  for new shots?" sheet, and the Archived lists of Gear, Puck prep and Tags.
- Where a screen in `docs/screens/` differs from the app in a detail (a "Delete feature" on a used
  feature, a missing step on −/+, "Leave for now" going to the Gear page), the app is right.

## Next steps

### 1.1
1. Make the repository public and protect `main`. The GitHub page gets a description, topics and
   a preview image.

### 1.2
1. Home: the other three graphs (time vs. yield, score vs. roast age, recipe consistency) and the
   chip row to switch between them.
2. Roast age ranges (e.g. 0–6, 7–13 days), decided together with the score vs. roast age graph.
3. More Insights Dial-in cards: grind vs. time, sour/bitter vs. ratio, and cards for roasters,
   flavor families, grinders and baskets.
4. Tap to type on the Setup sheet and pressure profile rows (now −/+ only: 18 taps to 9.0 bar).

### 2.0
1. Households: a Library per person, or a share switch. The backup then covers one account, or
   only an administrator can make it.
2. A choice of units (degrees Fahrenheit, ounces). Metric only for now.
3. Tablet layouts, a light theme, focus and hover styles, and a layout for small phones.
4. Measuring gear (scales, refractometers) and a marker for a burr change or recalibration.

## Workflow
- Branch from `main`, open a pull request, merge when CI is green. Pushing to `main` is blocked.
- Screens match their reference in `docs/screens/`; behavior matches `docs/SPEC.md`. Where neither
  covers it, ask before building.
- Releases: every pull request that changes the app bumps the version (the `release` skill);
  merging it tags and publishes the release and the Docker image.
- Trying a pull request: every pull request from this repository is published as `:pr-<number>`
  once its tests pass (README, "Try a pull request"); a phone check runs it in a test container.
- Keep this file and `docs/SPEC.md` current in the same pull request.

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
- **Editing a shot on an exact tie** between two recipes: the form and the server can pick a
  different recipe for the tag.
- **A routine kept only by a Brew next mark** counts as used, so it is archived, not deleted.
- **"+" on a Library page** returns to Home after saving the shot, not to the Library page.
- **Insights tap targets** are under 44 px: chart rows are 30–40 px, each week of the weekly line
  about 25 px. The weekly line's first week reads "12 weeks ago" though it starts 11 weeks ago.
  Most consistent beans shows the 4 steadiest; a name over about 14 letters runs into the bars.
- **Edit My setup** with more than two of your own features scrolls its form area.
- **Range fields** open the decimal keypad; an iPhone's has no dash, so "0-5" can't be typed there.
- **The manifest and `theme-color`** repeat the dark background color as a fixed value: change them
  by hand if the background token changes.
- **Reported content:** the code of conduct asks people to report content to the repository.
  Turn on Settings › Moderation options › Reported content when the repository goes public.
- **`main` isn't protected by GitHub** while the repository is private. The push-guard hook is the
  only safeguard, and it doesn't see merges made through the GitHub API.
- **The push guard** also blocks a command whose commit text looks like a push to `main`. Safe side.
- **Seeded end-to-end files** share one database and run in name order (`shot-*`, then `tab-*`);
  a file can't run alone after an earlier one fails.
- **The seeded shot history** (`npm run db:seed -- --history`) is tuned by hand for the Insights
  screenshot. Early in the week (a Monday) the weekly line ends last week, and the Progress
  screenshot differs from its reference.
- **The Journal end-to-end test** would see one more day in a run that crosses midnight in
  Copenhagen (the seed's time zone).
- **Pull request images** leave untagged leftovers in the package if a build pushes more than one
  manifest (an attestation): only the tagged version is deleted. Prune by hand in the package
  settings if they pile up.
- **`npm audit`:** 4 moderate advisories from an old esbuild inside drizzle-kit (development only,
  not in the Docker image). Recheck when drizzle-kit updates.
