# Roadmap

Each milestone is a major version. Its items land as minor releases on the way; the major
release comes when the milestone is done. What's being worked on right now is under "Next steps"
in `PROGRESS.md`. Behavior for each item is agreed and written into `docs/SPEC.md` before building.

## 2.0: Your data and your login
Goal: moving to a new server, or signing in with the homelab's login, takes no terminal.
- [ ] Import "Export everything" (JSON) in Settings. To decide: into an empty account only, or
      merged into an existing one (matching beans, gear and tags by name).
- [ ] Single sign-on. To decide: OpenID Connect (Pocket ID, Authelia, Authentik), a trusted
      header from a forward-auth proxy (Tinyauth), or both. The password sign-in stays.

## 3.0: More ways to brew
Goal: the journal works for filter and immersion coffee, not only espresso.
- [ ] A brew method on the recipe: espresso, pour over, cold brew, AeroPress, French press.
      It goes into the fingerprint, so recipe identity changes: agree the migration first.
- [ ] Each method's own values (bloom, pours, steep time, water temperature) and Setup rows.
- [ ] Home, the Journal and Insights per method; espresso stays the default.

## Backlog (minor releases, no milestone)
- [ ] More Insights cards: grind vs. time, sour/bitter vs. ratio, flavor families, grinders and
      baskets (score by roaster is built).
- [ ] Tap to type on the Setup sheet and pressure profile rows (−/+ only: 18 taps to 9.0 bar).
- [ ] Households: a Library per person, or a share switch. The backup then covers one account,
      or only an administrator can make it.
- [ ] A choice of units (degrees Fahrenheit, ounces).
- [ ] Tablet layouts, a light theme, focus and hover styles, and a layout for small phones.
- [ ] Measuring gear (scales, refractometers) and a marker for a burr change or recalibration.
