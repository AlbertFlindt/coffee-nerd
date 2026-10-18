---
name: record-decision
description: Record a product or technical decision the owner has explicitly agreed to in docs/ux-decision-log.md, in the log's own format. Use right after the owner answers a question that settles behavior.
argument-hint: "<the decision in a sentence>"
---

Record this decision: $ARGUMENTS

Only record what the owner actually decided. Your own proposals, assumptions or implementation choices are not decisions; if unsure, ask the owner to confirm the wording first.

1. Do not read the whole log (it is long). Find the highest D-number with a search (`grep -o 'D-[0-9]*' docs/ux-decision-log.md | sort -t- -k2 -n | tail -1`) and use the next one. Read the section headings (`grep -n '^##' docs/ux-decision-log.md`) and the entries the decision touches (search for their D-numbers and key words), and choose the section where it belongs (technical decisions go in "Technical foundation"). Several decisions from one answer card can be recorded together in one commit.
2. Check for conflicts. If the new decision changes an earlier one, do not delete the earlier one: add the new entry, and mark the earlier entry with *(Revised YYYY-MM-DD: see D-nn)* or *(Replaced by D-nn)*. If you are not sure the owner meant to change it, ask first.
3. Write the entry in the log's format:
   - `- **D-nn — Short title.** What was decided, concretely.`
   - `  - *Why:* the reason, in one or two sentences.`
   Plain words, no abbreviations, no code identifiers unless the decision is about them.
4. Update "Last updated" and the open topics list if the decision closes or opens one.
5. If the decision affects `docs/data-model.md`, `docs/roadmap.md` or `CLAUDE.md`, update those in the same commit.
6. Commit with the message `docs: record D-nn <short title>`. If you are on a task branch, commit there. If you are on `main`, first `git switch -c docs/d-nn-<short-title>`, then push the branch and open a pull request. Show the owner the new entry.
