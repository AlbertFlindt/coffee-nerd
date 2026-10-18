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
| Edit My setup has default values only for temperature and the pressure profile. Your own features (a number, seconds, on/off or a list) have no row there, so a new bean always starts with them switched off. Should Edit My setup show a row for each of them? | Any time (refines M6) | D-45, D-46 |
| A feature that shots have used can still change its unit, step and range in the sheet (its name, switch and new options are what D-151 allows). A new unit changes what earlier recipes mean, and units are not part of the recipe (D-65), so old and new shots would still count as one recipe. Should a used feature keep its unit, step and range too? | Any time (refines M6) | D-151, D-65 |
| D-151 reads "used" as: any recipe of yours has the feature in its setup, switched on or off. A recipe records a feature as soon as the machine has it switched on, so a feature that was on the machine during any shot can no longer be deleted, even if it was switched off for that shot. Deleting it would change how later shots match earlier recipes. Is that the right reading? | Any time (refines M6) | D-151, D-65 |

## 2. Screens and states not designed yet

| What is missing | Needed by | Source |
|---|---|---|
| Gear pages built without a design: the "Add gear" sheet (Machine, Grinder, Basket as rows), the archive confirmation ("Archive this basket?", "It leaves the Gear page and the pickers. Past shots keep its name."), "Fits none of your machines" when no machine has the basket's diameter, "Not set up yet" on the My setup card before My setup exists, "No basket" and "No puck prep" on that card when none is set, "Not set" for a group, burr or basket size that was never entered (the first tap on − or + sets 58 mm), the basket's Size field ("e.g. 18", a typed "g" is ignored) with the line under it "Size is the grams the basket is made for. It names the basket, like VST · 18 g.", the grinder's three typed fields Step interval, Finest and Coarsest with the line "Step interval is how much − or + moves the grind." (D-159), the grinder preview's example value (1.6, or the finest when 1.6 is outside the range), the problem lines above the button ("Name is required", "Brand is required", "Size must be more than 0", "The step interval must be more than 0", "Finest and coarsest must differ", "The dose range must run from low to high", "Each feature needs a name, and names must differ", "This gear could not be found", otherwise "Something on this page is not right"), and "Not available yet" read out for the dimmed Library rows and Edit | When the canvas designs them | D-147, D-148, D-49, D-150, D-48, D-159, D-156 |
| Delete bean (D-145): the confirmation sheet's line "It has no shots yet. This cannot be undone." and the problem line "A bean with shots cannot be deleted" (shown only if a shot is saved while the sheet is open) are wording no decision fixes | When the canvas designs them | D-145, D-116 |
| Bean detail: the "Guji Hambela is finished" message with Undo and "… is open again" reuse Home's message card above the button (D-127, D-129); a recipe kept only by its Brew next mark shows "New recipe" in muted text without a dot (D-128); a long name in the header is cut with "…"; "Not rated yet" sits in the Best score tile (D-131). Accepted as built (D-119, D-146) until the canvas designs them | When the canvas designs them | D-127, D-128, D-129, D-131 |
| Add bean: built without a design, from the form's own parts: the "Same as before" sheet (name and roaster · country · process per row, "No beans yet"), the country sheet (search field, then countries as rows), the picked re-buy card with its × (D-139), the problem lines above the button, and Edit bean (D-130). Accepted as built (D-119, D-146) until the canvas designs them | When the canvas designs them | D-126, D-130, D-133, D-138, D-139 |
| Shot form gear built without a design (D-153 to D-155): the gear line on the bean card opens a sheet "Machine" / "Grinder" with one row per item, picking one closes it; the gear line's 44 px tap area reaches over the setup line below it, so the bean name stays the bean's; switching the grinder keeps the grind value, and Save then says "Grind must be within the grinder’s range" when it is outside; the dose hint "VST · 18 g holds 17.0–19.0 g" is its own muted line under the ratio; the basket and puck prep pickers are plain lists inside More, starting with "No basket" / "No puck prep", and the Setup tab then reads the same words ("Puck prep · No puck prep") | When the canvas designs them | D-153, D-154, D-155 |
| Add your own feature, built beyond the design: Number with unit puts Step and Unit side by side ("e.g. ml") with Range below; a list option row has the placeholder "Option 1" and a × only while there are more than two; the button stays disabled with a line above it ("Name is required", "Unit is required", "The step must be more than 0", "The range must run from low to high, like 0–30", "Give at least two options a name"); an empty name previews as "Your feature". Tapping your own feature on the machine page opens the same sheet titled with its name, with "Save feature" and a quiet "Delete feature"; its kind cannot change; once used it shows "Used by shots · you can rename it or switch it off" and its options cannot be removed. Saving a machine that drops a used feature, changes its kind or removes one of its options says "A feature that shots have used cannot be deleted, change its kind or lose an option" | When the canvas designs them | D-46, D-151, D-152 |
| Edit My setup, built beyond the design: pickers are plain sheets ("No machines yet. Add one in Library › Gear." when empty, the button then reads "Choose"); the pressure profile sheet holds the same rows as More › Setup and closes like any sheet (no Done button); the summary reads "Not set" without a phase or value; switching the grinder keeps the grind; problem lines above Save: "Set Temperature first.", "Set the pressure for Low bar start first.", "Set Dose first.", "Set Grind first.", "Choose a machine", "Choose a grinder", "Grind must be within the grinder’s range", "Yield must be 0 or more", "Temperature is out of range", "This gear could not be found"; the value cards are drawn smaller, as in screen 13, and yield has no way to be emptied | When the canvas designs them | D-45, D-78, D-155 |
| The step-by-step start (D-157), built from the existing pages: "Step 1 of 5" under the title (on My setup "Step 4 of 5 · Starting point for new beans"), "Next" as the button, a quiet "Skip" under it on the basket step, and the back arrow or × keeps its look, is named "Leave for now" for screen readers and goes to the start page. A skipped basket step is remembered for good, and once My setup is saved the basket step is not asked again. When nothing is chosen yet (in the guide or not), Edit My setup starts with your only machine, grinder and basket chosen and no values: dose, grind, temperature and flat pressure are typed or tapped in. A user whose beans are all finished also gets "Step 5 of 5" on "+", since the bean is the first missing step | When the canvas designs them | D-157 |
| Proper design for the sign-in and "Create your account" pages (built simple for now) | Before release (M11) | D-84 |
| Tag sheet: rename, merge, remove | M7 | Open topic 14, D-29, D-53 |
| Home: the other three graphs (time vs. yield, score vs. roast age, recipe consistency) | M8 | Open topic 15, D-32 |
| Home: replace the placeholder start page (logo, name and a temporary "Sign out" button above the tab bar) | M8 | M0, M2, M3 |
| The "Shot saved" message, the automatic-finish message with Undo, and "… is open again" (built as a plain card on the start page) | M8 | D-95 |
| The Rate sheet when the score cannot be saved: it stays open with "The score could not be saved. Nothing was changed." under the score row | M10 | D-111 |
| "Compared with this recipe": the distance is compared as shown, to one decimal, so 1.04σ reads "Within normal range" (never "1.0σ faster than usual"); a reading of D-110 to confirm | M9 (Insights uses the same σ) | D-110 |
| Shot form: the message when the server refuses a shot ("The shot could not be saved. Nothing was changed.", above Save) | M10 | M3 |
| Shot form: the message when a switched-on feature has no value yet ("Set Low bar end first.", above Save) | When the canvas designs them | D-78, M3 |
| More › Setup: rows for custom features that are on/off or "Pick from a list" (built as a switch with "On"/"Off", and a value that cycles through the options on tap) | When the canvas designs them | D-46, M3 |
| Where "Sign out" lives (for now on the placeholder start page; Settings is the likely home) | M11 | M2 |
| **Insights: the Dial-in tab has no design** (What I like, Progress and Comparisons do); more Dial-in cards, e.g. grind vs. time, sour/bitter vs. ratio | M9 | Open topic 16, D-55, D-56 |
| Journal: how a shot that is still waiting to sync looks | M10 | Open topic 23, D-61 |
| App icon for the home screen (PWA) | M10 | Open topic 17 |
| Settings (units, backup, export, and the dose, yield and time steps of D-89) | M11 | Roadmap M11, D-89 |
| Tablet layouts, light theme, focus and hover styles | Not scheduled | Open topic 5, design-system README |
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
| The seeded end-to-end files share one database and run in name order (`shot-*`, then `tab-*`), each leaving the reference setup as it found it; a file cannot run alone after an earlier one fails | Any time | M6 tests |
| The rows in More › Setup and in the pressure profile sheet have −/+ only, no tap to type: from empty, flat pressure needs 18 taps to reach 9.0 bar (D-78). Tap to type on these rows would help, mostly on the first My setup | M10 or when the canvas designs it | D-78, D-24 |
| Recipe filter labels (D-121) add the differing gear and machine features, not the routine's step values: two recipes with the same routine whose steps differ (e.g. WDT 20 s vs 30 s) still read the same | M7 (Puck prep, when step values become editable there) | D-121, D-51 |
| `main` is not protected: GitHub does not enforce the "Require pull request" ruleset on a private repository without a Team plan. The push-guard hook and the review step are the safeguard. | When the repository goes public | Roadmap M0, D-62 |
| Playwright is pinned to 1.56.1 and CI to `ubuntu-24.04`, to match the browser in the development environment. Upgrade both together. | Any time | PR #1 |
| The image is published to GitHub Packages as a private package (`ghcr.io/albertflindt/coffee-nerd:main`, Linux x86-64 only), with a short "Try the latest build" guide in the README that seeds the reference setup (D-105). At M11: remove `scripts/seed.mjs` from the runtime image, replace the guide with the real install guide, and publish a public image. Until then the guide warns that the app can be claimed, or opened with the Demo password, until it is seeded and the password reset | M11 | D-105 |
| Install guide: create the account right after starting the server, before others can reach it; until then anyone who can open the app can claim it (D-88) | M11 | M2 |
| Install guide: behind a reverse proxy with https, forward `X-Forwarded-Proto` (and `X-Forwarded-Host` if the proxy changes the host), so the sign-in cookie is marked secure and forms are accepted | M11 | M2 |
| "Back" and "Save shot" always return to the start page, also when "+" was pressed on the Journal; D-95 wants them to return to where "+" was pressed, with the "Shot saved" message there (the message lives only on the start page for now) | M8 | M3, D-114 |
| Switching the bean (D-94) or "Use last shot recipe" (D-43) starts the form again and drops edits already made, without a warning; the local draft of D-61 may cover it | M10 | M3 |
| Shot form: a puck prep step's value is taken from the routine (D-76) and cannot be changed for one shot; only the routine can be switched | M7 | D-51, M3 |
| `npm audit`: 4 moderate advisories from an old esbuild inside drizzle-kit (development only, not in the Docker image). Recheck when drizzle-kit updates. | Each dependency update | PR #1 |
| End-to-end: the Journal test expects the shots under Today, Yesterday and one earlier date; a run that crosses midnight in Copenhagen (the seed's time zone) would see one more day | Only if it gets in the way | M4 |
| The push guard still blocks a command whose single-line commit text looks like a push to `main` (e.g. a literal `push\nto main`). Safe side; a fix needs a shell parser. | Only if it gets in the way | PR #2 |
