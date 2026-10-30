---
name: build-screen
description: Build or change a Coffee Nerd screen so it matches its design reference. Use whenever implementing or restyling a route or component that appears in docs/screens/.
argument-hint: "<Screen name from docs/screens, e.g. Main or BeanDetail>"
---

Build the screen `$ARGUMENTS` so it matches its reference.

1. **Gather the spec.**
   - Look at `docs/screens/$ARGUMENTS.png` and read `docs/screens/$ARGUMENTS.html` for exact sizes, spacing and copy.
   - Read the `docs/SPEC.md` sections for the data and behavior it shows, and its entry in `docs/screens/README.md`.
   - Read `design-system/components.md` for the components it uses.
2. **Plan** which design-system components and routes are involved, and what data the screen needs. If behavior is unclear or a state is not designed, ask instead of inventing it.
3. **Build** with `cn-` classes and tokens only. Reuse existing components in `src/lib/components/` before creating new ones. Copy UI text exactly from the reference.
4. **Verify visually.** Take the screenshot with `npm run screenshot -- <route> $ARGUMENTS` (dev server with seeded data running), or from the screen's end-to-end test, which saves it to `screenshots/`. Open it and the reference PNG side by side. List every difference in layout, spacing, size, color, text and icon, fix them, and repeat until the only differences are data values.
5. **Verify behavior.** Add or update a Playwright test for the screen's main interaction at 412 × 915. Check that the screen fits without page scrolling and that only its list area scrolls.
6. **Report** with the final screenshot next to the reference PNG, the commands you ran with their results, and any open questions. Add each state built without a design to the "Built without a design" list in `PROGRESS.md`.
