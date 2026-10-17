# Coffee Nerd

Self-hosted, privacy-friendly espresso journal. SvelteKit (Svelte 5, TypeScript strict) + SQLite via Drizzle, one Docker image, installable PWA. Used one-handed on a phone at the brew station; reference device Pixel 8a, 412 × 915. The owner decides product behavior and does not review code, so tests and CI are the safety net (D-62).

## Sources of truth

Read the relevant one before changing behavior or visuals. Do not import them here; open them when needed.

- `docs/ux-decision-log.md`: every product decision (D-01 …) and open topics. Behavior must match it.
- `docs/data-model.md`: entities, recipe matching, prefill, best recipe, Insights query system.
- `design-system/`: tokens, `components.css` (`cn-` classes), `components.md`. Synced copy, read-only.
- `docs/screens/`: every designed screen as PNG + static HTML at 412 × 915. Match them.
- `docs/roadmap.md`: milestones with acceptance criteria. Work on one milestone at a time.

If they disagree: decision log for behavior, design system for visuals. If something is not covered, or a decision seems wrong, stop and ask the owner. Never invent product behavior or change a decision silently.

## Commands

Node 22 (`.nvmrc`). SvelteKit 3: config lives in `vite.config.ts`, env vars are declared in `src/env.ts` and read from `$app/env/private`; import from `src/lib` as `#lib/<path>.ts`.

- `npm run dev`: dev server on port 5173
- `npm run check`: svelte-check + TypeScript
- `npm run lint` (Prettier check + ESLint) / `npm run format`
- `npm test`: Vitest unit and integration tests (`src/**/*.test.ts`). Single file: `npx vitest run <path>`
- `npm run test:e2e`: Playwright (`tests/e2e/`), builds and serves the app at 412 × 915 with its own database in `test-results/`
- `npm run build` / `npm start`: production build in `build/`, served on port 3000
- `npm run screenshot -- <route> [name]`: 412 × 915 screenshot (2×) into `screenshots/`; needs `npm run dev` running (or `BASE_URL`)
- `npm run db:generate`: new migration in `drizzle/` from `src/lib/server/db/schema.ts`. Migrations are applied when the server starts (`npm run db:migrate` applies them without starting it); the database is `DATABASE_PATH` (default `./data/coffee-nerd.db`)
- `docker compose up --build`: the production image on port 3000, data in the `/data` volume
- `node design-system/build-tokens.mjs`: regenerate `tokens.css`. Only as part of a design-system sync the owner starts; `design-system/` is otherwise read-only (D-69).

## Architecture

- `src/lib/domain/`: pure TypeScript, no I/O, shared by browser and server: units, Zod schemas, fingerprint, prefill, best recipe, statistics.
- `src/lib/server/db/`: Drizzle schema and repository functions. `src/lib/server/insights/`: shot facts, registry, insight definitions.
- `src/lib/components/`: Svelte components named after design-system components (`ValueCard.svelte` …).
- `src/routes/`: one route per screen in `docs/screens/`.
- `drizzle/`: generated migrations. Never edit a migration that is on `main`; add a new one.

## Rules that are easy to get wrong

- Decimal quantities are stored as integer thousandths (18.0 g → `18000`). Convert only in `src/lib/domain/units`.
- A recipe is immutable. Saving a shot finds or creates its recipe by fingerprint on the server, in the same transaction (D-63).
- The fingerprint ignores labels, units and names (D-65). Changing what goes into it changes recipe identity: that needs a decision.
- Taste is never prefilled (D-11). Not rated is `null`, never `0`.
- Every user-created row has `owner_id`; Library rows also `shared`. Rows that shots point to are archived (`archived_at`), never deleted. Only exception: a recipe left with no shots is deleted unless it is marked Brew next (data-model §4.1).
- A new insight is a definition in the registry, not ad-hoc SQL (D-64). σ is the sample standard deviation (n − 1).
- UI copy: plain words, no abbreviations, sentence case; "Gear", never "Equipment" (D-20, D-39).
- Screens fit the viewport; only lists scroll; no visible scrollbars (D-36). Touch targets ≥ 44 px.
- Colors only through tokens. Amber = your input, sage = changed since last shot, cherry = recipe history, nothing else (D-19).
- No external requests at runtime (fonts, analytics, CDNs): the app is self-hosted and private.

## Workflow

- Branch per task from `main` (`m3-shot-form`), pull request into `main`. Pushing to `main` is blocked by a hook.
- Use plan mode first for anything that touches more than two files or a decision.
- Domain logic: write the failing test first. Test names cite the decision: `it('D-16: returning to an earlier grind reuses that recipe')`.
- Screens: use the `/build-screen` skill. Not done until your screenshot matches the PNG in `docs/screens/`.
- Before a pull request: `npm run check && npm run lint && npm test`, then have the `decision-reviewer` subagent review the diff and fix what it finds about correctness or decisions.
- When reporting work as done, show evidence: the commands you ran and their results, screenshots for UI.
- When the owner settles a question, record it with the `record-decision` skill before building on it.
- Pull requests use `.github/pull_request_template.md`: decisions touched, evidence, anything not designed yet.

## When compacting

Keep: the current milestone, files changed, failing tests and their errors, the D-numbers involved, open questions for the owner.
