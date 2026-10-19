# Screens

Every designed screen, exported from the UX canvas (https://claude.ai/artifact/24VoMGemZnPse9G8EDzQbv) at the reference size, Pixel 8a **412 × 915** (PNGs at 2× pixel density).

- `<Screen>.png` — what the screen must look like. Compare your screenshot against it.
- `<Screen>.html` — the same screen as static HTML with inline styles: exact sizes, colors, spacing and copy. Read it for measurements; never import it into the app (the app uses `design-system/` classes and tokens instead).
- `index.json` — screen order and titles. Numbers in titles match the canvas.

These are **reference only**: never edit them by hand. When a screen changes, it is changed on the canvas and re-exported, by the owner or by Claude (D-69, D-183). Data shown (bean names, scores) is sample data.

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
| 27 | New shot — Machine and grinder | `ShotGearSheet` |
| 28 | More — Basket list | `MoreBasket` |
| 29 | More — Setup with your own features | `MoreOwnFeatures` |
| 30 | More — Setup › Puck prep | `MorePuckPrep` |
| 31 | Add bean — Same as before | `BeanSameAsBefore` |
| 32 | Add bean — Country | `BeanCountry` |
| 33 | Add bean — Re-buy picked | `BeanRebuy` |
| 34 | Bean detail — Finished, with Undo | `BeanFinished` |
| 35 | Edit bean — Delete bean | `BeanDelete` |
| 36 | Gear — Add gear | `GearAdd` |
| 37 | Gear — Before My setup | `GearFirstRun` |
| 38 | Gear — New grinder | `GrinderNew` |
| 39 | Gear — New basket | `BasketNew` |
| 40 | Gear — Archive a basket | `GearArchive` |
| 41 | Gear — Own feature, pick from a list | `FeatureList` |
| 42 | Gear — Own feature, used by shots | `FeatureEdit` |
| 43 | Edit My setup — Your own features | `SetupFeatures` |
| 44 | Edit My setup — Machine picker | `SetupPicker` |
| 45 | Edit My setup — No machines yet | `SetupPickerEmpty` |
| 46 | Edit My setup — Pressure profile | `SetupPressure` |
| 47 | Start — Step 1 of 5, machine | `GuideMachine` |
| 48 | Start — Step 3 of 5, basket | `GuideBasket` |
| 49 | Start — Step 4 of 5, My setup | `GuideSetup` |
| 50 | Puck prep — New routines | `PuckPrepNew` |
| 51 | Puck prep — No routines yet | `PuckPrepEmpty` |
| 52 | Puck prep — Edit a step | `StepEdit` |
| 53 | Puck prep — A step shots have used | `StepUsed` |
| 54 | Routine builder — Insert a step | `RoutineInsert` |
| 55 | Routine builder — A step’s value | `RoutineValue` |
| 56 | Routine builder — Archive a routine | `RoutineArchive` |
| 57 | Tags — Searching | `TagsSearch` |
| 58 | Tags — No match | `TagsNoMatch` |
| 59 | Tags — New tag | `TagNew` |
| 60 | Tags — Your own tag | `TagEdit` |
| 61 | Tags — A built-in tag | `TagBuiltIn` |
| 62 | Tags — Merge into | `TagMergeList` |
| 63 | Tags — Merge into Caramel? | `TagMergeConfirm` |
| 64 | Tags — Remove a tag | `TagRemove` |

`Equipment` is the canvas file name for the Gear page; the UI says "Gear" (D-39).

Screens 27–64 draw the states that were first built without a design (D-183); `docs/open-items.md` lists which item each one settles.

Not designed yet (see open topics in the decision log): recipe detail, Home's other three graphs, more Dial-in cards, settings, login, the Journal's "waiting to sync" state, tablet layouts. Build these from the design system's components and patterns, and flag them in the pull request for review.
