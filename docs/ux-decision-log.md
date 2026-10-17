# Coffee Nerd — UX Decision Log

Status: living document. Each decision records **what** was decided and **why**, so later design and code can be checked against it. Technical decisions start at section 13.

Last updated: 2026-10-17

---

## 1. Product principle

> **Data exists to back up the home barista** — from dialing in a single shot to discovering which beans and origins you prefer.

Every screen and feature should be checkable against this principle. If a feature collects data that never pays the user back, question it.

## 2. Context of use

- Primary devices: **phone and tablet**, used at the brew station.
- Conditions: wet or busy hands, scale and machine nearby, often early morning.
- Implications: one-handed use, large touch targets, dark theme first, screen kept awake during brewing flows.
- Delivery: self-hosted Docker web app, planned as an **installable PWA** (home-screen icon, full screen, offline-tolerant).
- Reference setup for design work: **Lelit Bianca** (machine) and **Timemore Sculptor 064S** (grinder, stepless dial with decimal settings). Every design must at least fit this setup's feature set.
- **Reference phone: Google Pixel 8a** — CSS viewport **412 × 915 px** (device pixel ratio 2.625). All phone mockups are drawn at this size.
- **D-36 — Screens fit the device; only lists scroll.** Task screens and dashboards (shot form, More sheet, Home, forms, the top of each overview) always fit the viewport and adapt to the device size — no page scrolling. Long lists (finished beans, gear, journal) scroll inside their own area. **No visible scrollbars anywhere.** Layouts are fluid: flexible regions (e.g. the graph on Home, the list on an overview) grow or shrink to fill the space left.
  - *Why:* at the brew station the whole task must be visible at once; a page that scrolls hides controls and feels like a website, not an app.

## 3. Inspiration: Lifesum (inspire, don't copy)

| Take inspiration | Leave behind |
|---|---|
| Fast "+" logging from anywhere | Crowded home screen |
| At-a-glance daily overview | Illustration-heavy, playful style |
| Simple, color-coded quality signals | Upsell and gamification noise |
| Light goal/profile onboarding | Long setup before any value |

## 4. Scope

- **D-01 — Espresso first.** Other brew methods (pour-over, cold brew, etc.) come later.
  - *Why:* espresso has the tightest feedback loop and the most well-defined parameters; it stress-tests the data model.

## 5. Personas (design archetypes, not user-selected profiles)

Users never pick a persona. Personas are used to check that each screen works for different people. The app adapts to the **machine**, not the user type.

| Persona | Machine examples | Cares about |
|---|---|---|
| Push-button | Super-automatic / bean-to-cup | Consistency, finding "the setting" |
| Dialer | Semi-auto / prosumer | Dialing in each bean precisely |
| Manual purist | Lever / manual | Feel, pressure and preinfusion by hand |

- **D-02 — Machine capability profiles.** Each machine in Gear defines which parameters exist; the shot form shows only relevant fields.
  - *Why:* auto and manual machines expose very different parameters; one fixed form would be wrong for both.

### Core jobs
1. Pull my usual shot — log it in seconds.
2. Dial in a new bean — several shots in a row, changing one thing at a time.
3. Remember what worked — best shot per bean and machine.
4. Notice drift — bean aging, grinder changes.

## 6. Information architecture

- **D-30 — Bottom tab bar: Home · Journal · + · Library · Insights.** On tablet the bar becomes a left side rail. Settings (units, backup, export) sit behind a gear icon on Home, not in a tab.

| Tab | Purpose |
|---|---|
| **Home** | Last shot plus statistics for the current bean (D-32) |
| **Journal** | Every shot, newest first; filter by bean, machine or recipe |
| **+** | New shot (D-31) |
| **Library** | Beans, Gear, Puck prep routines, Tags (D-33) |
| **Insights** | Deep, cross-bean analysis |

- **D-31 — "+" is the only way to add a shot.** The center "+" is always visible and opens the prefilled shot form. No duplicate "brew again" shortcuts elsewhere.
  - *Why:* one obvious entry point; duplicates add clutter without saving taps.
- **D-32 — Home = data for the bean you're brewing.** Top to bottom:
  - **App banner** (D-34) with the settings gear.
  - **Bean scope:** a pill with the last used bean; tap to switch between open beans (several can be open at once). Everything on Home follows this bean.
  - **Last shot:** score, grind, dose in/out, time, ratio, taste, recipe tag.
  - **Quick numbers:** bean freshness (days since roast; grams left only when a bag weight was entered, D-35) and this week (shots, average score, how many rated).
  - **Best recipe for this bean:** top-scoring recipe with its score and reuse count.
  - **Graphs**, one at a time behind chips: Dial-in progress (score per shot, recipe changes marked), Time vs. yield, Score vs. roast age, Recipe consistency. The last chosen graph is remembered. The graph is the flexible region that absorbs differences in screen height (D-36).
  - *Why:* nerds want data right away, but four stacked graphs would clutter a phone screen; chips keep all four one tap away. Home answers "how is this bean going?"; Insights answers "what do I like across beans?".
- **D-33 — Library is the barista's "nerdy basement".** Beans, Gear, Puck prep (steps and routines), Tags. Visited now and then to tinker, not every day. Pickers in the shot form link straight into the relevant Library page. Each Library page has its own "Add" button in the header (e.g. "Add bean", "Add gear"); the center "+" stays reserved for shots (D-31).
- **D-34 — App banner on Home.** The top of Home shows the logo (a coffee bean wearing glasses) to the left of the name **Coffee Nerd**, with the settings gear on the right. Only Home carries the banner; task screens (shot form, sheets, forms) keep their own titles.
  - *Why:* the app should advocate for itself and have a recognizable identity, without costing space on screens used mid-task.
- **D-39 — One word per concept in the UI.** Machines, grinders, baskets and accessories are called **Gear** everywhere (page title, buttons, links), never "Equipment". The same rule applies to every term: once a concept has a name, all screens use it.
  - *Why:* "Equipment" as a title next to an "Add gear" button made users wonder if they were two things; "Gear" also sounds more modern.

- **D-54 — Journal.** Every shot, newest first, grouped by day (Today, Yesterday, then dates). Header "Journal" with "9 shots this week". **Filter chips:** All beans ▾, Unrated · N, Any recipe ▾. Each shot is a row: score block on the left (or a dashed amber **"Rate"** block for unrated shots), bean name and time, core values ("1.6 · 18.0 → 38.5 g · 25.5 s"), then taste and the recipe tag (cherry, D-16). The list is the scrolling region (D-36). Tapping a shot opens it.
  - *Why:* one quick scan answers "what did I pull, how was it, and was it the same recipe?"; the Rate block turns unrated shots into a one-tap job instead of a nag.

- **D-55 — Insights: plain-language insight cards, four topics.** Header "Insights" with the data basis ("From 214 shots · 9 beans"). Topic chips: **What I like** (origins, processes, roasters, flavor families), **Progress** (score and consistency over time), **Dial-in** (how grind, ratio, preinfusion etc. relate to score and sour/bitter), **Comparisons** (routines, grinders, baskets compared fairly — same bean, everything else equal). Each **card** states one finding as a sentence ("You score natural coffees 1.1 points higher than washed ones"), shows a small chart, and names its basis ("Average score · 86 rated shots · 7 beans"). The card list scrolls (D-36).
  - **Honest charts:** bars start at zero (scores on a 0–10 scale); the top item is amber (it is your score data, D-19), the rest muted.
  - **Not enough data:** a card only appears when it has enough shots behind it; otherwise it says what's missing (e.g. "Rate 5 more washed shots to compare").
  - *Why:* nerds want the numbers, but a sentence first makes the point instantly; showing the basis keeps the app honest about small samples.

- **D-56 — Insights speak statistics.** Refines D-55. Cards use real statistical charts, each with a one-sentence finding and its basis:
  - **What I like:** **box plots** of score by process (box = middle 50 %, amber line = median, whiskers = range, n per group); **mean ± 1 σ** dot-and-whisker by origin.
  - **Progress:** **line chart** of weekly average score with a **± 1 σ band**, so you see both "better" (line rises) and "steadier" (band narrows).
  - **Dial-in:** a **bell curve** — histogram of shot time on one recipe with the fitted normal curve, mean line (μ) and the ± 1 σ zone ("2 in 3 shots land between 26.5 and 29.3 s").
  - **Comparisons:** **σ per puck prep routine** (same bean, same recipe) and **σ of score per bean** (reused recipes only; lower = steadier). Small samples are called out in the card's footnote.
  - **Chart colors:** score data in amber (D-19); other measures (time, yield) in cream; reference marks and secondary data in muted brown. Groups are identified by their axis labels, never by color alone. Grids are faint; axes on scores start where honest (bars from zero; box plots and dot plots on the full 1–10 scale or a labelled range).
  - In the app every chart gets a tap/hover tooltip with the exact numbers (dataviz rule); mockups show the static state.
  - *Why:* coffee nerds want to see spread, not just averages — σ and distributions answer "is this a better recipe or just a lucky shot?"
- **D-57 — Shot detail.** Tapping a Journal row opens it. Header: back to Journal, "Shot" with date and time, **Edit** (opens the shot form in edit mode, D-14, with "Save changes"). Then: **bean & setup card** (bean, roast age at the time, gear, puck prep routine, pressure profile, recipe tag); **core values** as four tiles (grind, dose, yield, time) and the ratio; **taste** (score block, balance, body and sweetness as small scales, flavor chips); **"Compared with this recipe"** — this shot against the recipe's history, e.g. "25.5 s vs μ 27.9 s · 1.7σ faster than usual", "Score 7 vs average 7.7 · within normal range"; **notes** (labelled "just for you", D-27).
  - *Why:* a shot only means something next to its recipe's history; the σ comparison tells you instantly whether this shot was an outlier or normal variation.

## 7. Shot form (espresso)

- **D-03 — Prefill from last shot.** *(Revised 2026-10-17: see D-72, D-75, D-76.)* A new shot starts as a copy of the last shot (bean and core values). Changed values are highlighted against the previous shot. Ratio is calculated automatically. When there is no last shot for this bean, the shot starts from **My setup** defaults (D-38). When a recipe is marked **"Brew next"** (D-43), the next shot starts from that recipe instead.
  - *Why:* the most valuable action is "brew again, change one thing."
- **D-72 — A bean's first shot starts with an empty time.** *(Revised 2026-10-17: see D-80, D-91.)* When a shot starts from My setup (D-38), grind, dose and yield come from My setup; the time has no default and stays empty until it is set. Refines D-03.
  - *Why:* My setup holds what you choose before brewing; time is a result, so inventing one would be a guess (same reasoning as D-11).
- **D-80 — Tapping an empty time starts at 0 s.** *(Revised 2026-10-17: see D-82.)* When the time card is empty (D-72), its −/+ buttons count from 0 s: the first + gives 1 s, and − stays at 0 s. Tap-to-type still works for entering the time directly. Refines D-72.
  - *Why:* the buttons keep doing exactly what their label says ("+ 1 s", D-07), without guessing a typical time.
- **D-82 — An empty yield works like an empty time.** *(Revised 2026-10-17: see D-91, D-99.)* When there is no yield to copy (a Brew next recipe without shots, D-43), the yield card starts empty, and its −/+ count from 0 like the time card (D-80). Refines D-43.
  - *Why:* one rule for every empty value; nothing is guessed.
- **D-99 — An empty value shows a dash.** An empty time or yield card (D-72, D-82) shows a muted "—" in place of the number, with its unit ("— s"), until a value is set. Refines D-72 and D-82.
  - *Why:* a dash says "not set" without inventing a number, and the unit keeps the card readable.
- **D-74 — A re-buy from a bag without rated shots starts from its latest shot.** When the nearest earlier bag with shots (D-73) has no rated shot, and so no best recipe (D-66), the new bag starts from that bag's latest shot: its recipe, yield and time. Refines D-73.
  - *Why:* keeps "the nearest bag with shots" true even when nothing was scored.
- **D-75 — Archived gear or routines are swapped for My setup's.** When the shot a new shot starts from used a machine, grinder, basket or puck prep routine that has since been archived, only that item is replaced by My setup's default (D-38); everything else is copied as usual, and the recipe tag names what changed. Refines D-03.
  - *Why:* archived items can no longer be picked, so the form should not start with one.
- **D-76 — A copied routine starts as the routine is now.** When the routine was edited since the copied shot, the new shot uses its current steps and names, with values from the copied shot where a step is still in the routine and the routine's own value for new steps. Refines D-03 and D-51.
  - *Why:* matches how machine features are brought up to date, and editing a routine only affects future shots (D-65).
- **D-78 — A feature without an off switch waits for a value.** When temperature or flat pressure (which cannot be switched off) has no value from the copied shot or My setup, it starts switched on with an empty value for you to set. Refines D-38.
  - *Why:* switching it off is impossible and inventing a value would be a guess (same reasoning as D-11).
- **D-04 — Core fields: grind, dose, yield, time.** Bean is prefilled. Everything else lives behind a **More** button.
  - *Why:* these four are what a home barista adjusts shot to shot.
- **D-05 — Standing setup vs. shot variables.** *(Revised 2026-10-17: see D-100.)* Temperature, basket, pressure profile, puck prep etc. are *standing setup*: set on the machine before brewing, carried over automatically, shown as a compact summary line, editable under More. Changes are highlighted like any other.
  - *Why:* the "+" is pressed during or just after a shot — setup is already decided by then. Still stored on every shot for later insights.
- **D-100 — What the setup summary line shows.** The summary line on the shot form's bean card lists each switched-on phase and custom feature with its value, then the temperature (e.g. "Preinfusion 4 s · Low bar start 5 s · 93 °C"). Basket and flat pressure are left out; they are on the Setup tab. Refines D-05.
  - *Why:* the phases are what you switch most between shots; the line stays short enough for the card.
- **D-06 — Time is logged after the shot.** Entered from the scale or machine display. Prefilled from last shot, ±1 s steppers, tap to type, tenths allowed. **No in-app shot timer.**
  - *Why:* precision. Starting a phone timer while pulling a shot introduces seconds of error — not acceptable for data-driven users.
- **D-07 — Controls favor steppers/sliders over the keyboard** *(Revised 2026-10-17: see D-89.)*, with tap-to-type for exact values. Step sizes follow the gear (e.g. grind in 0.1 steps for a stepless grinder with a decimal dial).
  - Current steps (reference setup): grind 0.1, dose 0.1 g, **yield 0.1 g** (matches a 0.1 g scale), time 1 s, temperature 1 °C.
  - **Every −/+ button shows its step with unit** (e.g. "− 0.1 g", "+ 0.1 g", "− 1 s", "+ 0.1" for grind). Used on the shot form cards, Edit My setup and the grinder preview.
    - *Why:* you see exactly what one tap does, and it doubles as a quiet unit label on every card.
- **D-89 — Dose, yield and time steps are your settings.** The −/+ steps for dose, yield and time are stored per user and default to 0.1 g, 0.1 g and 1 s (D-07); the shot form and Edit My setup both use them (Edit My setup's 0.5 g yield step in the design is replaced). They are changed in Settings once it exists (roadmap M11). The grind step stays on the grinder (D-48). Refines D-07.
  - *Why:* scales and habits differ between home baristas; the defaults match a 0.1 g scale and the reference setup.
- **D-14 — Shot form layout.** *(Revised 2026-10-17: see D-94, D-95.)* Full-screen page opened from "+". Top to bottom: bean card (bean, machine, grinder, standing-setup summary, recipe tag) → 2×2 grid of core values (grind, dose, yield, time), each a card with large value and −/+ steppers → calculated ratio → balance slider → score row → More → full-width Save.
  - *Why:* the grid keeps all four core values visible at once with large touch targets; one primary action at the bottom suits one-handed use. A row-based "instrument" layout was tried and felt cluttered.
- **D-15 — Changes vs. last shot shown as a delta.** A changed value is colored (see D-19) with a small delta pill (e.g. "+2.5"). No "was X" text.
  - *Why:* the delta is the information the barista acts on; extra text added clutter.
- **D-16 — Recipe tag on the bean card.** *(Revised 2026-10-17: see D-71, D-77, D-81.)* Shows **"Recipe reused Nx"** when this exact recipe has been brewed before, or **"New recipe · <what> changed"** (e.g. "grind changed") when it has not. Replaces an "attempt N" counter.
  - Matching is against **all past shots for the same bean and machine**, not only the previous shot. Returning to an earlier setting is recognized as that recipe, with its count and its last score (D-12).
  - *Why:* dialing in often goes back and forth; matching all history keeps the counter, score reference and bean-aging signal reliable. Naming the cause makes the tag understandable — a bare "New recipe" left users unsure why it appeared.
- **D-71 — Recipe tag names up to two changes.** *(Revised 2026-10-17: see D-77.)* When a new recipe differs from the last shot's recipe in more than one thing, the tag names the first two and counts the rest: "New recipe · grind changed", "New recipe · grind and dose changed", "New recipe · grind, dose and 1 more changed". Refines D-16.
  - *Why:* says exactly what changed in the common one- or two-change case, and still fits on the bean card when more changed.
- **D-77 — Order of changes in the recipe tag, and a plain "New recipe".** *(Revised 2026-10-17: see D-81.)* Changes are named in this order: grind, dose, machine, grinder, basket, routine, then machine features, so D-71's first two follow it (e.g. "grind and grinder changed"). When nothing can be named (a bean's first shot), the tag says just "New recipe". Refines D-16 and D-71.
  - *Why:* the values you change most come first; a bare "New recipe" is honest when there is nothing earlier to compare with.
- **D-81 — The recipe tag compares with this bean's last shot.** What changed is named against the last shot of the same bean: the shot the form copies from (D-03) and the deltas compare with (D-15). A bean's first shot has nothing to compare with, so its tag says just "New recipe" (D-77). Refines D-16.
  - *Why:* the tag, the deltas and the prefill all talk about the same shot, so they never disagree.
- **D-17 — Bean age lives on the bean overview and Home, not the shot form.**
  - *Why:* bean age matters when choosing a bean; on the shot form it is clutter, since the bean is usually unchanged from the last shot.
- **D-20 — Plain words, no abbreviations.** UI text spells things out (e.g. "Preinfusion 4 s", not "PI 4 s"); units are written in full or as standard symbols (°C, g, s, bar).
  - *Why:* abbreviations that feel obvious to the designer were unclear in review.

- **D-94 — The bean card switches the bean.** Tapping the bean card on the shot form opens a list of open beans. Picking one starts the form again from that bean's starting values (D-03, D-43, D-73, D-38). Choosing another machine or grinder on the shot form waits for the Gear pages (roadmap M6). Refines D-14.
  - *Why:* switching between open beans is the change you make at the brew station; gear changes are rare and belong with the Gear pages.
- **D-95 — After saving, the app goes back with a message.** "Save shot" returns to the page where "+" was pressed, with a short "Shot saved" message. When the shot used up the bag and the bean was finished automatically (D-40), the message says so, with an Undo that reopens the bean. Refines D-14 and D-40.
  - *Why:* you see that the shot is safe without an extra screen, and the automatic finish can be undone right where it is announced.

### More (bottom sheet)

- **D-21 — More opens as a bottom sheet with two tabs: Setup and Tasting.** The sheet covers the form but **stops above the Save button**, which stays visible and active. Tapping outside the sheet (the dimmed form) closes it.
  - *Why:* the user can save from anywhere without closing the sheet first; tap-outside-to-close is the expected sheet behavior on phones.
- **D-22 — Setup tab (Dialer profile):** *(Revised 2026-10-17: see D-90.)* temperature, pressure profile (D-24), basket (brand/model and size, opens a picker), puck prep (D-25).
  - All setup fields are part of the **recipe** (D-13): changing one makes a new recipe and is highlighted like any other change.
- **D-90 — A changed setup value looks like a changed core value.** On the Setup tab, a value that differs from the last shot turns sage with a small sage delta pill, as on the core value cards (D-15); a feature switched on or off since the last shot shows a sage "On" or "Off" pill. Refines D-22.
  - *Why:* one way to show "changed since last shot" everywhere (D-19), so the sheet reads like the form.
- **D-24 — Pressure profile = a base pressure plus phases you switch on or off.** The base is "Flat" (main extraction pressure, in bar). Phases offered by the machine (for the Lelit Bianca: preinfusion, low bar start, low bar end) each have an on/off switch and can be combined freely. A phase that is off collapses to one quiet line. A phase that is on shows its **duration in seconds as the main value** (with −/+) and its **pressure in bar as a small tappable value** underneath (e.g. "at 2.0 bar").
  - Which phases exist, and whether they have a pressure, comes from the machine's capability profile (D-02).
  - *Why:* matches how the Bianca is actually used (flat, plus any combination of preinfusion, low bar start and low bar end) and replaces a pick-one profile list. Seconds are what you set most; bar is still recorded without a second full control.
- **D-25 — Puck prep points to a saved routine.** The Setup tab shows the chosen routine's name and its steps in order (e.g. "Daily routine: WDT → Distributor → Tamp → Puck screen"); tapping opens a picker of routines. Routines are built in Library (D-26).
  - *Why:* puck prep varies a lot between baristas; referencing a routine keeps the shot form short while still recording exactly what was done.
- **D-23 — Tasting tab:** *(Revised 2026-10-17: see D-96, D-97, D-101.)* body (light ↔ heavy), sweetness (low ↔ high), aftertaste (short ↔ long) as sliders with the same gesture as balance; flavor notes as chips from a short coffee flavor list plus "Add your own" (custom notes become chips); free-text notes.
  - Tasting follows D-11: everything starts empty, never copied from the last shot.
  - *Why:* sliders match the balance control; chips give structured data that Insights can use later.
- **D-27 — Free-text notes are labelled as personal.** The notes field carries the hint "Just for you · not used in Insights".
  - *Why:* free text cannot be used for statistics; saying so sets the right expectation and nudges users toward flavor chips for anything they want analyzed.
- **D-97 — Flavor chips: all of them, most used first.** The Tasting tab shows every flavor note as a chip, the ones you use most first, then alphabetical. The chip area scrolls on its own when the notes do not fit (D-36). Refines D-23.
  - *Why:* every note stays one tap away, and the ones you actually taste are on top.
- **D-101 — A note added on the Tasting tab joins "Other".** "Add your own" takes a name typed in place; the new note belongs to the family Other (D-53) and is created only when the shot is saved. Its family can be changed on the Tags page. Refines D-23.
  - *Why:* choosing a family mid-shot is a detour; a shot you leave unsaved should leave no stray notes behind.

## 8. Taste and rating

- **D-08 — Default taste input: balance slider + overall score.** A **sour ↔ balanced ↔ bitter** slider, followed by an overall score. Full tasting (body, sweetness, aftertaste, flavor notes) under More (D-23).
  - *Why:* balance is espresso's shared language and enables dial-in hints (e.g. "sour and fast → grind finer").
- **D-09 — Score: 1–10, whole numbers only.**
  - *Why:* 1–5 is too coarse to show improvement; 0–100 is false precision at home. Hard to change once data exists.
- **D-10 — Score control: tap or slide.** *(Revised 2026-10-17: see D-98.)* A row of numbers 1–10. Tap to choose; slide to refine (e.g. tap 7, then slide to 6 after tasting further). Sliding snaps to whole numbers. Consistent gesture feel with the balance slider.
- **D-11 — No prefill for taste.** *(Revised 2026-10-17: see D-91.)* Balance, score and all full-tasting fields start empty. A shot without a score is saved as **"not rated"** — never with a guessed or copied value.
  - *Why:* protects data quality; copied scores would pollute statistics.
- **D-91 — A shot can be saved with an empty time or yield.** Like an unrated score (D-11), an empty time or yield is saved as not set and left out of Insights; nothing blocks saving at the machine. Refines D-72 and D-82.
  - *Why:* a missing timer reading should never cost the rest of the shot's data.
- **D-12 — Faint reference to the previous score.** The score from the last shot with the **same recipe** is shown as a faint marker. It sets nothing. For a new recipe there is no marker, only "No earlier score".
  - *Why:* reveals bean aging (same recipe, falling scores) and keeps the home barista consistent.
- **D-96 — Taste values are shown as words.** A set taste slider shows a word next to its title, in five bands. Balance: Very sour (−10 to −7), Sour (−6 to −4), Slightly sour (−3 to −1), Balanced (0), Slightly bitter (1 to 3), Bitter (4 to 6), Very bitter (7 to 10). Body, sweetness and aftertaste (0 to 10): 0–2, 3–4, 5, 6–7, 8–10 read as Light, Medium-light, Medium, Medium-heavy, Heavy; Low, Medium-low, Medium, Medium-high, High; Short, Medium-short, Medium, Medium-long, Long. An empty slider says "Not set". Refines D-08, D-23 and D-67.
  - *Why:* a word is how you describe a taste; the stored whole numbers (D-67) stay exact for Insights.
- **D-98 — A score or taste value can be cleared.** Tapping the selected score again clears it, so the shot stays "not rated" (D-11). A taste slider that is set shows "Clear" next to its value. Refines D-10 and D-11.
  - *Why:* a mistaken tap must not force a score onto the shot; clearing keeps the data honest.

## 9. Data model concept: Recipe vs. Result

- **D-13 — Recipe = intent; Result = outcome.**

| | Contains |
|---|---|
| **Recipe** (what you set) | Bean, machine, standing setup (incl. pressure profile and puck prep routine), grinder, grind setting, dose |
| **Result** (what you get) | Yield, time, ratio, taste |

- Shots with the same recipe are **attempts at the same shot**, even when yield and time differ.
- Changing any recipe element (e.g. turning off preinfusion) is a **new idea/experiment**, with no score reference.
- *Why:* two consecutive shots naturally vary in outcome; comparison is only meaningful for identical intent.
- Enables: consistency insights (variance of results within one recipe ≈ puck-prep repeatability), clearer experiments, bean-aging detection.

## 10. Library (Beans, Gear, Puck prep, Tags)

- **D-50 — Library landing page.** What the Library tab opens to. Title "Library" with the subtitle "The nerdy basement", then **four full-width rows** — **Beans, Gear, Puck prep, Tags** — each with a cream icon tile on the left, its name and two short live summaries, and a chevron on the right (e.g. "2 open · 6 finished" / "Freshest: 4 days"; "4 items" / "Bianca · Timemore 064S"; "2 routines · 6 steps" / "In use: Daily routine"; "18 flavor notes" / "Most used: Berry"). No add buttons here; each section page has its own (D-33).
  - *Why:* four equal doors into the basement, each telling you something useful before you tap; the summaries make the landing page worth a glance rather than just a menu. Rows (instead of a 2×2 grid) give the summaries room to read in one line and match the list pattern used elsewhere in Library.
- **D-37 — Bean overview: open beans as cards, finished beans as rows.**
  - **Open** beans (several can be open at once) get a card with a large **roast age** block ("12 days since roast") on the left, then name, roaster · origin · process, and **best score · recipes · shots**. A bean with no rated shots says "Not rated yet".
  - **Finished** beans collapse into compact rows below (name, roaster · origin · process, best score, recipes · shots); this list is the part that scrolls (D-36).
  - "Add bean" sits in the header.
  - *Why:* open beans are what you choose between, so they get the space and the freshness signal; finished beans are history you look up now and then.
- **D-41 — Add bean form.** *(Revised 2026-10-17: see D-73.)* Full-screen form opened from "Add bean"; fits the screen without scrolling (D-36). Top to bottom:
  - **"Same as before"** shortcut: pick a past bean to re-buy it. Everything is copied except roast date and bag weight. The new bag is linked to the earlier one, so its history and best recipe carry over (as a starting point, not merged scores).
  - **Name** (required).
  - **Roaster** (full width).
  - **Country** (picker from a fixed country list, searchable) and **Region** (optional free text) side by side.
  - **Process** as chips: Washed, Natural, Honey, Anaerobic, Other.
  - **Variety** and **Altitude** side by side (optional, with example placeholders).
  - **Roast level** as a 4-step segmented control: Light, Med-light, Medium, Dark.
  - **Roast date** (required, date picker showing "2 days ago") and **Bag weight** (optional, D-35) side by side.
  - Full-width **"Add bean"** button at the bottom.
  - Only the two required fields are marked ("Required"); everything else is optional without saying so, which keeps the form quiet.
  - *Why:* roast date powers freshness and bean-aging data, so it is worth requiring; the rest is nice-to-have. Re-buying the same bean is common, and the shortcut turns a 10-field form into one tap plus a date. Country is a picker, not free text, so Insights can reliably compare origins (free text would split "Ethiopia", "ethiopia" and "Ethiopa"); region stays free text because region names are too varied for a fixed list.
- **D-73 — A re-buy starts from the nearest earlier bag with shots.** *(Revised 2026-10-17: see D-74.)* The first shot of a bag added with "Same as before" follows the chain of earlier bags back to the nearest one that has shots, and starts from that bag's best recipe (D-66), with yield and time from that recipe's latest shot, as a new recipe for this bag. If no earlier bag has shots, it starts from My setup (D-38). Refines D-41.
  - *Why:* a bag that was re-bought but never brewed should not hide the dial-in work of the bags before it.
- **D-42 — Bean detail page.** Opens by tapping a bean on the Beans overview (open or finished). It is everything about one bag; nothing on it is needed while brewing. Top to bottom:
  - Header: back to Beans, bean name, **Edit** (opens the Add bean form, filled in).
  - **About card:** roast age block (cream, as on the overview), roaster, country · region · process, variety · altitude · roast level, roast date and status (Open/Finished).
  - **Numbers:** best score, recipes, shots.
  - **Recipes for this bean**, best score first: core recipe (grind, dose → yield), the setup that differs (e.g. preinfusion, low bar start), average time, reuse count in cherry ("Reused 4x"; "Tried once" with a hollow dot), and the recipe's best score. This list scrolls (D-36). Tapping a recipe opens its shots (to be designed).
  - Each recipe has a round **"Brew next"** button (cup icon) on the right (D-43).
  - **"Mark as finished"** at the bottom as a quiet secondary button (becomes "Reopen" on a finished bean, D-40).
  - *Why:* answers "what have I learned about this bag?" — the recipe list is the bean's dial-in history in one view. Graphs stay on Home and in Insights to keep this page calm.
- **D-43 — "Brew next": start the next shot from a chosen recipe.** *(Revised 2026-10-17: see D-82.)* On the bean detail page, tapping a recipe's "Brew next" button marks it (amber button, amber outline on the row, "Next shot starts here"). The next "+" then opens the shot form prefilled with that recipe (its recipe values and setup; yield and time from its last shot), and the recipe tag shows its reuse count as usual. Only one recipe can be marked at a time; tapping again clears it. After that shot is saved the mark clears and D-03 (copy last shot) applies again.
  - "+" stays the only way to add a shot (D-31); "Brew next" only decides what it starts from.
  - The shot form says so: the bean card's bottom row shows **"Recipe chosen from Library"** (amber, cup icon) under the recipe tag, with a **"Use last shot recipe"** button that switches back to D-03 and clears the mark.
    - *Why:* a mark set yesterday and forgotten would otherwise make "+" start from an unexpected recipe.
  - *Why:* going back to your best recipe after experimenting should be one tap, not re-entering values by hand.
- **D-35 — Bag weight is optional.** A bean can have a bag weight, but it is never required. When it is set, the app subtracts each shot's dose and shows grams left (on Home and the bean overview); when it is not, grams are simply not shown.
  - *Why:* some baristas track stock, many don't; an optional field serves both without nagging.
- **D-40 — Finishing a bean.** *(Revised 2026-10-17: see D-92.)* A bean moves from Open to Finished with **"Mark as finished"**, always available on the bean. When a bag weight is set (D-35) and grams left reach zero, the app **finishes the bean automatically** and says so, with an undo. A finished bean can always be reopened.
  - *Why:* manual works for everyone; automatic saves a step for those who track weight, but weights drift (spills, sharing), so the manual option and undo must always be there.
- **D-92 — Only a new shot finishes a bean automatically.** Editing a past shot (D-57) updates grams left but never finishes or reopens a bean; that stays a manual action. Refines D-40.
  - *Why:* an edit corrects history; finishing or reopening a bean by surprise during a correction would be confusing.
- **D-38 — Gear page: "My setup" card on top, gear list below.** *(Revised 2026-10-17: see D-78, D-83.)*
  - **My setup** (a light cream card so it stands out): default machine, grinder, basket and puck prep routine, plus **default values** (dose, yield, grind, temperature, pressure profile). One "Edit" button.
  - Defaults are the **starting point for a bean's first shot** (and when switching gear). After that, D-03 applies: new shots copy the last shot.
  - **Gear list** grouped by type (Machines, Grinders, Baskets, later Other). Each row shows a short capability summary (e.g. "Semi-auto · Preinfusion, low bar start, low bar end"; "Stepless · steps of 0.1"); the default item carries a "Default" chip. Tapping a row opens the item, where its capability profile (D-02) and step sizes (D-07) are set.
  - "Add gear" sits in the header.
  - *Why:* one place answers "what do I brew with and what do new shots start from"; per-item details stay one tap away for tinkering.
- **D-44 — Gear detail (machine): capabilities are set by hand.** *(Revised 2026-10-17: see D-79.)* Opens from a row on the Gear page. Name, **type** (Automatic, Semi-auto, Lever, Manual) and a **"What it can do"** list of switches — for the Lelit Bianca: Temperature (°C, steps of 1), Flat pressure (bar, steps of 0.5), Preinfusion (s), Low bar start (s at bar), Low bar end (s at bar) — plus **"Add your own feature"** for anything unusual, and group size. Switched-on features are exactly what the shot form shows (D-02). Full-width Save.
  - No built-in model catalog: the user sets everything. Type only labels the machine; it does not switch features on or off.
  - Grinders get the same pattern (dial type: stepped/stepless, step size, range) — to be drawn.
  - *Why:* a hand-set profile works for any machine, including modified or rare ones, and keeps the app free of a catalog to maintain.
- **D-48 — Gear detail (grinder).** *(Revised 2026-10-17: see D-79.)* Same pattern as the machine page (D-44), set by hand. Name; **type** (Electric / Hand) and **burrs** (Flat / Conical) side by side; **burr size** (mm). Then **"How the dial works"**, which drives the grind control on the shot form:
  - **Dial:** Stepped (clicks or numbers) or Stepless (any point on the dial).
  - **Step per tap:** how much − or + moves the grind (0.1 for the Timemore 064S).
  - **Finest** and **Coarsest** dial values (0.0 and 16.0 for the 064S).
  - A **Preview** of the shot form's Grind card, framed like the custom-feature preview (D-46), with the step on its buttons ("− 0.1", "+ 0.1") and the range beside it.
  - *Why:* the dial is the one grinder detail that changes how you log every shot; burr info is nerd context for Insights (e.g. comparing grinders) at no cost on the shot form.
- **D-49 — Gear detail (basket).** *(Revised 2026-10-17: see D-79.)* Same pattern as machine and grinder. Name; **type** (Precision, Standard, Pressurized); **shot size** (Single, Double, Triple); **diameter** (mm) with a fit check against your machines ("Fits Lelit Bianca"); optional **dose range** (from–to, e.g. 17.0–19.0 g). When a dose on the shot form falls outside the range, the form shows a gentle hint — never a block.
  - *Why:* basket choice changes extraction and is part of the recipe (D-13); the dose range turns the basket's spec into a useful nudge without extra input per shot.
- **D-79 — Gear sizes can have decimals.** Group size, burr size and basket diameter accept decimals (e.g. 58.5 mm), stored like every other decimal number. Refines D-44, D-48 and D-49.
  - *Why:* real gear comes in sizes such as 58.5 mm and 63.5 mm; rounding them would make the fit check and grinder comparisons wrong.
- **D-83 — Gear and routines that My setup uses cannot be archived.** Archiving is not offered for the default machine, grinder, basket or puck prep routine; the item says "Used in My setup · choose another default first". Refines D-38.
  - *Why:* a new shot can always fall back to My setup (D-75), so My setup must only point to items you can pick.
- **D-46 — "Add your own feature".** From the machine detail page (D-44), a bottom sheet lets the user define any capability of that machine the app doesn't know (e.g. a bloom pause, a paddle position). Fields:
  - **Name.**
  - **Kind of value:** Number with unit, Seconds, On / off, Pick from a list. The fields below adapt (unit for numbers, options for lists).
  - **Step** and optional **Range**.
  - **Preview**: the exact row as it will appear on the shot form under **More › Setup** (switch, name, −/+ value), framed and labelled so it reads as a preview, then **Add feature**.
  - A machine feature is always something you **set before the shot**, so it is part of the **recipe** (D-13): changing it starts a new recipe and is highlighted like any other change (D-15). Stored on every shot and available to Insights.
  - *Why:* lets any machine fit without the app knowing about it in advance, while keeping the recipe-vs-result model intact.
- **D-47 — Measuring gear is out of scope for now.** Scales, refractometers and similar tools are **gear of their own**, not features of a machine (a Bianca has no scale). How they fit — what they measure (yield, time, TDS), and whether those become result fields — is parked as an open topic. Until then, custom features are machine features only.
- **D-45 — Edit My setup: full-screen form.** Opens from "Edit" on the My setup card. Same pattern as Add bean (D-41): close (X), title with "Starting point for new beans", one Save at the bottom, fits the screen (D-36).
  - **Gear:** four pickers in a 2×2 grid — machine, grinder, basket, puck prep routine.
  - **Default values:** dose, yield, grind, temperature as −/+ cards (same controls as the shot form), with the calculated ratio below.
  - **Pressure profile:** one summary row that opens the same phase editor as the More sheet (D-24).
  - Which default fields appear follows the chosen machine's switched-on features (D-44) and the grinder's step size (D-07).
  - *Why:* one familiar form for "what new beans start from"; reusing the shot form's controls means nothing new to learn.
- **D-26 — Puck prep routines as flowcharts.** A Puck prep overview where the user creates **steps** (individual prep methods, e.g. WDT, distributor, tamp, puck screen, RDT, or anything custom) and links them into one or more **routines** shown as flowcharts. The shot form references a routine (D-25).
  - *Why:* covers any prep style, however unusual, without a fixed list; coffee nerds will enjoy building and seeing the flow.
- **D-51 — Puck prep: overview and routine builder.** *(Revised 2026-10-17: see D-76.)* Refines D-26.
  - **Routines are a straight line**, top to bottom — no branches. Reorder by dragging, insert between any two steps.
  - **Steps can carry optional settings** (e.g. WDT 20 s, Tamp 15 kg, RDT 2 sprays). The values are recorded with each shot, so Insights can compare them.
  - **Overview** (Library › Puck prep): "New routine" in the header. **Routines** as cards: name, "In use" chip on the routine My setup / the last shot uses, the steps as a mini flow (WDT → Distributor → Tamp → Puck screen), and "23 shots · average score 7.4" — so routines can be compared at a glance. Below, **Your steps**: the step library as chips with their setting unit ("WDT · seconds"), plus a dashed "New step".
  - **Routine builder** (full-screen, Save at the bottom): name, then a vertical flowchart between two caps, **"Dose in basket"** and **"Lock in and brew"**. Each step is a row with a drag handle, its name, its setting as a tappable amber value (or "No settings"), and remove. Between steps, a line with a small **+** to insert a step there.
  - Changing the routine on a shot, or a step's setting, is a **recipe change** (D-13).
  - *Why:* a straight line matches how puck prep is actually done and fits a phone; the start/end caps make it read as a flow, not a list; per-step settings and per-routine averages turn prep into something you can learn from.
- **D-52 — New step.** "New step" on the Puck prep overview opens a bottom sheet (same pattern as "Add your own feature", D-46): **Name**; **Setting** — No setting, Number with unit, Seconds, Pick from a list; then the fields that kind needs — **Unit** and **Step**, **Starts at** (the value it gets when added to a routine) and optional **Range**; a framed **Preview** of the step's row in the routine builder; **Add step**.
  - Routine cards keep a simple **average score across all shots** for now; fair comparisons (same bean, same recipe otherwise) belong in Insights.
  - *Why:* one consistent way to define anything custom — machine features and prep steps look and work alike.
- **D-29 — Tags (flavor notes) get a home.** A place to see, rename, merge and remove flavor tags, including custom ones added from the Tasting tab.
  - *Why:* custom tags will drift (typos, duplicates); a home keeps them clean enough for Insights.
- **D-53 — Tags page.** Library › Tags. "Add tag" in the header, a search field, then tags as chips **grouped by flavor family** (Fruity, Sweet, Floral, Nutty & roasty, Other), each with its **usage count** ("Berry 12"); user-added tags carry a small "custom" label. **Families are fixed** (a built-in set plus "Other"); users choose a family for custom tags but cannot create or rename families. Tapping a tag opens rename / merge / remove.
  - **Duplicate finder:** when two tags look alike (e.g. "Dark choclate" and "Dark chocolate"), a cream card at the top suggests merging them, with a one-tap **Merge** into the more-used tag. Merging updates every shot that used the old tag.
  - *Why:* families make 18+ tags scannable and mirror how tasters think; counts show what you actually taste; the duplicate finder keeps Insights clean without asking the user to audit their tags. Fixed families let Insights say things like "you prefer fruity coffees" reliably.

## 11. Visual direction

- **D-18 — Coffee-toned, surface-based dark UI.** Dark roast background with slightly lighter mocha cards; separation comes from surfaces, not borders or dividers. Soft rounded corners, generous spacing, a friendly geometric sans (Figtree) with tabular numbers. One full-width primary action per task screen.
  - Light cream cards are used sparingly for the one thing that should stand out on a page (e.g. roast age on bean cards, My setup on Gear).
  - *Why:* calm and uncluttered at the brew station; warm tones fit the subject. Earlier directions (warm-amber default and a cool "instrument" style) read as generic or cluttered.
- **D-19 — Accent colors have one job each.**

| Color | Role | Used for |
|---|---|---|
| Crema amber | Your input and actions | Save, "+", Add buttons, selected score, slider handles, selected chips, switches, tappable secondary values, score line in graphs |
| Sage leaf | Changed since last shot | Changed values and delta pills |
| Coffee cherry | Recipe history | Recipe tag (filled dot = reused, hollow dot = new), previous-score marker, recipe-change markers in graphs, "Same as before" icon |

  - The logo and app name (D-34) use the coffee-brown and cream tones, not the accents, so the accent roles stay intact.
  - *Why:* strict roles let colors explain themselves across screens (e.g. cherry always means "this recipe's past" in Insights). Color is never the only signal: deltas and markers carry text or shape too.

## 12. Design system

- **D-58 — The design system is the source of truth for visuals.** A "Coffee Nerd" Design System artifact holds the tokens (colors with their jobs, Figtree type styles, spacing, radii, sizes), component guidelines with live previews (ValueCard, RowStepper, ScoreRow, Chip, Segmented, Switch, PrimaryButton, RecipeTag, BottomSheet, PreviewFrame, TabBar, InsightCard), plain CSS with the `cn-` prefix, and the logo. The UX canvas shows screens; the design system defines the parts. When they disagree, update the design system first.

## 13. Technical foundation

- **D-59 — Stack: SvelteKit + SQLite in one container.** SvelteKit (Svelte 5, TypeScript in strict mode) serves both UI and API from one Node process. Data lives in SQLite through the Drizzle ORM with versioned migrations. One Docker image with one data volume (database file and backups). Charts are hand-built SVG components using d3's scales and shapes and styled by the design system; no chart library. Screens use the design system's plain CSS (`cn-` classes).
  - Alternatives considered: React SPA + Hono API (same database, more wiring), FastAPI + JS frontend (two languages, types duplicated), PocketBase (less control over recipe matching and statistics).
  - *Why:* the smallest professional setup that covers every decision so far. One language end to end gives shared types from database to UI. A single-file database makes backup and export (D-30) a file copy and fits a self-hosted app's data size.
- **D-60 — One user now, household-ready.** *(Revised 2026-10-17: see D-84 to D-88.)* Each installation has one account behind a simple login that protects the instance. The data model is ready for more users from the start: everything a person creates belongs to a user.
  - For households, two options stay open: each user builds their own Library from scratch, or Library items (beans, gear, puck prep, tags) get a **household share toggle**. The data model supports both: every Library item has an owner and a share flag that is off by default and has no UI yet. Shots, recipes, scores and My setup are always personal.
  - *Why:* adding ownership later means migrating every table and query; adding it now costs one column.
- **D-84 — Simple sign-in screens until they are designed.** The sign-in page and the one-time "Create your account" page are built from design-system parts only (fields, one full-width primary button, the logo), and get a proper design later. Refines D-60.
  - *Why:* the login protects the instance from the first milestone on; a plain version is enough until it is designed.
- **D-85 — Sign in with name and password.** *(Revised 2026-10-17: see D-93.)* The one account is created with a name and a password; no email, since a self-hosted app sends no mail. Refines D-60.
  - *Why:* nothing would ever be sent to an email address, so asking for one adds a field without a purpose.
- **D-93 — Sign-in rules.** A password has at least 8 characters. The name is matched ignoring upper and lower case and surrounding spaces. After 5 wrong passwords within 15 minutes, sign-in waits a minute ("Too many tries. Wait a minute and try again."). Refines D-85.
  - *Why:* a common minimum that still allows a memorable phrase; the wait slows down guessing without locking you out.
- **D-86 — Stay signed in until you sign out.** Each visit renews the session; it ends only after a year without use, or when you sign out. Refines D-60.
  - *Why:* the app lives on a phone at the brew station; signing in again with wet hands is friction with no benefit on a private server.
- **D-87 — A lost password is reset on the server.** A command run on the server sets a new password and signs out every device. There is no reset by email or from the sign-in page.
  - *Why:* no mail is sent (D-85), and a server command leaves nothing to attack from outside.
- **D-88 — A new installation starts with the built-in flavor tags only.** Creating the account adds the built-in tags; gear, puck prep, My setup and beans are added in Library. The reference setup (Lelit Bianca, Timemore 064S, VST 18 g, Daily routine) is a seed for development, tests and screenshots, not part of a real installation.
  - *Why:* every home barista's gear is different; example gear would have to be removed before use.
- **D-61 — Offline: the app opens offline, and shots wait to sync.** A service worker caches the app and the data needed to brew (open beans, their recipes, gear, routines, tags, My setup), so the app opens and the shot form prefills without a connection. A shot saved offline (new or edited) goes into a **queue on the device** and is sent when the connection returns; the server accepts each queued shot exactly once. Library changes need a connection. *(Revised 2026-10-16: saving offline was first out of scope.)*
  - *Why:* a shot should never be lost because the Wi-Fi dropped at the brew station; limiting the queue to shots keeps the sync logic small.
- **D-62 — Claude Code writes all the code, so guardrails come first.** The owner decides behavior (this log, the design system, the running app) and does not review code. Therefore: TypeScript strict mode; automated tests on domain logic (recipe matching, prefill rules, statistics) written before the UI that uses it, each test naming the D-number it protects; linting and formatting enforced; CI must pass before anything is merged; a separate review pass by Claude Code before merge. CLAUDE.md points to this log (behavior) and the design system (visuals) as sources of truth. *(Revised 2026-10-16: was "most of the code".)*
  - *Why:* when an AI agent writes all the code, the owner's confidence has to come from checks that run every time and trace back to decisions, not from reviewing lines.
- **D-63 — Recipe is its own entity.** A recipe is a stored record (bean, machine, grinder, basket, puck prep routine, grind, dose and setup values). Every shot points to one recipe. A recipe never changes: saving a shot with different values finds the matching existing recipe for that bean and machine, or creates a new one.
  - *Why:* "recipe" is a real concept in the UI (reuse count, best recipe, Brew next, recipe history), so it should be a real thing in the data that people and code can read directly.
- **D-64 — Custom and hand-set values are stored as JSON, with a query system on top.** Machine features (built-in and custom, D-46), grinder and basket specs, and puck prep step settings (D-51) are JSON, checked against one schema per shape. Insights reads them through a **query system**: one wide "shot facts" view, a registry of named measures and dimensions (including any custom feature or step setting), and a tested statistics module. New insights are added as definitions, not new code paths.
  - *Why:* custom features have no fixed columns, and Insights will keep growing; a registry makes every custom value usable in Insights without schema changes.
- **D-65 — Recipes keep a snapshot of the setup.** A recipe stores the values *and* the labels and units as they were when it was made. Later changes to gear (renaming a feature, changing a step size, removing a feature) never change past shots.
  - *Why:* history must stay true to what was actually brewed; stable feature keys make renames safe for matching.
- **D-66 — "Best recipe" = highest average score with at least 3 rated shots.** Used on Home (D-32), the bean detail page (D-42) and as the re-buy starting point (D-41). Until a bean has a recipe with 3 rated shots, the recipe with the highest single score is shown instead. Ties go to the recipe with more rated shots, then the most recent.
  - *Why:* one lucky 9 should not beat a recipe that reliably scores 8; the fallback keeps a brand-new bean from showing nothing.
- **D-67 — Taste scales.** Balance runs from −10 (sour) through 0 (balanced) to +10 (bitter); body, sweetness and aftertaste run from 0 to 10. All whole numbers; empty means not set (D-11).
  - *Why:* fine enough for a slider, coarse enough to avoid false precision (same reasoning as D-09), and clean for statistics.
- **D-68 — Gear is one table with a spec per kind.** Machines, grinders and baskets share one table; each kind's details live in a JSON spec checked by its own schema (D-64).
  - *Why:* Gear is one concept in the UI (D-39); measuring gear (D-47) can be added later without a migration.
- **D-69 — The GitHub repository is home; design sources are synced into it.** The code lives in a private GitHub repository (`coffee-nerd`), to be opened as open source once mature.
  - **Documents** (this log, the data model, the roadmap) have their master copy in the repository's `docs/`. The claude.ai Project keeps a mirror that is refreshed whenever the documents change there.
  - **Visuals** keep their master in the design system and canvas artifacts (D-58). The repository holds a synced, read-only copy: `design-system/` (tokens, CSS, guidelines, logo) and `docs/screens/` (every screen as PNG and HTML at 412 × 915). A visual change is made in the artifact first, then re-exported. Claude Code's file tools are blocked from editing these folders.
  - *Why:* Claude Code works best with everything in the repository, in plain files it can read and test against; a screenshot it can compare with beats a link. One master per kind of source prevents two versions drifting apart.
- **D-70 — How Claude Code builds the app.** Work follows `docs/roadmap.md`, one milestone at a time: branch, tests first for logic, `/build-screen` (screenshot compared with the reference) for screens, a fresh-context `decision-reviewer` pass, then a pull request that may only merge with green CI. `CLAUDE.md` stays short (under 200 lines) and points to the sources of truth; detail lives in path-scoped rules, skills and one reviewer subagent, following Anthropic's Claude Code best practices.
  - The build order puts the core loop first (foundation → domain logic → database → shot form → Journal) so the app can be tried at the brew station early, then the Library pages, Home, Insights and offline.
  - *Why:* the owner does not review code (D-62), so every change must prove itself: by tests, by screenshots against the design, and by an independent review that traces back to decisions.

---

## Open topics / next steps (from the UX plan)

1. ~~Users & jobs~~ (done for espresso)
2. Core loop: bean → recipe → shot → insight
3. ~~Information architecture~~ (D-30 to D-34)
4. Interaction principles (written rulebook)
5. ~~Design system~~ — "Coffee Nerd" Design System artifact (tokens, type, spacing, radii, 12 components, logo). Still to do: light theme, focus/hover specs, tablet layouts
6. Prototype & test at a real brew station
7. Success metrics (time to log, % rated, repeat rate)
8. ~~Shot form: how a recipe change is shown~~ (D-16, D-12)
9. ~~Bean overview, Add bean, bean detail~~ (D-37, D-35, D-40, D-41, D-42) — still to do: recipe detail (its shots)
10. ~~Pressure profile options~~ (D-24)
11. ~~Setup sheet: show how a changed setup value is highlighted~~ (D-90)
12. ~~Puck prep routine builder and New step~~ (D-51, D-52)
13. ~~Gear list, machine detail, Edit My setup~~ (D-38, D-44, D-45, D-48, D-49)
14. ~~Tags home~~ (D-29, D-53) — still to do: tag sheet (rename / merge / remove)
15. Home: design the other three graphs (Time vs. yield, Roast age, Consistency)
16. ~~Journal, Insights, shot detail~~ (D-54 to D-57) — still to do: more Dial-in cards (e.g. grind vs time scatter, sour/bitter vs ratio)
17. Logo: refine the bean-with-glasses mark (app icon for the PWA home screen)
18. ~~Library landing page~~ (D-50)
19. ~~Origin field: free text vs. a country list~~ (D-41: country picker + free-text region)
20. Measuring gear (scales, refractometers): where it fits, what it records (results like yield, time, TDS) (D-47)
21. Grinder: "Log burr change / recalibration" — a dated marker on the grinder that also shows as a line on Home's graphs (future)
22. Households: each user builds their own Library, or a household share toggle on Library items (D-60; the data model supports both)
23. ~~Shot form when a save fails offline~~ (D-61: queued and sent when online) — still to do: how a waiting shot looks in the Journal
24. ~~Data model~~ (`docs/data-model.md`, D-63 to D-68)
25. ~~Repository setup and CLAUDE.md~~ (D-69, D-70; `docs/roadmap.md`)
26. Open source: license (e.g. MIT or AGPL), contributing guide and code of conduct, when the project is mature (D-69, roadmap M11)
27. Optional: `@claude` in GitHub issues and pull requests (Claude Code GitHub Action; needs the Claude GitHub app and a secret)
