---
paths:
  - "src/**/*.svelte"
  - "src/**/*.css"
  - "src/routes/**"
---

# UI rules

- Build from the design system: `cn-` classes from `design-system/components.css` and CSS variables from `tokens.css`. No hex colors, no new font sizes, no borders or dividers for separation (surfaces do that).
- Before building a screen, open its PNG and HTML in `docs/screens/` and the `docs/SPEC.md` sections it touches. Copy text exactly as designed.
- One full-width primary action per task screen, at the bottom. Bottom sheets stop above Save.
- Every −/+ shows its step with unit ("+ 0.1 g"); steps come from the gear, never hard-coded.
- `cream` marks at most one element per screen. Accents keep their one job; color is never the only signal.
- Figtree is self-hosted (the `woff2` files in `docs/screens/fonts/` or `@fontsource/figtree`). Never load Google Fonts, although the design-system README and screen HTML mention it: no external requests (privacy).
- Numbers use tabular figures (already on `.cn-root`). Inputs are 16 px so phones do not zoom.
- Pressed feedback: `cn-tap` on buttons and rows, `cn-tap-strong` on the primary button; not on radio choices or switches, whose selected state is the feedback.
- A state no design covers (problem lines, empty states, captions): ask before inventing it, then add it to the "Built without a design" list in `PROGRESS.md`.
- Accessible markup: real `<button>`, `<a href>`, `<label>` + `<input>`; `aria-label` on icon-only buttons; icons are inline stroke SVG (2 px, round caps), never emoji.
- The tab bar (Home · Journal · + · Library · Insights) appears on tab screens, not on task screens (shot form, forms, sheets).
- Use the `build-screen` skill; a screen is not done until its screenshot matches the reference.
