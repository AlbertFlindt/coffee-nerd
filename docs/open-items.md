# Coffee Nerd — Open items

Everything that is unanswered, not designed yet, or deliberately left for later, in one place, so nothing is forgotten. Each item names the milestone that needs it (`docs/roadmap.md`), so it gets settled in time.

- **Add** an item in the same pull request that finds it: a question you could not answer, a state with no design, a shortcut or limitation in code.
- **Close** an item by deleting it in the pull request that settles it, naming the decision (D-nn) or the change.
- Before planning a milestone, read every item that names it, and get the owner's answers before building on them.

The decision log keeps the history of product topics; this file is the working list.

Last updated: 2026-10-17

---

## 1. Questions for the owner

| Question | Needed by | Source |
|---|---|---|
| Can a shot be saved without a time or yield? Both can start empty (D-72, D-82); the database allows empty for now | M3 | M2 |
| Where do the dose, yield and time steps live? D-07 gives 0.1 g, 0.1 g and 1 s, but no gear holds them (the grinder holds the grind step) | M3 | M2 |
| A password needs at least 8 characters (my default, not decided). Keep, change, or drop the minimum? | M3 | M2, D-85 |
| Sign-in details chosen without a decision: the name ignores upper/lower case and spaces; after 5 wrong passwords in 15 minutes sign-in waits a minute ("Too many tries. Wait a minute and try again."). Keep? | M3 | M2, D-85 |
| Editing a shot (D-57) does not finish or reopen a bean, even when the edit changes the dose so the bag is used up (or no longer used up). Should an edit apply D-40 too? | M4 | M2, D-40 |
| Edit My setup shows yield steps of 0.5 g; D-07 and the shot form use 0.1 g. Which is right? | M6 | M2, `docs/screens/EditSetup.png` |

## 2. Screens and states not designed yet

| What is missing | Needed by | Source |
|---|---|---|
| Proper design for the sign-in and "Create your account" pages (built simple for now) | Before release (M11) | D-84 |
| First-run guide: after creating the account, how you add your gear, puck prep and My setup | M6 | D-88 |
| Setup sheet: how a changed setup value is highlighted | M3 | Open topic 11, D-22 |
| Recipe detail (a recipe's shots), opened from the bean detail page | M5 | Open topic 9, D-42 |
| Gear: the message on an item My setup uses, "Used in My setup · choose another default first" | M6 | D-83 |
| Tag sheet: rename, merge, remove | M7 | Open topic 14, D-29, D-53 |
| Home: the other three graphs (time vs. yield, score vs. roast age, recipe consistency) | M8 | Open topic 15, D-32 |
| Home: replace the placeholder start page (logo, name and a temporary "Sign out" button) | M8 | M0, M2 |
| Where "Sign out" lives (for now on the placeholder start page; Settings is the likely home) | M11 | M2 |
| **Insights: the Dial-in tab has no design** (What I like, Progress and Comparisons do); more Dial-in cards, e.g. grind vs. time, sour/bitter vs. ratio | M9 | Open topic 16, D-55, D-56 |
| Journal: how a shot that is still waiting to sync looks | M10 | Open topic 23, D-61 |
| App icon for the home screen (PWA) | M10 | Open topic 17 |
| Settings (units, backup, export) | M11 | Roadmap M11 |
| Tablet layouts, light theme, focus and hover styles | Not scheduled | Open topic 5, design-system README |

## 3. Product topics not decided yet

| Topic | Needed by | Source |
|---|---|---|
| Interaction principles (written rulebook) | Not scheduled | Open topic 4 |
| Test at a real brew station | After M3 | Open topic 6 |
| Success metrics (time to log, % rated, repeat rate) | Not scheduled | Open topic 7 |
| Measuring gear (scales, refractometers) | Not scheduled | Open topic 20, D-47 |
| Grinder burr change / recalibration marker | Not scheduled | Open topic 21 |
| Households: own Library each, or a share toggle | Not scheduled | Open topic 22, D-60 |
| Open source: license, contributing guide, code of conduct | M11 | Open topic 26 |
| Optional: `@claude` in GitHub issues and pull requests | Not scheduled | Open topic 27 |

## 4. Code and tooling to revisit

| Item | When | Source |
|---|---|---|
| `main` is not protected: GitHub does not enforce the "Require pull request" ruleset on a private repository without a Team plan. The push-guard hook and the review step are the safeguard. | When the repository goes public | Roadmap M0, D-62 |
| Playwright is pinned to 1.56.1 and CI to `ubuntu-24.04`, to match the browser in the development environment. Upgrade both together. | Any time | PR #1 |
| Install guide: create the account right after starting the server, before others can reach it; until then anyone who can open the app can claim it (D-88) | M11 | M2 |
| Install guide: behind a reverse proxy with https, forward `X-Forwarded-Proto` (and `X-Forwarded-Host` if the proxy changes the host), so the sign-in cookie is marked secure and forms are accepted | M11 | M2 |
| End-to-end tests start from an empty database to test first run; screen tests from M3 need the reference seed (testing rule: seeded data only). Plan: a second Playwright project whose server runs `npm run db:seed` first | M3 | M2 |
| `npm audit`: 4 moderate advisories from an old esbuild inside drizzle-kit (development only, not in the Docker image). Recheck when drizzle-kit updates. | Each dependency update | PR #1 |
| The push guard still blocks a command whose single-line commit text looks like a push to `main` (e.g. a literal `push\nto main`). Safe side; a fix needs a shell parser. | Only if it gets in the way | PR #2 |
