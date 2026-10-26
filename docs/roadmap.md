# Coffee Nerd — Roadmap

Build order and what "done" means for each milestone. One milestone at a time, one pull request (or a few small ones) per milestone, merged only when CI is green and the acceptance list is met (D-62, D-70).

The order gets a usable core loop (log a shot, see it) onto a phone early, so it can be tested at a real brew station (open topic 6) while the rest is built.

Status: ☐ not started · ◐ in progress · ☑ done

---

## M0 — Foundation ☑
Set up the empty app so every later milestone has checks to run.
- SvelteKit (Svelte 5, TypeScript `strict`), Node 22 LTS, npm.
- ESLint + Prettier + `svelte-check`; Vitest for unit tests; Playwright for end-to-end tests.
- Design system wired in: `design-system/tokens.css` and `components.css` loaded globally, Figtree self-hosted (no Google Fonts call, privacy), `.cn-root` on the app shell.
- Drizzle ORM + SQLite (`better-sqlite3`), migrations in `drizzle/`, database file in `./data/` (git-ignored).
- `Dockerfile` (multi-stage, non-root user) and `compose.yaml` with one volume for `/data`; health route `/health`.
- `npm run screenshot -- <route> [name]`: saves a 412 × 915 screenshot of a route to `screenshots/` (git-ignored) for comparing with `docs/screens/`.
- GitHub Actions CI: install, `check`, `lint`, `test`, `build`, and the Docker build, on every pull request and on `main`.
- Protect `main` on GitHub once CI exists: changes only through pull requests, CI checks required (D-62). If GitHub's plan does not allow it for a private repository, say so to the owner; the push-guard hook and the review step remain the safeguard until the repository is public. *(2026-10-17: a ruleset "Require pull request" exists, but GitHub does not enforce it on this private repository without a Team plan; it takes effect once the repository is public.)*
- Update the **Commands** section of `CLAUDE.md` to the real scripts.

**Done when:** a fresh clone runs `npm ci && npm run check && npm run lint && npm test && npm run build` with no errors; `docker compose up` serves `/health`; CI is green on the first pull request; `npm run screenshot -- /` produces a PNG.

## M1 — Domain core (no UI) ☑
Pure TypeScript in `src/lib/domain/`, fully unit-tested, used later by both browser and server. See `docs/data-model.md` §1, §4, §5.
- `units`: thousandths in, display strings out; conversions only here.
- Zod schemas: gear specs per kind, feature and value definitions, step settings, recipe setup snapshot (D-64, D-65, D-68).
- `recipeFingerprint` and `describeChange` ("grind changed") (D-16, D-63, D-65).
- `prefill` in the order of data-model §4.2 (D-03, D-11, D-38, D-41, D-43).
- `bestRecipe` (D-66), ratio, roast age, grams left and auto-finish (D-35, D-40).
- Statistics: mean, sample σ (n − 1), median and quartiles, histogram bins, normal curve, σ distance, pooled σ (D-56, D-57).

**Done when:** every function above has tests whose names cite the D-number they protect, including the edge cases in data-model §4 (feature switched off, renamed label, returning to an earlier grind, re-buy, no shots yet).

## M2 — Database, seed and login ☑
- Drizzle schema exactly as `docs/data-model.md` §3, with the unique recipe key and indexes from §5.
- Repository functions for find-or-create recipe + save shot in one transaction (data-model §4.1, step 5).
- Seed script with the reference setup: Lelit Bianca (all five built-in features), Timemore Sculptor 064S (stepless, 0.1, 0.0–16.0), VST 18 g basket, "Daily routine" (WDT 20 s → Distributor → Tamp 15 kg → Puck screen), the built-in flavor tags, My setup, one open bean.
- Single-user login (first run creates the account), session cookie, every query scoped by `owner_id` (D-60).

**Done when:** integration tests against a temporary SQLite file cover save-shot → recipe reuse → edit-shot → recipe cleanup, and Brew next clearing; the seed runs on an empty database.

## M3 — Shot form ☑  (screens 1–5, 11)
New shot with prefill, deltas, recipe tag, balance, score, More sheet (Setup and Tasting), Brew next banner. Uses seeded gear and beans; pickers can be minimal until M5–M6.

**Done when:** screenshots of each state match `Main`, `Rated`, `RecipeChanged`, `MoreSetup`, `MoreTasting`, `BrewNext`; end-to-end test: log three shots, go back to the first grind, tag says "Recipe reused".

## M4 — Journal and shot detail ☑  (screens 22, 26)
Day-grouped list, filters, Rate block, shot detail with "Compared with this recipe" (σ), edit via the shot form.

## M5 — Beans ☑  (screens 7, 9, 10)
Overview, Add bean with "Same as before", bean detail with recipes and Brew next, finish and reopen with undo.

Built in three pull requests: the overview (D-124, D-132, D-134, D-135), then Add bean (D-126, D-130, D-133), then the bean detail page (D-125, D-127 to D-129, D-131). The M4 details were reviewed (D-120 to D-123); the design-system sync (D-119, D-123) runs alongside, as its own pull request.

**Done when:** screenshots match `Beans`, `AddBean` and `BeanDetail`; end-to-end tests: add a bean, re-buy it with "Same as before" and its first shot starts from the earlier bag's best recipe (D-73); mark a recipe Brew next with its button and "+" starts from it; finish a bean, undo, reopen.

## M6 — Gear and My setup ☑  (screens 8, 12–17)
Gear list, machine/grinder/basket detail, Add your own feature, Edit My setup. Library landing (screen 17).

Built in three pull requests: the Library and gear pages (D-147 to D-150, D-156, D-158), then Add your own feature, Edit My setup and the shot form's gear pieces (D-151 to D-155), then the step-by-step start (D-157).

**Done when:** screenshots match `Library`, `Equipment`, `GearDetail`, `GrinderDetail`, `BasketDetail`, `CustomFeature` and `EditSetup`; end-to-end tests: add and archive gear; add a custom feature and see it on More › Setup; edit My setup and a new bean's first shot starts from it; a new account is guided from sign-up to its first shot.

## M7 — Puck prep and Tags ☑  (screens 18–21)
Routines overview, routine builder (drag, insert), New step, Tags page with families, merge and duplicate finder.

Built in four pull requests: the Puck prep page and steps (D-163, D-168, D-169), the routine builder (D-164, D-165, D-167), step values on the shot form and in recipe labels (D-166, D-170), then the Tags page (D-171 to D-174, D-179).

**Done when:** screenshots match `PuckPrep`, `NewStep`, `RoutineBuilder` and `Tags`; end-to-end tests: add, change and remove a step; build, reorder and archive a routine; change a step's value for one shot and see it as a recipe change; merge a duplicate flavor note and remove one that shots used.

## M8 — Home ☑  (screen 6)
App banner with the gear, bean scope, last shot, quick numbers, best recipe and the Dial-in progress graph (D-32, D-34, D-193 to D-198). The gear opens a Settings page with only "Sign out" (D-199). After saving, the app returns to where "+" was pressed with the "Shot saved" bar (D-95, D-200). The other three graphs wait for their design and the Insights data layer (D-193, open topic 15).

Built in three pull requests: Home's cards with the bean switcher, the states without data and the Settings page (D-194, D-195, D-197 to D-199); the Dial-in progress graph (D-196); the "Shot saved" bar and returning to where "+" was pressed (D-200).

**Done when:** the seeded screenshot matches `Home`, apart from what D-193 leaves out (the chip row) and the best recipe's score, which reads as on the Beans pages (D-135); Home fits 412 × 915 without scrolling and the graph absorbs shorter screens (D-36); unit tests: this week counts this bean from Monday in the user's time zone, best recipe follows D-66 and D-135, the graph's points and recipe-change marks, grams left; end-to-end tests: switch the bean on Home and every card follows it, and "+" starts from it; save a shot from Home and from the Journal and land back there with "Shot saved"; a shot that uses up the bag shows the finished message and Undo reopens the bean; rate an unrated last shot from Home; the last shot opens its detail and Back returns to Home; Home with no open bean and with a bean without shots; sign out from the Settings page; the placeholder start page is gone.

## M9 — Insights ☑  (screens 23–25)
`shot_facts` view, measure/dimension registry, insight definitions, the chart components (box plot, mean ± σ, line with σ band, bell curve, σ bars) with tap tooltips (D-55, D-56, D-64). The six drawn cards: score by process and by origin under What I like, the weekly average score under Progress, the shot-time bell curve under Dial-in, routines and most consistent beans under Comparisons (D-201, D-202). Each card shows once it has enough data (D-203), with a title that follows the finding (D-206). Home's Dial-in progress graph moves onto `shot_facts`. Starts after M8 is merged.

Planned in three pull requests: the data layer (`shot_facts`, registry, queries) with Home's graph moved onto it; the chart components, the Insights page with its chips, the seeded shot history and the What I like cards; then the Progress, Dial-in and Comparisons cards. All three are built; `npm run db:seed -- --history` adds the 13 weeks of shots the Insights screenshots use.

**Done when:** the seeded screenshots match `Insights`, `InsightsProgress` and `InsightsCompare` in layout, with the numbers the seeded history gives and the bell curve under Dial-in (D-201); Insights fits 412 × 915 and only the card list scrolls (D-36); unit tests: each measure and dimension in the registry, holding the bean or recipe constant and comparing routines with everything else equal (D-204), each card's minimum data (D-203) and wording outcomes (D-206, D-214), the bell curve's and the routine card's bean (D-205, D-210, D-213), consistency pooled within recipe (D-211), the 12-week span with gaps (D-212), weeks in the user's time zone (D-208), unrated shots never counted as 0 (D-11), σ divided by n − 1; integration tests: `shot_facts` has one row per shot with the right values, shots on archived gear still count, another account's shots never appear; Home's Dial-in progress graph reads from `shot_facts` and its tests still pass; end-to-end tests: the Insights tab opens from the tab bar and opens on What I like (D-208), each chip shows its cards, tapping a chart shows its exact numbers, a new account sees what each card needs (D-207), saving a shot updates the header and rating a shot updates the score cards; no request leaves the server.

## M10 — PWA and offline ◐
Manifest and icons (D-217), service worker cache, shot queue in IndexedDB with exactly-once sending, local draft, waiting state in the Journal (D-61, D-217 to D-229). Needs https (D-218).

Planned in four pull requests: the installable app (manifest, the logo as icon, the service worker for the app's own files, updates that wait for the next open, D-217, D-227); opening offline (the cached data to brew, read-only cached pages with the "Offline" line, sign out clears the phone, D-219, D-225); the shot queue (new and edited shots and scores, the phone's brew time, "Waiting to send" and "Not saved", D-220 to D-224); the local draft and the "could not be saved" messages (D-226). The installable app is built (the first pull request), the app opens offline (the second), and shots wait on the phone (the third, with the version line in Settings, D-234). The owner approves the icon and the waiting look by screenshot and checks the install and an airplane-mode shot on the Pixel 8a.

**Done when:** the app installs from Chrome on Android and opens standalone (D-228) with the logo as icon and the name Coffee Nerd (on the phone); with no connection the app opens to Home, and the shot form opens prefilled for every open bean with the right recipe tag (D-219); a shot saved offline shows at once as waiting in the Journal and on Home, and the next shot starts from it (D-221, D-222); when the connection returns, waiting shots are sent in the order they were brewed, keep their brew time and are each saved exactly once, also when sending is interrupted and repeated (D-220); edited shots and scores given offline wait and are sent the same way, the latest change winning (D-223); a queued shot the server refuses is kept as "Not saved" and can be fixed or deleted (D-224); Library and Settings changes made offline say they need a connection and change nothing (D-219); a reload or closing the app during a shot never loses input (D-226); signing out asks first when shots are waiting and leaves nothing on the phone (D-225); a new version never interrupts an open form (D-227); over plain http the app works online as before (D-218); an airplane-mode shot on the Pixel 8a arrives once after reconnecting (on the phone).

## M11 — Settings, backup and release ☐
Settings behind the Home gear icon: units, backup (copy of the SQLite file) and export (CSV/JSON). Docker image published, install guide in `README.md`. Prepare for open source: license choice, contributing guide (open topic 26).
