---
name: build-screen
description: Build or change a Coffee Nerd screen so it matches its design reference. Use whenever implementing or restyling a route or component that appears in docs/screens/.
argument-hint: "<Screen name from docs/screens, e.g. Main or BeanDetail>"
---

Build the screen `$ARGUMENTS` so it matches its reference.

1. **Gather the spec.**
   - Look at `docs/screens/$ARGUMENTS.png` and read `docs/screens/$ARGUMENTS.html` for exact sizes, spacing and copy.
   - Find every decision that governs it: search `docs/ux-decision-log.md` for the screen's name and the D-numbers in its title or `docs/screens/README.md`. Read those entries in full.
   - Read `design-system/components.md` for the components it uses.
2. **Plan** which design-system components and routes are involved, and what data the screen needs. If behavior is unclear or a state is not designed, list it as a question for the owner instead of inventing it.
3. **Build** with `cn-` classes and tokens only. Reuse existing components in `src/lib/components/` before creating new ones. Copy UI text exactly from the reference.
4. **Verify visually.** Start the dev server with seeded data, then `npm run screenshot -- <route> $ARGUMENTS`. Open your screenshot and the reference PNG side by side. List every difference in layout, spacing, size, color, text and icon, fix them, and repeat until the only differences are data values.
5. **Verify behavior.** Add or update a Playwright test for the screen's main interaction at 412 × 915. Check that the screen fits without page scrolling and that only its list area scrolls (D-36).
6. **Report** with the final screenshot path, the commands you ran with their results, and any questions or undesigned states.
