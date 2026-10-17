---
name: milestone
description: Work through one milestone from docs/roadmap.md, from plan to pull request.
disable-model-invocation: true
argument-hint: "<milestone id, e.g. M1>"
---

Work on milestone $ARGUMENTS from `docs/roadmap.md`.

1. **Read** the milestone's section in `docs/roadmap.md`, every D-number and data-model section it mentions, the screens it lists, and every item in `docs/open-items.md` that names this milestone. Check that earlier milestones are marked done; if not, stop and tell the owner.
2. **Plan** in plan mode: the files to create or change, the tests that prove each acceptance item, and the order. List open questions for the owner and wait for answers before building anything they affect. Split into several pull requests if the milestone is large.
3. **Branch** from an up-to-date `main`: `git switch -c <milestone-id>-<short-name>` (lowercase, e.g. `m3-shot-form`).
4. **Build in small steps.** Tests first for domain and database logic; `/build-screen` for every screen. Commit after each working step with a message that names the D-numbers.
5. **Verify.** Run `npm run check && npm run lint && npm test` and, if screens changed, `npm run test:e2e`. Fix every failure at its root; never skip or weaken a test.
6. **Review.** Ask the `decision-reviewer` subagent to review the full diff against `main`. Fix the findings that affect correctness or a decision; note the rest in the pull request.
7. **Pull request.** Push the branch and open a pull request with `gh pr create`, filling in `.github/pull_request_template.md`. Wait for CI with `gh pr checks --watch` and fix any failure.
8. **Update the roadmap and open items**: set the milestone to ◐ or ☑ in `docs/roadmap.md`, and add or close items in `docs/open-items.md`, in the same pull request, and report to the owner with the evidence (commands, results, screenshots) and any questions.
