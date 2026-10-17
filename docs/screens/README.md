# Screens

Every designed screen, exported from the UX canvas (https://claude.ai/artifact/24VoMGemZnPse9G8EDzQbv) at the reference size, Pixel 8a **412 × 915** (PNGs at 2× pixel density).

- `<Screen>.png` — what the screen must look like. Compare your screenshot against it.
- `<Screen>.html` — the same screen as static HTML with inline styles: exact sizes, colors, spacing and copy. Read it for measurements; never import it into the app (the app uses `design-system/` classes and tokens instead).
- `index.json` — screen order and titles. Numbers in titles match the canvas.

These are **reference only** and read-only here. When a screen changes, it is changed on the canvas and re-exported (D-69). Data shown (bean names, scores) is sample data.

| # | Screen | File |
|---|---|---|
| 1 | New shot — prefilled | `Main` |
| 2 | Results changed + rated | `Rated` |
| 3 | Recipe changed — new experiment | `RecipeChanged` |
| 4 | More — Setup | `MoreSetup` |
| 5 | More — Tasting | `MoreTasting` |
| 6 | Home | `Home` |
| 7 | Library — Beans | `Beans` |
| 8 | Library — Gear | `Equipment` |
| 9 | Library — Add bean | `AddBean` |
| 10 | Library — Bean detail | `BeanDetail` |
| 11 | New shot — started from Brew next | `BrewNext` |
| 12 | Gear — Machine detail | `GearDetail` |
| 13 | Gear — Edit My setup | `EditSetup` |
| 14 | Gear — Add your own feature | `CustomFeature` |
| 15 | Gear — Grinder detail | `GrinderDetail` |
| 16 | Gear — Basket detail | `BasketDetail` |
| 17 | Library — Landing | `Library` |
| 18 | Puck prep — Overview | `PuckPrep` |
| 19 | Puck prep — Routine builder | `RoutineBuilder` |
| 20 | Puck prep — New step | `NewStep` |
| 21 | Library — Tags | `Tags` |
| 22 | Journal | `Journal` |
| 23 | Insights — What I like | `Insights` |
| 24 | Insights — Progress | `InsightsProgress` |
| 25 | Insights — Comparisons | `InsightsCompare` |
| 26 | Journal — Shot detail | `ShotDetail` |

`Equipment` is the canvas file name for the Gear page; the UI says "Gear" (D-39).

Not designed yet (see open topics in the decision log): recipe detail, tag sheet, Home's other three graphs, more Dial-in cards, settings, login, the Journal's "waiting to sync" state, tablet layouts. Build these from the design system's components and patterns, and flag them in the pull request for review.
