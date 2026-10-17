---
name: record-decision
description: Record a product or technical decision the owner has agreed to in docs/ux-decision-log.md, in the log's own format.
disable-model-invocation: true
argument-hint: "<the decision in a sentence>"
---

Record this decision: $ARGUMENTS

1. Read `docs/ux-decision-log.md`. Find the highest D-number and use the next one. Choose the section where the decision belongs (technical decisions go in "Technical foundation").
2. Check for conflicts. If the new decision changes an earlier one, do not delete the earlier one: add the new entry, and mark the earlier entry with *(Revised YYYY-MM-DD: see D-nn)* or *(Replaced by D-nn)*. If you are not sure the owner meant to change it, ask first.
3. Write the entry in the log's format:
   - `- **D-nn — Short title.** What was decided, concretely.`
   - `  - *Why:* the reason, in one or two sentences.`
   Plain words, no abbreviations, no code identifiers unless the decision is about them.
4. Update "Last updated" and the open topics list if the decision closes or opens one.
5. If the decision affects `docs/data-model.md`, `docs/roadmap.md` or `CLAUDE.md`, update those in the same commit.
6. Commit on the current branch with the message `docs: record D-nn <short title>`, and show the owner the new entry.
