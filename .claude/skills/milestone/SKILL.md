---
name: milestone
description: Work through one milestone from docs/roadmap.md with the owner, from questions to merged pull requests.
disable-model-invocation: true
argument-hint: "<milestone id, e.g. M7>"
---

Work on milestone $ARGUMENTS from `docs/roadmap.md`. The owner decides product behavior and merges every pull request that needs them (D-240); you plan, ask, build, prove and report.

1. **Read** the milestone's section in `docs/roadmap.md`, the D-numbers and data-model sections it mentions, its screens in `docs/screens/`, and every item in `docs/open-items.md` that names it. Search the decision log for what you need instead of reading all of it. If an earlier milestone is not done, stop and tell the owner.
2. **Ask first.** Collect every open behavior question (undesigned states, missing rules, conflicts) and ask them with question cards (`AskUserQuestion`): up to four per card, 2–4 options each, the recommended option first with "(Recommended)", each option's consequence in one line. Record every answer with `record-decision` before building on it.
3. **Plan** in plan mode: the pull requests (one reviewable step each), and per pull request the files, the tests that prove each acceptance item, and the order. Name which parts helpers (subagents) can take: only work in separate files, done after you have built and tested the shared layer.
4. **Branch** from an up-to-date `main` (`git fetch origin main`; in a cloud session use the branch the session names, restarting it from `origin/main` after each merge).
5. **Build in small steps.** Tests first for domain and database logic; `/build-screen` for every screen. Commit after each working step with a message that names the D-numbers, and push.
   - Helpers get the screen, the D-numbers, what to reuse, and the exact files they may touch. They do not build, run the browser tests, format the whole repository or touch git. Review every line they write.
6. **Verify.** `npm run check && npm run lint && npm test && npm run test:e2e`. Fix every failure at its root; never skip or weaken a test. Compare each screen's screenshot with its reference PNG side by side.
7. **Review.** Run the `decision-reviewer` subagent on the diff against `origin/main`. Fix what affects correctness or a decision; put new owner questions on a card, and everything else left open in `docs/open-items.md`.
8. **Pull request.** Open it with the GitHub connector (`mcp__github__create_pull_request`), filling in `.github/pull_request_template.md`, with done / next / blocked under "What and why". Update `docs/roadmap.md` (◐ or ☑), `docs/open-items.md`, the README status and `docs/data-model.md` in the same pull request.
9. **Hand over and wait.** Subscribe to the pull request's activity and fix any failing check. When it is green, merge it yourself if `CLAUDE.md` ("Who merges", D-240) allows it; otherwise tell the owner with the link, the evidence and the screenshots, and wait for the merge. Start the next pull request from the new `main`.
