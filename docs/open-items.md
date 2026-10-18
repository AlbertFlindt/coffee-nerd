# Coffee Nerd — Open items

Everything that is unanswered, not designed yet, or deliberately left for later, in one place, so nothing is forgotten. Each item names the milestone that needs it (`docs/roadmap.md`), so it gets settled in time.

- **Add** an item in the same pull request that finds it: a question you could not answer, a state with no design, a shortcut or limitation in code.
- **Close** an item by deleting it in the pull request that settles it, naming the decision (D-nn) or the change.
- Before planning a milestone, read every item that names it, and get the owner's answers before building on them.

The decision log keeps the history of product topics; this file is the working list.

Last updated: 2026-10-18

---

## 1. Questions for the owner

| Question | Needed by | Source |
|---|---|---|
| *(none open)* | | |

## 2. Screens and states not designed yet

| What is missing | Needed by | Source |
|---|---|---|
| Proper design for the sign-in and "Create your account" pages (built simple for now) | Before release (M11) | D-84 |
| First-run guide: after creating the account, how you add your gear, puck prep and My setup | M6 | D-88 |
| Recipe detail (a recipe's shots), opened from the bean detail page | M5 | Open topic 9, D-42 |
| Gear: the message on an item My setup uses, "Used in My setup · choose another default first" | M6 | D-83 |
| Tag sheet: rename, merge, remove | M7 | Open topic 14, D-29, D-53 |
| Home: the other three graphs (time vs. yield, score vs. roast age, recipe consistency) | M8 | Open topic 15, D-32 |
| Home: replace the placeholder start page (logo, name and a temporary "Sign out" button above the tab bar) | M8 | M0, M2, M3 |
| The "Shot saved" message, the automatic-finish message with Undo, and "… is open again" (built as a plain card on the start page) | M8 | D-95 |
| Shot form when there is nothing to brew with (no My setup or no open bean): built as a plain "Nothing to brew with yet" message | M6 | D-88, M3 |
| Shot form: the bean list behind the bean card (D-94), built as a plain "Open beans" list in a sheet | M5 | D-94, M3 |
| The Rate sheet when the score cannot be saved: it stays open with "The score could not be saved. Nothing was changed." under the score row | M10 | D-111 |
| Tab bar: the screens (Journal.png, ShotDetail.png) draw it about 100 px tall, the design system's `--tabbar-h` is 84 px; built at 84 px, so icons sit about 8 px lower than in the PNGs. Settle in the design-system sync | M5 (D-119) | D-30, D-114 |
| "Compared with this recipe": the distance is compared as shown, to one decimal, so 1.04σ reads "Within normal range" (never "1.0σ faster than usual"); a reading of D-110 to confirm | M9 (Insights uses the same σ) | D-110 |
| Editing a shot: the "Delete shot" button above "Save changes" and its confirmation sheet ("Delete this shot?", "Delete shot" / "Keep it") are not designed yet (D-116) | M5 (design-system sync, D-119) | D-116 |
| Shot form: the message when the server refuses a shot ("The shot could not be saved. Nothing was changed.", above Save) | M10 | M3 |
| Shot form: the message when a switched-on feature has no value yet ("Set Low bar end first.", above Save) | M6 | D-78, M3 |
| More › Setup: rows for custom features that are on/off or "Pick from a list" (built as a switch with "On"/"Off", and a value that cycles through the options on tap) | M6 | D-46, M3 |
| More › Setup: the basket and puck prep pickers (built as a plain list inside the sheet) | M6, M7 | D-22, D-25, M3 |
| Where "Sign out" lives (for now on the placeholder start page; Settings is the likely home) | M11 | M2 |
| **Insights: the Dial-in tab has no design** (What I like, Progress and Comparisons do); more Dial-in cards, e.g. grind vs. time, sour/bitter vs. ratio | M9 | Open topic 16, D-55, D-56 |
| Journal: how a shot that is still waiting to sync looks | M10 | Open topic 23, D-61 |
| App icon for the home screen (PWA) | M10 | Open topic 17 |
| Settings (units, backup, export, and the dose, yield and time steps of D-89) | M11 | Roadmap M11, D-89 |
| Shot form: choosing another machine or grinder (D-94 waits for the Gear pages) | M6 | D-94 |
| Shot form: the gentle hint when the dose is outside the basket's dose range | M6 | D-49 |
| Tablet layouts, light theme, focus and hover styles | Not scheduled | Open topic 5, design-system README |
| Design system: the empty slider handle (D-106, built as a hollow dashed circle in ink-muted) and the pressed state of buttons (D-107, built as an amber flash, and a slight press for amber buttons) are not in the design system yet; the sheet handle now sits in the middle of a 44 px drag strip, with more room around it than the screens show (owner feedback, D-108); add them to the master and sync | M5 (owner syncs the design system first, D-119) | D-106, D-107, D-108, D-119 |
| Shorter screens: the shot form tightens its spacing below 880 px and 760 px of height (D-36). Below about 740 px it no longer fits and the form area scrolls inside itself, so More can scroll out of view; a design for small phones is still to do | M10 | D-36 |

## 3. Product topics not decided yet

| Topic | Needed by | Source |
|---|---|---|
| Interaction principles (written rulebook) | Not scheduled | Open topic 4 |
| Test at a real brew station | After M3 | Open topic 6 |
| Success metrics (time to log, % rated, repeat rate) | Not scheduled | Open topic 7 |
| Measuring gear (scales, refractometers) | Not scheduled | Open topic 20, D-47 |
| Grinder burr change / recalibration marker | Not scheduled | Open topic 21 |
| Households: own Library each, or a share toggle | Not scheduled | Open topic 22, D-60 |
| Open source: license, contributing guide, code of conduct | M11 | Open topic 26 |
| Optional: `@claude` in GitHub issues and pull requests | Not scheduled | Open topic 27 |

## 4. Code and tooling to revisit

| Item | When | Source |
|---|---|---|
| `main` is not protected: GitHub does not enforce the "Require pull request" ruleset on a private repository without a Team plan. The push-guard hook and the review step are the safeguard. | When the repository goes public | Roadmap M0, D-62 |
| Playwright is pinned to 1.56.1 and CI to `ubuntu-24.04`, to match the browser in the development environment. Upgrade both together. | Any time | PR #1 |
| The image is published to GitHub Packages as a private package (`ghcr.io/albertflindt/coffee-nerd:main`, Linux x86-64 only), with a short "Try the latest build" guide in the README that seeds the reference setup (D-105). At M11: remove `scripts/seed.mjs` from the runtime image, replace the guide with the real install guide, and publish a public image. Until then the guide warns that the app can be claimed, or opened with the Demo password, until it is seeded and the password reset | M11 | D-105 |
| Install guide: create the account right after starting the server, before others can reach it; until then anyone who can open the app can claim it (D-88) | M11 | M2 |
| Install guide: behind a reverse proxy with https, forward `X-Forwarded-Proto` (and `X-Forwarded-Host` if the proxy changes the host), so the sign-in cookie is marked secure and forms are accepted | M11 | M2 |
| The Brew next end-to-end test sets the mark directly in the test database, since nothing in the app can mark a recipe before the bean detail page; switch it to the button | M5 | M3 |
| "Back" and "Save shot" always return to the start page, also when "+" was pressed on the Journal; D-95 wants them to return to where "+" was pressed, with the "Shot saved" message there (the message lives only on the start page for now) | M8 | M3, D-114 |
| The basket and puck prep pickers offer no "None", so once set they cannot be removed for one shot | M6 | M3 |
| Switching the bean (D-94) or "Use last shot recipe" (D-43) starts the form again and drops edits already made, without a warning; the local draft of D-61 may cover it | M10 | M3 |
| Basket row on the Setup tab shows the basket's name ("VST 18 g"); the design shows brand · size ("VST · 18 g"), which needs separate fields on the basket | M6 | D-49, M3 |
| Shot form: a puck prep step's value is taken from the routine (D-76) and cannot be changed for one shot; only the routine can be switched | M7 | D-51, M3 |
| `npm audit`: 4 moderate advisories from an old esbuild inside drizzle-kit (development only, not in the Docker image). Recheck when drizzle-kit updates. | Each dependency update | PR #1 |
| End-to-end: the sheet handle test (D-108, `shot-form.test.ts`) failed in 2 of 6 local runs (handle position off by 2.9 px once, drag strip 43.99999 px once), measured while the sheet may still move; it touches nothing this pull request changed and passed in the other runs. Watch it; make the measurement wait for the sheet to stop if it fails again | If it fails again | M4 |
| End-to-end: the Journal test expects the shots under Today, Yesterday and one earlier date; a run that crosses midnight in Copenhagen (the seed's time zone) would see one more day | Only if it gets in the way | M4 |
| The push guard still blocks a command whose single-line commit text looks like a push to `main` (e.g. a literal `push\nto main`). Safe side; a fix needs a shell parser. | Only if it gets in the way | PR #2 |
