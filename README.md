<p align="center">
  <img src="design-system/logo/coffee-nerd-mark.svg" alt="" width="128">
</p>

<h1 align="center">Coffee Nerd</h1>

<p align="center">
  Data that backs up the home barista. A self-hosted espresso journal for your phone:<br>
  log a shot in seconds at the machine, see what changed, and learn which beans and recipes you like.
  Coffee Nerd stores everything on your own server and makes no outside requests.
</p>

<p align="center">
  <a href="https://github.com/AlbertFlindt/coffee-nerd/releases/latest"><img src="https://img.shields.io/github/v/release/AlbertFlindt/coffee-nerd?label=release" alt="Latest release"></a>
  <a href="https://github.com/AlbertFlindt/coffee-nerd/actions/workflows/ci.yml"><img src="https://github.com/AlbertFlindt/coffee-nerd/actions/workflows/ci.yml/badge.svg" alt="CI"></a>
  <a href="#license"><img src="https://img.shields.io/badge/license-AGPL--3.0-blue" alt="License: AGPL-3.0"></a>
</p>

<p align="center">
  <a href="#features">Features</a> ·
  <a href="#requirements">Requirements</a> ·
  <a href="#installation">Installation</a> ·
  <a href="#back-up-and-restore">Back up and restore</a> ·
  <a href="#running-from-source">Running from source</a>
</p>

## Features

| Feature       | What it does                                                                                               |
| ------------- | ---------------------------------------------------------------------------------------------------------- |
| **Shot form** | Starts from your best recipe, so a shot is a few taps. Shows what changed and whether you reused a recipe. |
| **Journal**   | Every shot by day, filtered by bean, recipe or unrated. Open one to see, edit or delete it.                |
| **Library**   | Your beans, gear (machines, grinders, baskets), puck prep routines and flavor tags.                        |
| **Home**      | The last shot, bean freshness, this week, the best recipe for your bean and your dial-in progress.         |
| **Insights**  | What you like, your progress, dial-in and fair comparisons, with σ and distributions.                      |
| **Offline**   | Install it on your phone's home screen. It opens offline and sends shots saved offline later.              |
| **Your data** | A full backup in one file, exports as CSV and JSON, and import of the JSON on a new server.                |

## Requirements
- A x86-64 server with Docker.
- For installing on a phone and using it offline setup a reverse proxy for https.

## Installation
Coffee Nerd is one container with one data volume. The newest release is
`ghcr.io/albertflindt/coffee-nerd:latest`
The next version, to try before it's out, is `:pre-release`: it holds every merge since the latest release and moves to each new one (after a stable release, it is that release).

**Docker compose**
   ```yaml
   services:
     coffee-nerd:
       image: ghcr.io/albertflindt/coffee-nerd:latest
       ports:
         - '3000:3000'
       volumes:
         - data:/data
       restart: unless-stopped

   volumes:
     data:
   ```


The app then walks you through your machine, grinder, basket, My Setup and first bean, one step at a time. Coming from another server? Choose **Move my journal** (see [Back up and restore](#back-up-and-restore)).

**Put it behind https** to install it on your phone and use it offline (see below).

### Behind a reverse proxy
Point your proxy to port 3000 and forward `X-Forwarded-Proto`, so the sign-in cookie is marked secure. If the proxy changes the host name, forward `X-Forwarded-Host` too, or forms are refused.

## Updating
Run `docker compose pull && docker compose up -d`. Your shots stay in the `data` volume, and database changes are applied when the app starts. Download a backup first (see below) if you want a way back.

## Password and starting over
**Password:** `docker compose exec coffee-nerd node scripts/reset-password.mjs` sets a new one and signs out every device.

**Start over:** stop the app and delete its `data` volume (`docker volume rm coffee-nerd_data`).

## Back up and restore
**Back up** in the app: Settings › **Download backup** saves the whole database as one file, `coffee-nerd-backup-<date>.db`. Keep it somewhere private: it holds everything, including your password in scrambled form.
**Export shots**: a CSV for spreadsheets
**Export everything**: Export everything to a  JSON.

**Move to a new server** without a terminal: Settings › **Export everything** on the old one. On the new one, choose **Move my journal** when you create your account, and pick that file. (An account made with a new journal can still import under Settings › **Import everything** until you add anything to it.)

**Restore** on the server, as a deliberate step: it replaces all data in the app with the backup.

1. Stop the app: `docker compose stop`.
2. Put the backup file in a folder on the server, open a terminal there and run, with your file's name:

   ```sh
   docker run --rm -v coffee-nerd_data:/data -v "$PWD":/backup debian:bookworm-slim sh -c \
     'rm -f /data/coffee-nerd.db-wal /data/coffee-nerd.db-shm &&
      cp /backup/coffee-nerd-backup-2026-10-30.db /data/coffee-nerd.db &&
      chown 1000:1000 /data/coffee-nerd.db'
   ```

   Removing the `-wal` and `-shm` files matters: they belong to the old database.
3. Start the app again: `docker compose start`. A backup from an older version is brought up to date when the app starts.
   Every device signs in again.

## Running from source
Needs Node 22.

```sh
npm ci
npm run db:seed        # optional: the reference setup (Demo / coffee-nerd)
npm run dev            # http://localhost:5173
npm run check && npm run lint && npm test && npm run test:e2e
docker compose up --build   # the production image on port 3000
```

SvelteKit (Svelte 5, TypeScript), SQLite with Drizzle ORM, Vitest and Playwright. How the app works
inside, from the data model to recipe matching and Insights, is in [docs/SPEC.md](docs/SPEC.md).

## Contributing
Bug reports, ideas and pull requests are welcome: see [CONTRIBUTING.md](CONTRIBUTING.md).

## Security
To report a vulnerability, see [SECURITY.md](SECURITY.md).

## Changes
See [CHANGELOG.md](CHANGELOG.md) and the [releases](https://github.com/AlbertFlindt/coffee-nerd/releases).
What's planned: [ROADMAP.md](ROADMAP.md).

## License
Coffee Nerd is free software, licensed under the GNU Affero General Public License, version 3
only (AGPL-3.0-only). If you run a changed version for others over a network, you must offer them
its source. The full text is in [LICENSE](LICENSE).
