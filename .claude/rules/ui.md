---
paths:
  - "src/**/*.svelte"
  - "src/**/*.css"
  - "src/routes/**"
---

# UI rules

- Build from the design system: `cn-` classes from `design-system/components.css` and CSS variables from `tokens.css`. No hex colors, no new font sizes, no borders or dividers for separation (surfaces do that, D-18).
- Before building a screen, open its PNG and HTML in `docs/screens/` and the D-numbers it involves. Copy text exactly as designed.
- One full-width primary action per task screen, at the bottom (D-14). Bottom sheets stop above Save (D-21).
- Every −/+ shows its step with unit ("+ 0.1 g"); steps come from the gear, never hard-coded (D-07).
- `cream` marks at most one element per screen. Accents keep their one job (D-19); color is never the only signal.
- Numbers use tabular figures (already on `.cn-root`). Inputs are 16 px so phones do not zoom.
- Accessible markup: real `<button>`, `<a href>`, `<label>` + `<input>`; `aria-label` on icon-only buttons; icons are inline stroke SVG (2 px, round caps), never emoji.
- The tab bar (Home · Journal · + · Library · Insights) appears on tab screens, not on task screens (shot form, forms, sheets).
- Use the `/build-screen` skill; a screen is not done until its screenshot matches the reference.
