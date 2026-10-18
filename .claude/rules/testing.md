---
paths:
  - "**/*.test.ts"
  - "**/*.spec.ts"
  - "tests/**"
---

# Testing rules

- Name tests after the behavior and the decision they protect: `it('D-11: a new shot never copies the score')`.
- Prefer real objects over mocks; for the database use a temporary SQLite file.
- When fixing a bug, first write a test that fails because of it.
- Never weaken, skip or delete a test to make CI pass. If a test seems wrong, explain why and ask the owner.
- End-to-end tests run at the reference viewport (412 × 915) and use only seeded data.
- The seeded end-to-end files share one database and run in file-name order (`shot-*`, then `tab-*`, see `playwright.config.ts`). Each file leaves the demo data as it found it (archive what it adds, set values back), and a file may fail when run alone: run the whole project.
