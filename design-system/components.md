# Components

Guidelines for the 12 components. CSS lives in `components.css` (prefix `cn-`); tokens in `tokens.css`.

## ValueCard

Shows one core value (grind, dose, yield, time) with −/+ buttons that each show their step and unit.

- Label in `label` style, value in `value-xl`, unit in ink-muted.
- Buttons: `touch-min` tall, `control` background, step text in `ink-soft` ("0.1 g", "1 s"). The step comes from the gear (D-07): grind 0.1, dose 0.1 g, yield 0.1 g, time 1 s.
- Changed since last shot: value turns `sage` and a delta pill appears top-right ("+2.5"). No "was X" text.
- Tap the value to type an exact number.
- Consumer provides: label, value, unit, step, changed delta.

## RowStepper

A full-width row for standing setup inside a sheet: label, optional switch, −/+ and a value.

- A phase that is on shows its duration as the main value and its pressure as a small tappable amber value underneath ("at 2.0 bar", D-24).
- A phase that is off collapses to one quiet line: switch off, label in ink-muted, "Off".
- Used in More › Setup, machine detail, grinder detail.

## ScoreRow

Whole-number score 1–10 (D-09). Tap to choose, slide to refine (D-10).

- Starts empty: never prefilled or copied (D-11).
- Selected: amber. Previous score for the same recipe: a dashed cherry outline that sets nothing (D-12). New recipe: no marker.
- 48px tall buttons; 10 across a 372px row is the tightest target in the app, which is why sliding is supported.

## Chip

Pill-shaped choice. Off = surface; on = amber (your input). A dashed outline chip adds something new.

- Height 40px with 44px spacing; filter chips may be 44px.
- Counts sit after the name in ink-muted ("Berry 12").

## Segmented

Choose one of 2–4 options (roast level, machine type, dial). Selected value = amber.

- Used as **tabs** (More sheet: Setup / Tasting) the selected item is cream, not amber: switching a view is not an input.

## Switch

44 × 26 switch. On = amber with a dark knob; off = control-strong with a muted knob. Always paired with a visible label in the row.

## PrimaryButton

- **Primary** (amber, 56px, full width): the one action of a task screen — Save shot, Add bean, Save setup. Sits at the bottom with 28px under it.
- **Secondary** (surface): quiet actions like Mark as finished.
- **Add** pill (amber): sits in the header of Library pages (Add bean, Add gear, New routine). The center + in the tab bar is reserved for new shots (D-31).
- **Quiet** (`cn-btn-quiet`, no background, ink-muted, 44px): a destructive or rare action at the end of a form, below its primary button — Delete shot, Delete bean (D-116, D-145). It always opens a confirmation sheet first.
- **Pressed** (D-107): buttons flash amber while pressed and fade back (`cn-tap`); amber buttons press in slightly and brighten instead (`cn-tap-strong`). Choices that change state (score, chips, segments, switches) show their new state instead. The browser's own tap flash is off.

## RecipeTag

- **Recipe tag** (cherry): "Recipe reused Nx" with a filled dot, or "New recipe · <what> changed" with a hollow dot (D-16). Matches against all past shots for the same bean and machine.
- **Delta pill** (sage): the change since the last shot ("+2.5", "−0.1"). Sage means changed, nothing else.

## BottomSheet

Bottom sheet for secondary detail (More, Add your own feature, New step).

- Background surface-sheet, top corners radius-sheet, a handle, then content.
- Behind it the screen is dimmed with scrim; tapping the scrim closes the sheet.
- On the shot form the sheet stops above the Save button, which stays usable (D-21).
- The handle sits in the middle of a 44px strip at the top (`cn-sheet__grip`), so it has room above and below; dragging the strip down closes the sheet (D-108).
- **Confirmation sheet** (D-116, D-145): a short sheet with a question as its title ("Delete this shot?"), one line saying what happens, then the action as a primary button ("Delete shot") and "Keep it" as a secondary button below it.

## TasteSlider

A 0–10 or −10…+10 scale for balance, body, sweetness and aftertaste (D-08, D-23). It starts empty (D-11): a hollow dashed handle in the middle (`cn-slider-handle--empty`, ink-muted) shows where to tap or drag; once set, the handle is solid and the value is named in words next to the title.

## PreviewFrame

Shows the exact element a setting will produce, framed with a dashed line so it reads as a preview, not a control. Label it with where it appears ("Shot form › Grind"). Used in Add your own feature, New step and grinder detail.

## TabBar

Five slots: Home, Journal, the amber + (new shot, the only way to add one, D-31), Library, Insights. Icons are 22px stroke icons above 12px labels. It is `tabbar-h` (100px) tall: 84px of bar and 16px of bottom safe area. On tablet it becomes a left rail.

## InsightCard

One finding per card (D-55, D-56).

1. **Title** states the finding; **sentence** says it in plain words.
2. **Chart**: box plot, mean ± σ, line with ± σ band, bell curve or σ bars. Score data in amber, other measures in cream, secondary marks in chart-secondary, grid in chart-grid. Groups are named on the axis, never by color alone. Bars start at zero.
3. **Basis** in caption style: what it is and how many shots ("Average score · 86 rated shots"). Small samples are called out.
- Every chart gets a tap tooltip with exact numbers in the app.
- A card only appears with enough data; otherwise it says what's missing.

