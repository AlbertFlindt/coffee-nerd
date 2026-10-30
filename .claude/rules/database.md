---
paths:
  - "src/lib/server/**"
  - "drizzle/**"
  - "drizzle.config.ts"
---

# Database and server rules

- The schema follows `docs/SPEC.md` §3. A change to it is a change to that document too.
- Change the schema in `src/lib/server/db/schema.ts`, then `npm run db:generate`. Never hand-edit a migration that is already on `main`.
- Every query is scoped by `owner_id`, the signed-in account. No endpoint returns another user's rows.
- Saving a shot: validate, recompute the fingerprint on the server (never trust the client's), find-or-create the recipe, insert the shot, clear Brew next, all in one transaction (`docs/SPEC.md` §4.1).
- Shots from the offline queue carry their own UUID v7; inserting the same ID twice must be a no-op.
- Rows that shots reference are archived, not deleted. Hard deletes only for recipes left with no shots, unless marked Brew next (`docs/SPEC.md` §4.1, step 6).
- Integration tests use a fresh temporary SQLite file per test file, never `./data`.
