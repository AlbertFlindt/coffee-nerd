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

## M3 — Shot form ☐  (screens 1–5, 11)
New shot with prefill, deltas, recipe tag, balance, score, More sheet (Setup and Tasting), Brew next banner. Uses seeded gear and beans; pickers can be minimal until M5–M6.

**Done when:** screenshots of each state match `Main`, `Rated`, `RecipeChanged`, `MoreSetup`, `MoreTasting`, `BrewNext`; end-to-end test: log three shots, go back to the first grind, tag says "Recipe reused".

## M4 — Journal and shot detail ☐  (screens 22, 26)
Day-grouped list, filters, Rate block, shot detail with "Compared with this recipe" (σ), edit via the shot form.

## M5 — Beans ☐  (screens 7, 9, 10)
Overview, Add bean with "Same as before", bean detail with recipes and Brew next, finish and reopen with undo.

## M6 — Gear and My setup ☐  (screens 8, 12–16)
Gear list, machine/grinder/basket detail, Add your own feature, Edit My setup. Library landing (screen 17).

## M7 — Puck prep and Tags ☐  (screens 18–21)
Routines overview, routine builder (drag, insert), New step, Tags page with families, merge and duplicate finder.

## M8 — Home ☐  (screen 6)
Bean scope, last shot, quick numbers, best recipe, Dial-in progress graph (the other three graphs await design, open topic 15).

## M9 — Insights ☐  (screens 23–25)
`shot_facts` view, measure/dimension registry, insight definitions, the chart components (box plot, mean ± σ, line with σ band, bell curve, σ bars) with tap tooltips (D-55, D-56, D-64).

## M10 — PWA and offline ☐
Manifest and icons (open topic 17), service worker cache, shot queue in IndexedDB with exactly-once sending, local draft, waiting state in the Journal (D-61, open topic 23).

## M11 — Settings, backup and release ☐
Settings behind the Home gear icon: units, backup (copy of the SQLite file) and export (CSV/JSON). Docker image published, install guide in `README.md`. Prepare for open source: license choice, contributing guide (open topic 26).
