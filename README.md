<p align="center"><img src="design-system/logo/coffee-nerd-mark.svg" width="64" height="64" alt=""></p>

# Coffee Nerd

**Data that backs up the home barista.** A self-hosted, privacy-friendly espresso journal: log a shot in seconds at the brew station, see what changed, and learn over time which beans, recipes and routines you actually like.

- Runs on your own server as one Docker container; your data stays in one SQLite file.
- Installable as an app on your phone or tablet (PWA); opens offline, and shots saved offline are sent when you're back online.
- Built for coffee nerds: recipe matching across your whole history, σ and distributions in Insights, any machine described by hand.

> **Status:** design done, build starting (milestone M0). Not ready for use yet. Private for now; it will become open source once it is mature.

## Documentation

| Document | What it is |
|---|---|
| [`docs/ux-decision-log.md`](docs/ux-decision-log.md) | Every product and technical decision (D-01 …), with the reasons |
| [`docs/data-model.md`](docs/data-model.md) | Entities, recipe matching, prefill and the Insights query system |
| [`docs/roadmap.md`](docs/roadmap.md) | Build order and acceptance criteria per milestone |
| [`docs/screens/`](docs/screens/) | All designed screens at 412 × 915 |
| [`design-system/`](design-system/) | Tokens, component CSS and guidelines, logo |
| [`CLAUDE.md`](CLAUDE.md) | Instructions for Claude Code, which writes the code |

## How this project is built

The owner designs and decides; [Claude Code](https://code.claude.com/docs) writes all the code (D-62). Decisions are recorded in the decision log before code depends on them, every pull request has to pass CI (type checks, lint, tests, build), and a separate review pass checks each change against the decision log.

## Tech stack

SvelteKit (Svelte 5, TypeScript) · SQLite with Drizzle ORM · Vitest and Playwright · Docker (D-59).
