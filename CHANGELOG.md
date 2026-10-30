# Changelog

All notable changes to Coffee Nerd. Each version is a tag and a GitHub release.

## 1.0.2 (2026-10-30)

### Changed
- **Sign in and Create your account** have their own design: the logo, the name and the tagline
  welcome you, each password field has a button that shows what you typed, and a line under the
  button says how to reset a forgotten password or that everything stays on your server.

## 1.0.1 (2026-10-30)

### Changed
- **Installing:** the Docker image is public, so the server pulls it without signing in to GitHub.
  The README's install guide now covers creating your account right away, a reverse proxy with
  https (Caddy and nginx examples) and updating.
- **No sample setup in the Docker image:** `scripts/seed.mjs` and its Demo account are no longer in
  the image. They stay in the source for development (`npm run db:seed`).

## 1.0.0 (2026-10-30)

The first release: a self-hosted espresso journal for your phone.

### Added
- **Shot form:** a new shot starts from the recipe marked Brew next, this bean's best recipe or
  your My setup, so logging one is a few taps. Grind, dose, yield and time change with −/+ in your
  gear's steps; values changed since the last shot turn green, and the recipe tag says whether you
  reused a recipe or what changed. Score, balance, body, sweetness, aftertaste, flavor notes and
  your own notes, never filled in for you. Setup holds the machine's features, your own features
  and the puck prep routine.
- **Journal and shot detail:** your shots by day, filtered by bean, recipe or the unrated ones, and
  rated right from the list. A shot's page compares it with its recipe's other shots, and you can
  edit or delete it.
- **Library:** Beans (with "Same as before" for a re-buy, grams left, and bags that finish
  themselves), Gear (machines, grinders and baskets described by hand, with your own features),
  Puck prep (steps and routines) and Tags (flavor notes by family, with duplicates to merge).
  Archived items leave the lists; past shots keep them.
- **My setup:** the gear, routine and values every new bean starts from.
- **Home:** the last shot, bean freshness, this week, the best recipe for your bean and a graph of
  your score per shot while you dial in.
- **Insights:** What I like, Progress, Dial-in and Comparisons, each card a finding in plain words
  with its chart (box plots, mean ± σ, a weekly line with its spread, a bell curve) and the number
  of shots it rests on.
- **A step-by-step start** after you create your account: machine, grinder, basket, My setup and
  first bean.
- **Installable app:** over https, add it to your phone's home screen. Home, the Journal and the
  shot form open offline, and shots saved offline are sent when the server answers.
- **Settings:** the −/+ steps for dose, yield and time, a full backup as one file, exports of your
  shots as CSV and of everything as JSON, sign-out, and the version.
- **Self-hosted:** one Docker image with your data in one SQLite file, a password reset from the
  server's command line, and no outside requests.
