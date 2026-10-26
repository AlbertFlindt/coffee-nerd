<p align="center"><img src="design-system/logo/coffee-nerd-mark.svg" width="64" height="64" alt=""></p>

# Coffee Nerd

**Data that backs up the home barista.** A self-hosted, privacy-friendly espresso journal: log a shot in seconds at the brew station, see what changed, and learn over time which beans, recipes and routines you actually like.

- Runs on your own server as one Docker container; your data stays in one SQLite file.
- Installable as an app on your phone or tablet (PWA); opens offline, and shots saved offline are sent when you're back online.
- Built for coffee nerds: recipe matching across your whole history, σ and distributions in Insights, any machine described by hand.

> **Status:** the shot form, the Journal, the shot detail, the whole Library (Beans, Gear, Puck prep, Tags), My setup, Home and Insights work, with a step-by-step start after creating the account (milestones M3 to M9). The app can be installed on a phone's home screen over https and opens offline (M10, in progress); saving shots offline comes next. Not ready for daily use yet. Private for now; it will become open source once it is mature.

## Try the latest build on your server (Dockge)

Every merge to `main` is published as the image `ghcr.io/albertflindt/coffee-nerd:main`. For trying it out, not yet for daily use: the full install guide comes with milestone M11.

1. **Once: let the server pull the private image.** On GitHub, create a personal access token (classic) with only the `read:packages` scope. On the server run `docker login ghcr.io -u AlbertFlindt` and paste the token as the password. Dockge uses the server's Docker, so this is enough.
2. **Create the stack.** In Dockge choose **+ Compose**, name it `coffee-nerd`, paste this and press **Deploy**:

   ```yaml
   services:
     coffee-nerd:
       image: ghcr.io/albertflindt/coffee-nerd:main
       ports:
         - '3000:3000'
       volumes:
         - data:/data
       restart: unless-stopped

   volumes:
     data:
   ```

   Do steps 3 and 4 right away: until the seed has run, anyone who can reach the server can claim the app, and until you set your own password the published Demo password works.

3. **Fill it with the reference setup before signing in.** The seed gives you a ready setup to try (Lelit Bianca, Timemore 064S, VST 18 g, Daily routine, one bean). In Dockge open the stack's terminal (`sh`) and run `node scripts/seed.mjs`. It only works while the app has no account yet. To use your own gear instead, skip steps 3 and 4: create your account at `http://<server>:3000` and the app walks you through your machine, grinder, basket, My setup and first bean.
4. **Sign in** at `http://<server>:3000` as **Demo** with the password **coffee-nerd**. Then set your own password in the same terminal with `node scripts/reset-password.mjs`.
5. **Update to the latest build:** press **Update** on the stack. Dockge pulls the new image and restarts it; your shots stay in the `data` volume, and database changes are applied when the app starts.

To start over, stop the stack and delete its `data` volume (`docker volume rm coffee-nerd_data`), then deploy and seed again.

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
