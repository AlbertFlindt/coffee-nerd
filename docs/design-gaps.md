# Built without a design

States the app has that the references in `docs/screens/` don't draw, kept as built. Add one when
you build a state no design covers (after asking); remove it when a design sync draws it.

- Offline: the line at the top of every page ("Offline: showing what the phone kept…"), "Waiting
  to send" and "Not saved" on shots, the "Not saved" message and "Discard change" in the shot form,
  the Sign out sheet while shots wait, "This page could not open" and "This page is not on the
  phone yet".
- The Settings page (built simple), with the Import everything row: its line says what it does,
  "Importing…", what came in, why a file was refused, or that it only goes into an empty journal.
- The sign-in and "Create your account" pages follow a design agreed from screenshots of the app
  (2026-10-30): the logo above the name and tagline, a show/hide button on password fields, one
  caption under the button. `docs/screens/` doesn't draw them yet.
- Home: the Last shot card without the values not entered, empty states, the Dial-in progress
  graph's captions, grid and short-history states, and the chevron in a point's tooltip: tapping
  the highlighted point again opens that shot, whose Back returns to Home. The graphs behind the Time vs.
  yield, Roast age and Consistency chips (screen 6 draws only the chips), their captions, legend and
  empty states, and the chip row scrolling sideways.
- Confirmations as dialogs in the middle of the screen with the red delete choice; the screens
  still draw bottom sheets.
- The "Shot saved" bar, and the messages when a shot or a score could not be saved.
- Insights: "Score by bean process" where screen 23 says "Score by process" ("process" alone read as puck prep); the Score by roaster card (drawn like Score by origin, below it), the tap tooltip, cards without enough data, no shots yet, gaps in the weekly line.
- Gear: the "Add gear" sheet, archive confirmations, "Not set" values, basket size and grinder
  range fields, problem lines. Add your own feature and Edit My setup beyond the one example drawn.
- Shot detail: the puck prep line under the setup ("Daily routine: WDT 20 s · Distributor · Tamp
  15 kg · Puck screen"); the routine's name moved there from the gear line the screen draws.
- The step-by-step start (built from the existing pages, with "Step 1 of 5").
- Puck prep and Tags: empty states, the step sheet's edit mode, the routine builder's sheets and
  problem lines, the tag sheet with Merge and Remove, and the duplicate-tag card.
- Sheets close with the back gesture (a list inside Setup goes back to Setup first) and with a
  swipe down anywhere on them while their content is at the top; the design only drags the handle.
- The shot form's Notes field under Setup and Tasting (the screens draw notes in the Tasting
  sheet), and the roaster after each bean's name in the bean list.
- The Journal's bean filter: bags with the same name and roaster are one entry, with the roaster
  after the name, and the same recipe brewed from several bags is one entry in the recipe filter.
- The shot form's Setup and Tasting rows, the sheets without tabs, folding flavor notes, the "Use it
  for new shots?" sheet, and the Archived lists of Gear, Puck prep and Tags.
- Where a screen in `docs/screens/` differs from the app in a detail (a "Delete feature" on a used
  feature, a missing step on −/+, "Leave for now" going to the Gear page), the app is right.
