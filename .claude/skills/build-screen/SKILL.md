---
name: build-screen
description: Build or change a Coffee Nerd screen from the design system and the spec. Use whenever implementing or restyling a route or screen component.
argument-hint: "<Screen name, e.g. Main or BeanDetail>"
---

Build the screen `$ARGUMENTS`.

1. **Gather the spec.** Read the `docs/SPEC.md` sections for the data and behavior it shows, and
   `design-system/components.md` for the components it uses. If behavior is unclear or a state is
   not designed, ask instead of inventing it.
2. **Build** with `cn-` classes and tokens only. Reuse existing components in `src/lib/components/`
   before creating new ones.
3. **Verify visually.** Take the screenshot with `npm run screenshot -- <route> $ARGUMENTS` (dev
   server with seeded data running), or from the screen's end-to-end test, which saves it to
   `screenshots/`. Check it against the design-system components and the UI rules.
4. **Verify behavior.** Add or update a Playwright test for the screen's main interaction at
   412 × 915. Check that the screen fits without page scrolling and that only its list area scrolls.
5. **Report** with the final screenshot, the commands you ran with their results, and any open
   questions.
