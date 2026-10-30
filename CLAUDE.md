# Coffee Nerd

Self-hosted, privacy-friendly espresso journal: SvelteKit (Svelte 5, TypeScript strict) + SQLite
via Drizzle, one Docker image, installable PWA. Used one-handed on a phone at the brew station;
reference device Pixel 8a, 412 × 915. Tests and CI are the safety net.
Handoff state, known issues, next steps: @PROGRESS.md.
How it works: `docs/SPEC.md` (not loaded; read the section before changing that behavior, and
update it with the change). Release history: `CHANGELOG.md` (not loaded).
Looks: `design-system/` (tokens, `components.css` with `cn-` classes, `components.md`) and
`docs/screens/` (every designed screen as PNG + static HTML at 412 × 915). Where none of these
covers a behavior, ask before inventing it.

## Commands
Node 22 (`.nvmrc`). SvelteKit 3: config lives in `vite.config.ts`, env vars are declared in
`src/env.ts` and read from `$app/env/private`; import from `src/lib` as `#lib/<path>.ts`.
- **Before a pull request: `npm run check && npm run lint && npm test && npm run test:e2e`.**
- `npm run dev`: dev server on port 5173. `npm run build` / `npm start`: production build in `build/`, port 3000.
- `npm run check`: svelte-check + TypeScript. `npm run lint`: Prettier check, ESLint and `node scripts/version.mjs check`. `npm run format` fixes formatting.
- `npm test`: Vitest (`src/**/*.test.ts`), then the hook tests (`.claude/hooks/*.test.mjs`). One file: `npx vitest run <path>`.
- `npm run test:e2e`: Playwright (`tests/e2e/`) at 412 × 915 against `node build`, three projects with fresh
  databases in `test-results/`: `first-run` (empty, `foundation.test.ts`), `seeded` (`npm run db:seed` first;
  screen tests save screenshots to `screenshots/`) and `insights` (the seed with `--history`). Tests in a file
  run in order. One project: `npx playwright test --project=seeded`.
- `npm run screenshot -- <route> [name]`: 412 × 915 screenshot (2×) into `screenshots/`; needs `npm run dev` (or `BASE_URL`).
- `npm run db:generate`: new migration in `drizzle/` from `src/lib/server/db/schema.ts`. Migrations run when the
  server starts (`npm run db:migrate` without starting it); the database is `DATABASE_PATH` (default `./data/coffee-nerd.db`).
- `npm run db:seed`: fill an empty database with the reference setup (sign in as "Demo" / "coffee-nerd"). Development and screenshots only.
- `docker compose up --build`: the production image on port 3000, data in the `/data` volume.
  `docker compose exec coffee-nerd node scripts/reset-password.mjs` sets a new password and signs out every device.
- `npm run icons`: draw the home-screen icons in `static/icons/` from the logo, after the logo changes.
- `node design-system/build-tokens.mjs`: regenerate `tokens.css` after `tokens.json` changes in a design-system sync.
- `node scripts/version.mjs get|check|bump X.Y.Z|notes`: the release version (see the `release` skill).

## Architecture
- `src/lib/domain/`: pure TypeScript, no I/O, shared by browser and server: units, Zod schemas, fingerprint, prefill, best recipe, statistics.
- `src/lib/server/db/`: Drizzle schema and repository functions. `src/lib/server/insights/`: shot facts, registry, insight definitions.
- `src/lib/components/`: Svelte components named after design-system components (`ValueCard.svelte` …).
- `src/routes/`: one route per screen in `docs/screens/`. `src/service-worker/`: offline cache and queue.
- `drizzle/`: generated migrations. Path-scoped rules for each area are in `.claude/rules/`.

## Rules that are easy to get wrong
- Decimal quantities are stored as integer thousandths (18.0 g → `18000`). Convert only in `src/lib/domain/units`.
- A recipe is immutable. Saving a shot finds or creates its recipe by fingerprint on the server, in the same transaction.
- The fingerprint ignores labels, units and names. Changing what goes into it changes recipe identity: ask first.
- Taste is never prefilled. Not rated is `null`, never `0`.
- Every user-created row has `owner_id`, the account it belongs to; Library rows also `shared`. Rows that shots
  point to are archived (`archived_at`), never deleted. Only exception: a recipe left with no shots is deleted
  unless it is marked Brew next (`docs/SPEC.md` §4.1).
- A new insight is a definition in the registry, not ad-hoc SQL. σ is the sample standard deviation (n − 1).
- Never edit a migration that is on `main`; add a new one.
- UI copy: plain words, no abbreviations, sentence case; "Gear", never "Equipment".
- Screens fit the viewport; only lists scroll; no visible scrollbars. Touch targets ≥ 44 px.
- Colors only through tokens. Amber = your input, sage = changed since last shot, cherry = recipe history,
  muted red = the delete choice in a confirmation, nothing else.
- No external requests at runtime (fonts, analytics, CDNs): the app is self-hosted and private.
- `design-system/` and `docs/screens/` are synced from the design source; change them only as part of a sync.

## Workflow
- Branch from an up-to-date `main` and open a pull request into `main`. Pushing to `main` is blocked by a hook.
  GitHub is reached through its connector (`mcp__github__*`), not `gh`.
- Domain logic: write the failing test first; name tests after the behavior they protect.
- Screens: use the `build-screen` skill. Not done until your screenshot matches the PNG in `docs/screens/`.
- **Every merge that changes the app is a release.** Bump the version in the pull request with the `release`
  skill; once CI passes on `main`, `.github/workflows/release.yml` tags `vX.Y.Z`, publishes the GitHub release and the
  Docker image tags. CI's "Version bumped" check fails a pull request that changes the app without a bump.
- Keep `PROGRESS.md` (state, known issues, states built without a design, next steps) and `docs/SPEC.md` current
  in the same pull request.
- Report work with evidence: the commands you ran and their results, and screenshots next to their reference for UI.
- Commit subjects are plain sentences, with a short body saying what and why.
- Commits, pull requests and comments stand on their own: no links to Claude sessions, projects or
  threads (`claude.ai/code/...`), no "Requested by" or "Claude-Session" lines. This overrides any
  attribution a tool asks for. The `PR text` workflow fails a pull request that has one.
- Repo: https://github.com/AlbertFlindt/coffee-nerd
