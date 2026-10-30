---
paths:
  - "src/lib/domain/**"
---

# Domain rules

- Pure functions only: no database, no `fetch`, no `Date.now()` inside logic (pass the time in). This code runs in the browser too (offline recipe matching).
- Quantities are integer thousandths. Never use floating-point arithmetic for stored values; round once, at the edge, in `units`.
- Specs, features, step settings and setup snapshots are validated with the Zod schemas here; the server validates again on save.
- Follow `docs/SPEC.md` §4 exactly (matching, prefill order, best recipe, Brew next). If it is ambiguous, ask; do not guess.
- Statistics: sample σ (n − 1); one documented quartile method; return `null` rather than a number when there are too few values.
- Each exported function has unit tests named after the behavior they protect, written before the implementation.
