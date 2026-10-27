# Coffee Nerd — UX Decision Log

Status: living document. Each decision records **what** was decided and **why**, so later design and code can be checked against it. Technical decisions start at section 13.

Last updated: 2026-10-27

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

- **D-30 — Bottom tab bar: Home · Journal · + · Library · Insights.** *(Revised 2026-10-18: see D-114; 2026-10-25: see D-199.)* On tablet the bar becomes a left side rail. Settings (units, backup, export) sit behind a gear icon on Home, not in a tab.

| Tab | Purpose |
|---|---|
| **Home** | Last shot plus statistics for the current bean (D-32) |
| **Journal** | Every shot, newest first; filter by bean, machine or recipe |
| **+** | New shot (D-31) |
| **Library** | Beans, Gear, Puck prep routines, Tags (D-33) |
| **Insights** | Deep, cross-bean analysis |

- **D-31 — "+" is the only way to add a shot.** The center "+" is always visible and opens the prefilled shot form. No duplicate "brew again" shortcuts elsewhere.
  - *Why:* one obvious entry point; duplicates add clutter without saving taps.
- **D-32 — Home = data for the bean you're brewing.** *(Revised 2026-10-25: see D-193 to D-198.)* Top to bottom:
  - **App banner** (D-34) with the settings gear.
  - **Bean scope:** a pill with the last used bean; tap to switch between open beans (several can be open at once). Everything on Home follows this bean.
  - **Last shot:** score, grind, dose in/out, time, ratio, taste, recipe tag.
  - **Quick numbers:** bean freshness (days since roast; grams left only when a bag weight was entered, D-35) and this week (shots, average score, how many rated).
  - **Best recipe for this bean:** top-scoring recipe with its score and reuse count.
  - **Graphs**, one at a time behind chips: Dial-in progress (score per shot, recipe changes marked), Time vs. yield, Score vs. roast age, Recipe consistency. The last chosen graph is remembered. The graph is the flexible region that absorbs differences in screen height (D-36).
  - *Why:* nerds want data right away, but four stacked graphs would clutter a phone screen; chips keep all four one tap away. Home answers "how is this bean going?"; Insights answers "what do I like across beans?".
- **D-33 — Library is the barista's "nerdy basement".** Beans, Gear, Puck prep (steps and routines), Tags. Visited now and then to tinker, not every day. Pickers in the shot form link straight into the relevant Library page. Each Library page has its own "Add" button in the header (e.g. "Add bean", "Add gear"); the center "+" stays reserved for shots (D-31).
- **D-34 — App banner on Home.** *(Revised 2026-10-25: see D-199.)* The top of Home shows the logo (a coffee bean wearing glasses) to the left of the name **Coffee Nerd**, with the settings gear on the right. Only Home carries the banner; task screens (shot form, sheets, forms) keep their own titles.
  - *Why:* the app should advocate for itself and have a recognizable identity, without costing space on screens used mid-task.
- **D-39 — One word per concept in the UI.** Machines, grinders, baskets and accessories are called **Gear** everywhere (page title, buttons, links), never "Equipment". The same rule applies to every term: once a concept has a name, all screens use it.
  - *Why:* "Equipment" as a title next to an "Add gear" button made users wonder if they were two things; "Gear" also sounds more modern.

- **D-54 — Journal.** *(Revised 2026-10-18: see D-111, D-112, D-117.)* Every shot, newest first, grouped by day (Today, Yesterday, then dates). Header "Journal" with "9 shots this week". **Filter chips:** All beans ▾, Unrated · N, Any recipe ▾. Each shot is a row: score block on the left (or a dashed amber **"Rate"** block for unrated shots), bean name and time, core values ("1.6 · 18.0 → 38.5 g · 25.5 s"), then taste and the recipe tag (cherry, D-16). The list is the scrolling region (D-36). Tapping a shot opens it.
  - *Why:* one quick scan answers "what did I pull, how was it, and was it the same recipe?"; the Rate block turns unrated shots into a one-tap job instead of a nag.

- **D-55 — Insights: plain-language insight cards, four topics.** *(Revised 2026-10-25: see D-201 to D-204, D-206 to D-208.)* Header "Insights" with the data basis ("From 214 shots · 9 beans"). Topic chips: **What I like** (origins, processes, roasters, flavor families), **Progress** (score and consistency over time), **Dial-in** (how grind, ratio, preinfusion etc. relate to score and sour/bitter), **Comparisons** (routines, grinders, baskets compared fairly — same bean, everything else equal). Each **card** states one finding as a sentence ("You score natural coffees 1.1 points higher than washed ones"), shows a small chart, and names its basis ("Average score · 86 rated shots · 7 beans"). The card list scrolls (D-36).
  - **Honest charts:** bars start at zero (scores on a 0–10 scale); the top item is amber (it is your score data, D-19), the rest muted.
  - **Not enough data:** a card only appears when it has enough shots behind it; otherwise it says what's missing (e.g. "Rate 5 more washed shots to compare").
  - *Why:* nerds want the numbers, but a sentence first makes the point instantly; showing the basis keeps the app honest about small samples.

- **D-56 — Insights speak statistics.** *(Revised 2026-10-25: see D-201 to D-205, D-207, D-211, D-212, D-216.)* Refines D-55. Cards use real statistical charts, each with a one-sentence finding and its basis:
  - **What I like:** **box plots** of score by process (box = middle 50 %, amber line = median, whiskers = range, n per group); **mean ± 1 σ** dot-and-whisker by origin.
  - **Progress:** **line chart** of weekly average score with a **± 1 σ band**, so you see both "better" (line rises) and "steadier" (band narrows).
  - **Dial-in:** a **bell curve** — histogram of shot time on one recipe with the fitted normal curve, mean line (μ) and the ± 1 σ zone ("2 in 3 shots land between 26.5 and 29.3 s").
  - **Comparisons:** **σ per puck prep routine** (same bean, same recipe) and **σ of score per bean** (reused recipes only; lower = steadier). Small samples are called out in the card's footnote.
  - **Chart colors:** score data in amber (D-19); other measures (time, yield) in cream; reference marks and secondary data in muted brown. Groups are identified by their axis labels, never by color alone. Grids are faint; axes on scores start where honest (bars from zero; box plots and dot plots on the full 1–10 scale or a labelled range).
  - In the app every chart gets a tap/hover tooltip with the exact numbers (dataviz rule); mockups show the static state.
  - *Why:* coffee nerds want to see spread, not just averages — σ and distributions answer "is this a better recipe or just a lucky shot?"
- **D-57 — Shot detail.** *(Revised 2026-10-18: see D-109, D-110, D-113, D-115 to D-118; 2026-10-25: see D-197.)* Tapping a Journal row opens it. Header: back to Journal, "Shot" with date and time, **Edit** (opens the shot form in edit mode, D-14, with "Save changes"). Then: **bean & setup card** (bean, roast age at the time, gear, puck prep routine, pressure profile, recipe tag); **core values** as four tiles (grind, dose, yield, time) and the ratio; **taste** (score block, balance, body and sweetness as small scales, flavor chips); **"Compared with this recipe"** — this shot against the recipe's history, e.g. "25.5 s vs μ 27.9 s · 1.7σ faster than usual", "Score 7 vs average 7.7 · within normal range"; **notes** (labelled "just for you", D-27).
  - *Why:* a shot only means something next to its recipe's history; the σ comparison tells you instantly whether this shot was an outlier or normal variation.
- **D-109 — "Compared with this recipe" uses the recipe's other shots.** The shot detail compares this shot with the recipe's other shots, not including itself. It needs at least two other shots with a value; with fewer, the line says "Not enough shots yet". The count in the card's header ("3 shots") counts all of the recipe's shots. Refines D-57.
  - *Why:* an outlier should not pull the average and the spread towards itself.
- **D-110 — Within one σ is "within normal range".** *(Revised 2026-10-25: see D-209.)* A shot whose time or score lies within one σ of the other shots' average reads "Within normal range". Further away, time reads "1.7σ faster than usual" or "slower than usual", and score "higher than usual" or "lower than usual". Time and score are compared, as on the screen. Refines D-57.
  - *Why:* matches the screen, where 1.7σ is named as unusual; one σ is a common, easily explained bar.
- **D-111 — The Rate block opens a score sheet.** *(Revised 2026-10-25: see D-197; 2026-10-26: see D-223.)* Tapping the dashed "Rate" block on a Journal row opens a small sheet with the score row; tapping a score saves it and closes the sheet. The rest of the row still opens the shot. Refines D-54.
  - *Why:* rating an unrated shot becomes the one-tap job D-54 promises.
- **D-112 — "Any recipe" lists the chosen bean's recipes.** The Journal's recipe filter appears once a bean is chosen and lists that bean's recipes by their values ("1.6 · 18.0 g · Daily routine · 3 shots"), most recently brewed first. Refines D-54.
  - *Why:* recipes have no names; within one bean their values tell them apart.
- **D-113 — Editing a shot compares with the shot before it.** In edit mode, the changes (sage, D-15) and the recipe tag (D-16) compare with the same bean's shot brewed before this one, as when the shot was brewed. The bean card can switch the shot to another open bean, keeping the values entered; the comparison then uses that bean's shot before this one. The brewing time stays as it was. "Save changes" returns to the shot detail. Refines D-57 and D-94.
  - *Why:* the shot keeps telling the same story it told when it was logged.
- **D-114 — The tab bar comes before all its pages.** *(Revised 2026-10-18: see D-124.)* The tab bar (D-30) is built now on the tab screens; Library and Insights are shown dimmed and do nothing until their milestones. Refines D-30.
  - *Why:* the Journal is reachable the way it will always be, without a stand-in link.
- **D-115 — The shot detail shows aftertaste when it is set.** Below balance, body and sweetness, a fourth scale shows aftertaste, only for a shot that has one. Refines D-57.
  - *Why:* nothing you entered stays hidden.
- **D-116 — A shot can be deleted from the edit form.** *(Refined 2026-10-27: see D-241, the confirmation is a dialog.)* The edit form ends with "Delete shot"; a confirmation asks first. Deleting removes the shot and its flavor notes; a recipe left with no shots is removed unless it is marked Brew next (data-model §4.1). The app then returns to the Journal. A bean that this shot finished automatically (D-40) stays finished; it is reopened from the bean page. Refines D-57.
  - *Why:* a mistaken shot should not stay in the statistics forever; the edit form is where you already change a shot.
- **D-117 — "Back" returns to the Journal as you left it.** *(Revised 2026-10-25: see D-197.)* From the shot detail, "Back" opens the Journal with the filters you had (bean, recipe, unrated). "N shots this week" in the Journal header counts every shot, whatever the filters. Refines D-54 and D-57.
  - *Why:* checking one shot should not lose the view you were working in; the header describes the Journal, the filters the list.
- **D-118 — The shot detail names what changed for a new recipe.** For a recipe's first shot the tag reads like the shot form's, e.g. "New recipe · grind changed", compared with the bean's shot before it (D-81, D-113). Journal rows keep the short "New recipe". Refines D-57.
  - *Why:* the detail is where you look for why a shot differs; the list stays short.
- **D-119 — The Journal's undesigned states are accepted as built.** The Rate sheet, the bean and recipe lists, the empty Journal, the "Edit shot" wording, the "Not set" and "Not rated" states, the sliding chip row and the taste sliders' "Clear" control stay as built in M4 until the canvas designs them. The design system will be synced (empty slider handle, pressed buttons, the sheet's drag strip, the tab bar's height) before M5.
  - *Why:* they work at the brew station; a redesign can replace them later without changing behavior.
- **D-120 — The Journal's row details and unrated count stay as built.** A Journal row leaves out a missing yield or time ("1.6 · 18.0 g · 25.5 s"), shows nothing on the taste line for a rated shot without a balance, and names the year for a date in another year ("Tue 30 Dec 2025"). "Unrated · N" counts the shots within the chosen bean and recipe filters. Refines D-54 and D-117.
  - *Why:* the row stays short and shows only what was entered; the count matches the list you get when you tap it.
- **D-121 — Recipes with the same values say what tells them apart.** *(Revised 2026-10-19: see D-170.)* When two recipes in the Journal's recipe filter would get the same label because they differ only in setup (for example temperature), each label adds the setup values in which they differ: "1.6 · 18.0 g · 94 °C · 3 shots". Refines D-112.
  - *Why:* two entries that read the same cannot be told apart.
- **D-122 — Editing a shot offers open beans only.** The bean list on the edit form lists open beans only, also when the shot's own bean has been finished since; the shot keeps its bean until another open bean is picked. Refines D-113.
  - *Why:* the list is the same as the shot form's; finished beans stay out of the way.
- **D-123 — The shot detail's details stay as built.** When the recipe's other shots do not vary, "Compared with this recipe" shows only the average. The notes card and the flavor notes are left out when empty, and a long note scrolls inside its card (D-36). The flavor notes get 12 px corners from a new design-system token (`radius-block`), added in the design-system sync (D-146). *(Corrected 2026-10-18: this entry first named the score block too, but ShotDetail.png draws it at 14 px, as built.)* Refines D-57 and D-109.
  - *Why:* without spread there is no normal range to compare with; empty cards add nothing; the screens draw 12 px corners.
- **D-124 — The Library tab opens Beans until the Library page exists.** *(Revised 2026-10-18: see D-156.)* Until the Library landing page (D-50) is built, the Library tab opens the Beans overview, which then has no back arrow. Refines D-114.
  - *Why:* Beans is reachable the way it will be, without building the landing page early.
- **D-193 — Home shows one graph until the others are designed.** Home is built with the Dial-in progress graph only, and the chip row is left out while it is the only graph. Time vs. yield, Score vs. roast age and Recipe consistency come after Insights (roadmap M9), once they are designed (open topic 15); the chip row comes back with the second graph. Revises D-32.
  - *Why:* the other three have no design, and the data layer for graphs is built with Insights; a chip that does nothing is clutter.
- **D-194 — "This week" on Home counts the bean on Home.** The This week card counts this bean's shots since Monday (in the user's time zone), their average score and how many are rated. The Journal header keeps counting every shot (D-117). Refines D-32.
  - *Why:* everything on Home follows the chosen bean; the count across beans is already in the Journal.
- **D-195 — Home and "+" share one bean.** Choosing a bean with the bean pill on Home also makes it the bean the next "+" starts from, as a saved shot does. A Brew next mark on another bean still decides the next shot (D-43). Refines D-32 and D-140.
  - *Why:* Home shows the bean you are about to brew; two different beans on Home and the shot form would confuse.
- **D-196 — Dial-in progress plots the last 12 rated shots.** The graph shows the score of this bean's last 12 rated shots, oldest on the left; unrated shots are left out, never drawn as 0 (D-11). A cherry dashed line marks where a new recipe starts: before a shot whose recipe differs from the shot drawn before it. With fewer than 2 rated shots the graph area says that rated shots are needed. Refines D-32.
  - *Why:* the graph is about score progress; unrated shots are a one-tap job on the Last shot card and in the Journal.
- **D-197 — Home's cards open the shot and the bean.** Tapping the Last shot card opens that shot (D-57), and its Back returns to Home. Tapping the Best recipe card opens the bean page (D-42), where Brew next lives. The Best recipe card shows its score as D-135 does: "7.7 / 10", the average with one decimal, once the recipe has 3 rated shots, otherwise its highest single score, "8 / 10". An unrated last shot shows the dashed amber Rate block: tapping it opens the score sheet (D-111), and the rest of the card opens the shot. No card starts a shot (D-31). Refines D-32, D-57, D-111, D-117 and D-135.
  - *Why:* one tap to the details you want next, through pages that exist, without a second way to start a shot.
- **D-198 — Home without data keeps its layout.** With no open bean, Home shows the banner and one card, "No open beans", with "Add bean", which opens the Add bean form (then the bean's page, D-140). A bean with no shots shows the bean pill and bean freshness, and the other cards say "No shots yet". A bean with shots but none rated says on the Best recipe card that a rated shot is needed; the graph says what it needs as D-196 sets out. Built without a design. Refines D-32.
  - *Why:* the first visit must not look broken, and each empty card says what fills it.
- **D-199 — The gear on Home opens Settings.** The gear in the app banner opens a Settings page that holds only "Sign out" until Settings is built (roadmap M11), replacing the temporary button on the start page. Built without a design. Refines D-30 and D-34.
  - *Why:* Settings is where signing out will live; M11 adds to the page instead of moving the button again.
- **D-200 — "Shot saved" is a short bar above the tab bar.** After "Save shot" the app returns to the page where "+" was pressed, Home or the Journal (D-95), and shows a bar just above the tab bar. "Shot saved" fades after 4 seconds. When the shot finished the bean (D-40), the bar says so with Undo and stays 10 seconds; after Undo, "… is open again" shows the same way. Built without a design. Refines D-95.
  - *Why:* within thumb reach for Undo, it covers neither the bean pill nor the Journal filters, and goes away on its own.

- **D-201 — The bell curve lives under Dial-in.** The shot-time bell curve card (drawn on screen 24) shows under the Dial-in chip, as D-56 says; Progress shows the weekly average score line only. More Dial-in cards come later (open topic 16). Refines D-55 and D-56.
  - *Why:* the decision log already places it there, and Dial-in then has a card without a new design.
- **D-202 — Insights starts with the six drawn cards.** Score by process (box plot), score by origin (average ± 1 σ), weekly average score (line with ± 1 σ band), shot time on one recipe (bell curve), shot time by puck prep routine (average ± 1 σ) and most consistent beans (σ bars). Cards for roasters, flavor families, grinders and baskets (D-55) come later, each as a new definition (D-64). Refines D-55 and D-56.
  - *Why:* these six are designed; the others would be built without a design and can be added without new code paths.
- **D-203 — How much data a card needs.** *(Revised 2026-10-25: see D-211, D-212.)* Score by process and by origin: 2 groups with 5 rated shots each. Weekly average score: 4 weeks with 2 rated shots each. Bell curve: 10 shots with a time on the recipe. Routines: 2 routines with 5 shots each. Most consistent beans: 2 beans with 5 rated shots each on recipes brewed more than once. Below that, the card says what is missing (D-55). A group with fewer than 10 shots is named in the basis line as one to treat with care, as screen 25 does. Refines D-55 and D-56.
  - *Why:* five shots is the least that gives a spread worth showing; the care line keeps small groups honest without hiding them.
- **D-204 — Comparing routines holds everything else equal.** *(Revised 2026-10-25: see D-210, D-215.)* The routine card compares shots of the same bean whose recipes are equal apart from the routine: same machine, grinder, grind, dose (within 0.2 g, D-186), basket and setup. Each routine's spread is measured within those groups. The routine is part of a recipe (D-65), so screen 25's "Same bean, same recipe" reads as this. Refines D-55 and D-56.
  - *Why:* this is D-55's "everything else equal"; with the bean alone, grind changes would mix into a routine's spread.
- **D-205 — The bell curve uses the best recipe of the bean on Home.** *(Revised 2026-10-25: see D-213.)* The shot-time card draws the best recipe (D-66) of the bean on Home (D-195). When that recipe has too few shots with a time (D-203), the card says what it needs. Refines D-56.
  - *Why:* it answers "is the recipe I'm brewing under control?", the question Dial-in is for.
- **D-206 — Card titles follow the finding.** *(Revised 2026-10-25: see D-214.)* Each card has a title and a sentence for each outcome its data can have, including "no clear difference" when the top two are within 0.5 points (or 0.5 s for time). The wording is drafted in the pull request that builds the card, and the owner approves it there. Refines D-55.
  - *Why:* a title that states the finding is the point of D-55, so it has to change with the data, and never claim a winner that is not there.
- **D-207 — Insights states without a design are built plainly.** The tap tooltip with exact numbers (D-56), a card without enough data (D-203) and Insights with no shots are built in the card's own style without a design, and listed in the open items for the canvas. Refines D-55 and D-56.
  - *Why:* as with Home (D-198), the first visit must not look broken, and waiting for designs would hold up M9.
- **D-208 — What Insights counts, and where it opens.** The header counts every shot and every bean with a shot ("From 214 shots · 9 beans"); cards on score count rated shots only (D-11). Weeks run Monday to Sunday in the user's time zone, as on Home (D-194). Insights opens on What I like each time. Refines D-55.
  - *Why:* the header says how much you have logged; a score card must never count an unrated shot as 0.
- **D-209 — "Within normal range" compares the distance as shown.** The distance in σ is rounded to one decimal before it is compared with one σ, so 1.04σ reads "Within normal range", never "1.0σ faster than usual". Refines D-110.
  - *Why:* the words must agree with the number on the screen.
- **D-210 — The routine card compares on the bean on Home.** The routine card (D-204) uses the bean on Home (D-195), as the bell curve does (D-205), and names it in its basis line ("Guji Hambela only", screen 25). Without enough comparable shots on that bean, the card says what it needs (D-203). Refines D-204.
  - *Why:* both Dial-in style cards then answer questions about the bean you are brewing.
- **D-211 — A bean's consistency is its spread within each recipe.** The most consistent beans card measures each bean's score σ within each recipe brewed more than once and pools those (the pooled σ of data-model §5). Moving between recipes does not count as spread. Refines D-56 and D-203.
  - *Why:* dialling in changes the score on purpose; consistency is how much the same recipe varies.
- **D-212 — The weekly line spans the last 12 weeks.** The weekly average score covers the last 12 weeks, as screen 24 draws ("12 weeks ago" to "This week"). A week with fewer than 2 rated shots is drawn as a gap in the line and the band, never as 0 (D-11). Refines D-56 and D-203.
  - *Why:* a week needs two shots for a σ; a gap is honest about a quiet week.
- **D-213 — The bell curve without a best recipe says what it needs.** With no bean on Home (D-198) or no rated shot on it yet (D-66), the bell curve card says what it needs, as D-203 does. Refines D-205.
  - *Why:* the card stays in place and tells you how to fill it, as Home's cards do (D-198).
- **D-214 — Which number "no clear difference" compares.** Score by process compares medians, score by origin compares averages, both within 0.5 points. The routine and most consistent beans cards compare σ, within 0.2 s or 0.2 points. The weekly line and the bell curve have no "top two", so the rule does not apply to them. Refines D-206.
  - *Why:* each card is judged by the number its chart shows; a σ gap of 0.5 would hide real differences in steadiness.
- **D-215 — Comparable doses join the closest recipe.** When the routine card groups recipes equal apart from the routine (D-204), doses "within 0.2 g" are not transitive, so recipes are taken from the most brewed down (the first brewed on a tie) and each joins the closest one within 0.2 g; one with none in reach starts its own group. Refines D-204.
  - *Why:* a shot already picks the closest recipe this way (D-186), so the two never disagree.
- **D-216 — The clear winner is amber, whatever the measure.** On an Insights chart the clear winner (the top row) is amber whether it shows score, shot time or spread, as screen 25 draws the steadier routine's shot-time row. With no clear winner (D-214) no row is amber. Other rows stay cream or muted. Refines D-55 and D-56.
  - *Why:* one rule, "amber is the winner", reads more easily than one rule for scores and another for time.

## 7. Shot form (espresso)

- **D-03 — Prefill from last shot.** *(Revised 2026-10-17: see D-72, D-75, D-76; 2026-10-26: see D-222.)* A new shot starts as a copy of the last shot (bean and core values). Changed values are highlighted against the previous shot. Ratio is calculated automatically. When there is no last shot for this bean, the shot starts from **My setup** defaults (D-38). When a recipe is marked **"Brew next"** (D-43), the next shot starts from that recipe instead.
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
- **D-14 — Shot form layout.** *(Revised 2026-10-17: see D-94, D-95, D-107; 2026-10-23: see D-189, D-190.)* Full-screen page opened from "+". Top to bottom: bean card (bean, machine, grinder, standing-setup summary, recipe tag) → 2×2 grid of core values (grind, dose, yield, time), each a card with large value and −/+ steppers → calculated ratio → balance slider → score row → More → full-width Save.
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

- **D-107 — Buttons show that they were pressed.** Every −/+ and every plain button flashes amber while pressed and fades back quickly; the amber Save and Add buttons get lighter and press in slightly. Choices that change state (score, chips, tabs, switches) already show the new state and need no flash. Refines D-14 and D-19 (amber is your input and actions).
  - *Why:* at the brew station you look at the scale, not the phone; a short flash confirms a tap was taken without reading the value.
- **D-94 — The bean card switches the bean.** *(Revised 2026-10-18: see D-113, D-134, D-153.)* Tapping the bean card on the shot form opens a list of open beans. Picking one starts the form again from that bean's starting values (D-03, D-43, D-73, D-38). Choosing another machine or grinder on the shot form waits for the Gear pages (roadmap M6). Refines D-14.
  - *Why:* switching between open beans is the change you make at the brew station; gear changes are rare and belong with the Gear pages.
- **D-95 — After saving, the app goes back with a message.** *(Revised 2026-10-25: see D-200.)* "Save shot" returns to the page where "+" was pressed, with a short "Shot saved" message. When the shot used up the bag and the bean was finished automatically (D-40), the message says so, with an Undo that reopens the bean. Refines D-14 and D-40.
  - *Why:* you see that the shot is safe without an extra screen, and the automatic finish can be undone right where it is announced.
- **D-134 — The shot form's bean list shows roast age.** Each row in the bean list behind the bean card (D-94) shows the bean's name, process and roast age: "Guji Hambela · Natural · 12 days". The list stays a plain sheet. Refines D-94.
  - *Why:* freshness helps choose between open beans; a plain list is enough for one tap.

### More (bottom sheet)

- **D-21 — More opens as a bottom sheet with two tabs: Setup and Tasting.** *(Revised 2026-10-17: see D-108; 2026-10-23: see D-189; refined 2026-10-27: see D-241, a confirmation is a dialog over Save.)* The sheet covers the form but **stops above the Save button**, which stays visible and active. Tapping outside the sheet (the dimmed form) closes it.
  - *Why:* the user can save from anywhere without closing the sheet first; tap-outside-to-close is the expected sheet behavior on phones.
- **D-108 — Sheets slide, and can be dragged down to close.** A bottom sheet slides up when it opens and down when it closes, and the dimmed screen behind it fades. Dragging the handle (or the top of the sheet) down closes it; a short drag springs back. Tapping outside still closes it (D-21). Without motion when the phone asks for reduced motion. Refines D-21.
  - *Why:* the handle invites a drag on every phone; a sheet that ignores it feels stuck.
- **D-22 — Setup tab (Dialer profile):** *(Revised 2026-10-18: see D-90, D-155.)* temperature, pressure profile (D-24), basket (brand/model and size, opens a picker), puck prep (D-25).
  - All setup fields are part of the **recipe** (D-13): changing one makes a new recipe and is highlighted like any other change.
- **D-90 — A changed setup value looks like a changed core value.** *(Revised 2026-10-17: see D-102.)* On the Setup tab, a value that differs from the last shot turns sage with a small sage delta pill, as on the core value cards (D-15); a feature switched on or off since the last shot shows a sage "On" or "Off" pill. Refines D-22.
  - *Why:* one way to show "changed since last shot" everywhere (D-19), so the sheet reads like the form.
- **D-102 — Sage wins on a changed pressure, basket or puck prep.** A changed phase pressure turns its "at 2.0 bar" value sage, with a sage delta pill, even though it is tappable. A changed basket or puck prep routine shows its name in sage, without a pill, since there is no number to show. Refines D-90.
  - *Why:* sage always means "changed since last shot" (D-19), so a change is never hidden by another color's job.
- **D-24 — Pressure profile = a base pressure plus phases you switch on or off.** *(Revised 2026-10-23: see D-184.)* The base is "Flat" (main extraction pressure, in bar). Phases offered by the machine (for the Lelit Bianca: preinfusion, low bar start, low bar end) each have an on/off switch and can be combined freely. A phase that is off collapses to one quiet line. A phase that is on shows its **duration in seconds as the main value** (with −/+) and its **pressure in bar as a small tappable value** underneath (e.g. "at 2.0 bar").
  - Which phases exist, and whether they have a pressure, comes from the machine's capability profile (D-02).
  - *Why:* matches how the Bianca is actually used (flat, plus any combination of preinfusion, low bar start and low bar end) and replaces a pick-one profile list. Seconds are what you set most; bar is still recorded without a second full control.
- **D-25 — Puck prep points to a saved routine.** *(Revised 2026-10-19: see D-155, D-166.)* The Setup tab shows the chosen routine's name and its steps in order (e.g. "Daily routine: WDT → Distributor → Tamp → Puck screen"); tapping opens a picker of routines. Routines are built in Library (D-26).
  - *Why:* puck prep varies a lot between baristas; referencing a routine keeps the shot form short while still recording exactly what was done.
- **D-23 — Tasting tab:** *(Revised 2026-10-17: see D-96, D-97, D-101, D-106; 2026-10-23: see D-190 to D-192.)* body (light ↔ heavy), sweetness (low ↔ high), aftertaste (short ↔ long) as sliders with the same gesture as balance; flavor notes as chips from a short coffee flavor list plus "Add your own" (custom notes become chips); free-text notes.
  - Tasting follows D-11: everything starts empty, never copied from the last shot.
  - *Why:* sliders match the balance control; chips give structured data that Insights can use later.
- **D-27 — Free-text notes are labelled as personal.** The notes field carries the hint "Just for you · not used in Insights".
  - *Why:* free text cannot be used for statistics; saying so sets the right expectation and nudges users toward flavor chips for anything they want analyzed.
- **D-97 — Flavor chips: all of them, most used first.** *(Revised 2026-10-23: see D-191.)* The Tasting tab shows every flavor note as a chip, the ones you use most first, then alphabetical. The chip area scrolls on its own when the notes do not fit (D-36). Refines D-23.
  - *Why:* every note stays one tap away, and the ones you actually taste are on top.
- **D-101 — A note added on the Tasting tab joins "Other".** *(Revised 2026-10-19: see D-181.)* "Add your own" takes a name typed in place; the new note belongs to the family Other (D-53) and is created only when the shot is saved. Its family can be changed on the Tags page. Refines D-23.
  - *Why:* choosing a family mid-shot is a detour; a shot you leave unsaved should leave no stray notes behind.
- **D-189 — Setup and Tasting are two buttons.** The shot form's "More" button is replaced by two half-width buttons side by side, "Setup" and "Tasting", where More was. Each opens its own bottom sheet, without tabs; both still stop above Save and close like any sheet (D-21, D-108). Revises D-14 and D-21.
  - *Why:* in use, setup and tasting are separate moments (before and after the shot); one tap straight to each beats a sheet with tabs.
- **D-191 — The Tasting sheet scrolls as a whole, and flavor notes fold away.** The whole Tasting sheet scrolls when it does not fit, instead of only the chip area. The Flavor notes section has a header that folds and unfolds it; the app remembers on this phone whether it was left folded or open, for every shot. Revises D-97 and, for this sheet, D-36.
  - *Why:* the chip area was too small to use; folding keeps the sheet short for those who skip notes.

## 8. Taste and rating

- **D-08 — Default taste input: balance slider + overall score.** *(Revised 2026-10-23: see D-190.)* A **sour ↔ balanced ↔ bitter** slider, followed by an overall score. Full tasting (body, sweetness, aftertaste, flavor notes) under More (D-23).
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
- **D-106 — An empty slider shows where to tap.** A taste slider that is not set yet shows a hollow handle with a dashed outline in the middle of its track, so it reads as something to tap or drag; once set, the handle is the solid amber one. Refines D-08, D-23 and D-67. *(The dashed outline is borrowed from the design system's "add something new" chip; the design system should define this state, see open items.)*
  - *Why:* a bare track gave no hint that it can be used; a dashed outline says "nothing set yet" without suggesting a value.
- **D-98 — A score or taste value can be cleared.** Tapping the selected score again clears it, so the shot stays "not rated" (D-11). A taste slider that is set shows "Clear" next to its value. Refines D-10 and D-11.
  - *Why:* a mistaken tap must not force a score onto the shot; clearing keeps the data honest.
- **D-190 — Balance moves into Tasting.** The sour ↔ bitter balance slider leaves the shot form and becomes the first slider in the Tasting sheet, above body, sweetness and aftertaste, working as before (D-96, D-98, D-106). The shot form keeps the score. Every taste slider works like balance; this is the pattern for sliders in the app. Revises D-08 and D-14.
  - *Why:* the form gets more room for what you set at the machine; balance is tasted together with the rest.
- **D-192 — Every slider has a centre mark and a middle word.** Body, sweetness and aftertaste get balance's look: a mark in the middle of the track, and three words under it, the middle one "Medium" (Light · Medium · Heavy, Low · Medium · High, Short · Medium · Long), matching the word shown at 5 (D-96). Balance's slider is the design for every slider in the app. Refines D-23, D-96 and D-190.
  - *Why:* the owner found balance's slider clearest; one look for every slider.

## 9. Data model concept: Recipe vs. Result

- **D-13 — Recipe = intent; Result = outcome.** *(Revised 2026-10-23: see D-186.)*

| | Contains |
|---|---|
| **Recipe** (what you set) | Bean, machine, standing setup (incl. pressure profile and puck prep routine), grinder, grind setting, dose |
| **Result** (what you get) | Yield, time, ratio, taste |

- Shots with the same recipe are **attempts at the same shot**, even when yield and time differ.
- Changing any recipe element (e.g. turning off preinfusion) is a **new idea/experiment**, with no score reference.
- *Why:* two consecutive shots naturally vary in outcome; comparison is only meaningful for identical intent.
- Enables: consistency insights (variance of results within one recipe ≈ puck-prep repeatability), clearer experiments, bean-aging detection.

- **D-186 — A dose within 0.2 g is the same recipe.** When everything else in a recipe is the same, a dose up to 0.2 g away from the recipe's dose counts as that recipe: 18.1 g or 17.9 g reuses the 18.0 g recipe ("Recipe reused"). When more than one recipe is within reach, the closest dose wins; when two are equally close, the one brewed most recently. The shot keeps the exact dose it was brewed with, for its ratio and its detail, and a shot started from a recipe (the last shot, Brew next, a re-buy) starts from the dose of that recipe's last shot, as with yield and time. A dose within 0.2 g is not a change: the recipe tag never names it. Existing shots are matched again once under this rule. Revises D-13, D-16 and D-71.
  - *Why:* beans weigh out a tenth over or under; that is not a new idea, and splitting such shots into recipes hid their history.

## 10. Library (Beans, Gear, Puck prep, Tags)

- **D-50 — Library landing page.** What the Library tab opens to. Title "Library" with the subtitle "The nerdy basement", then **four full-width rows** — **Beans, Gear, Puck prep, Tags** — each with a cream icon tile on the left, its name and two short live summaries, and a chevron on the right (e.g. "2 open · 6 finished" / "Freshest: 4 days"; "4 items" / "Bianca · Timemore 064S"; "2 routines · 6 steps" / "In use: Daily routine"; "18 flavor notes" / "Most used: Berry"). No add buttons here; each section page has its own (D-33).
  - *Why:* four equal doors into the basement, each telling you something useful before you tap; the summaries make the landing page worth a glance rather than just a menu. Rows (instead of a 2×2 grid) give the summaries room to read in one line and match the list pattern used elsewhere in Library.
- **D-37 — Bean overview: open beans as cards, finished beans as rows.** *(Revised 2026-10-18: see D-131, D-132, D-135, D-136, D-137.)*
  - **Open** beans (several can be open at once) get a card with a large **roast age** block ("12 days since roast") on the left, then name, roaster · origin · process, and **best score · recipes · shots**. A bean with no rated shots says "Not rated yet".
  - **Finished** beans collapse into compact rows below (name, roaster · origin · process, best score, recipes · shots); this list is the part that scrolls (D-36).
  - "Add bean" sits in the header.
  - *Why:* open beans are what you choose between, so they get the space and the freshness signal; finished beans are history you look up now and then.
- **D-41 — Add bean form.** *(Revised 2026-10-18: see D-73, D-126, D-133, D-138, D-139, D-140, D-141, D-142.)* Full-screen form opened from "Add bean"; fits the screen without scrolling (D-36). Top to bottom:
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
- **D-42 — Bean detail page.** *(Revised 2026-10-18: see D-125, D-128, D-130, D-131, D-135, D-143.)* Opens by tapping a bean on the Beans overview (open or finished). It is everything about one bag; nothing on it is needed while brewing. Top to bottom:
  - Header: back to Beans, bean name, **Edit** (opens the Add bean form, filled in).
  - **About card:** roast age block (cream, as on the overview), roaster, country · region · process, variety · altitude · roast level, roast date and status (Open/Finished).
  - **Numbers:** best score, recipes, shots.
  - **Recipes for this bean**, best score first: core recipe (grind, dose → yield), the setup that differs (e.g. preinfusion, low bar start), average time, reuse count in cherry ("Reused 4x"; "Tried once" with a hollow dot), and the recipe's best score. This list scrolls (D-36). Tapping a recipe opens its shots (to be designed).
  - Each recipe has a round **"Brew next"** button (cup icon) on the right (D-43).
  - **"Mark as finished"** at the bottom as a quiet secondary button (becomes "Reopen" on a finished bean, D-40).
  - *Why:* answers "what have I learned about this bag?" — the recipe list is the bean's dial-in history in one view. Graphs stay on Home and in Insights to keep this page calm.
- **D-43 — "Brew next": start the next shot from a chosen recipe.** *(Revised 2026-10-18: see D-82, D-103, D-104, D-129.)* On the bean detail page, tapping a recipe's "Brew next" button marks it (amber button, amber outline on the row, "Next shot starts here"). The next "+" then opens the shot form prefilled with that recipe (its recipe values and setup; yield and time from its last shot), and the recipe tag shows its reuse count as usual. Only one recipe can be marked at a time; tapping again clears it. After that shot is saved the mark clears and D-03 (copy last shot) applies again.
  - "+" stays the only way to add a shot (D-31); "Brew next" only decides what it starts from.
  - The shot form says so: the bean card's bottom row shows **"Recipe chosen from Library"** (amber, cup icon) under the recipe tag, with a **"Use last shot recipe"** button that switches back to D-03 and clears the mark.
    - *Why:* a mark set yesterday and forgotten would otherwise make "+" start from an unexpected recipe.
  - *Why:* going back to your best recipe after experimenting should be one tap, not re-entering values by hand.
- **D-103 — A shot started from Brew next shows deltas against the last shot.** The deltas and ratio on a form started from Brew next compare with the bean's last shot (D-81), like any other new shot, so they show when the marked recipe differs from it. Refines D-43.
  - *Why:* one rule everywhere, and you see how far you are jumping back from what you brewed last.
- **D-104 — A marked recipe without shots is a "New recipe".** When the recipe marked Brew next has no shots (it is kept only by its mark), the recipe tag says "New recipe" and names what changed against the last shot, never "Recipe reused 0x". Refines D-16 and D-43.
  - *Why:* it has never been brewed, so it is new to your history.
- **D-35 — Bag weight is optional.** *(Revised 2026-10-18: see D-132.)* A bean can have a bag weight, but it is never required. When it is set, the app subtracts each shot's dose and shows grams left (on Home and the bean overview); when it is not, grams are simply not shown.
  - *Why:* some baristas track stock, many don't; an optional field serves both without nagging.
- **D-40 — Finishing a bean.** *(Revised 2026-10-18: see D-92, D-127, D-145.)* A bean moves from Open to Finished with **"Mark as finished"**, always available on the bean. When a bag weight is set (D-35) and grams left reach zero, the app **finishes the bean automatically** and says so, with an undo. A finished bean can always be reopened.
  - *Why:* manual works for everyone; automatic saves a step for those who track weight, but weights drift (spills, sharing), so the manual option and undo must always be there.
- **D-92 — Only a new shot finishes a bean automatically.** Editing a past shot (D-57) updates grams left but never finishes or reopens a bean; that stays a manual action. Refines D-40.
  - *Why:* an edit corrects history; finishing or reopening a bean by surprise during a correction would be confusing.
- **D-125 — A recipe on the bean page opens the Journal filtered to it.** Tapping a recipe on the bean detail page opens the Journal with that bean and recipe chosen in its filters (D-112). There is no separate recipe page. Refines D-42; settles open topic 9.
  - *Why:* the Journal already lists a recipe's shots; no new screen is needed.
- **D-126 — "Same as before" lists each bean once.** *(Revised 2026-10-18: see D-139, D-142.)* The "Same as before" sheet lists every earlier bean, open and finished, newest first. Several bags with the same name and roaster show as one row, the latest bag, which the new bag is linked to. Refines D-41.
  - *Why:* you re-buy a coffee, not a particular bag; the latest bag leads back through the chain (D-73).
- **D-127 — Finishing a bean by hand offers an undo.** "Mark as finished" keeps you on the bean page, turns the button into "Reopen" and shows a message, "Guji Hambela is finished", with Undo, as an automatic finish does. Refines D-40.
  - *Why:* one way of finishing behaves like the other, and a mistaken tap is undone where it happened.
- **D-128 — What a recipe row on the bean page shows.** *(Revised 2026-10-18: see D-143, D-144.)* The second line is the bean card's setup line (D-100: switched-on phases and custom features, then temperature) followed by the average time ("avg 28.0 s"). What is missing is left out: no score block for a recipe without a rated shot, and for a recipe kept only by its Brew next mark, "New recipe" in place of the reuse count and no average time. Refines D-42 and D-104.
  - *Why:* the same setup line everywhere; no empty boxes for values that do not exist.
- **D-129 — Brew next on a finished bean reopens it.** A finished bean's recipes keep their Brew next buttons; tapping one reopens the bean and marks the recipe. Refines D-43.
  - *Why:* going back to a coffee's best recipe should be one tap, even after the bag was marked finished.
- **D-130 — Editing a bean.** *(Revised 2026-10-18: see D-145.)* "Edit" on the bean page opens the Add bean form filled in, titled "Edit bean", without the "Same as before" row; the button reads "Save changes" and returns to the bean page. Refines D-42.
  - *Why:* it works like editing a shot (D-57); the re-buy link is set once, when the bag is added.
- **D-131 — Empty Beans pages say so in one line.** With no beans, the Beans overview shows "No beans yet" under the header, with "Add bean" in the header as usual. A bean with no shots shows "No shots yet" where its recipes go, and its numbers read "Not rated yet", 0 recipes and 0 shots. Refines D-37 and D-42.
  - *Why:* a plain line is enough until there is something to show.
- **D-132 — Grams left on the overview, and separated numbers.** An open bean's card on the Beans overview shows grams left at the end of its numbers line when it has a bag weight, and the numbers are separated by dots: "Best 8 · Recipes 5 · Shots 23 · 120 g left". Without a bag weight nothing is added. Refines D-35 and D-37.
  - *Why:* D-35 promised grams left on the overview; the owner found the numbers hard to read with only spaces between them.
- **D-133 — Choosing a country.** Tapping Country on the Add bean form opens a sheet with a search field on top and every country below, A to Z, in English. Refines D-41.
  - *Why:* a fixed list keeps origins comparable (D-41); search makes the long list quick.
- **D-135 — What "best" means on the Beans pages.** *(Revised 2026-10-25: see D-197.)* A bean's best score (the Beans overview and the bean detail page) is the score of its best recipe (D-66): that recipe's average score once it has at least 3 rated shots, shown with one decimal (e.g. "Best 7.7"), otherwise its highest single score, a whole number. A recipe row's score block on the bean detail page shows that recipe's highest single score ("8 best"). "Best first" orders the recipes as D-66 ranks them: recipes with at least 3 rated shots by average, then the others by their highest score, ties by more rated shots, then most recently brewed; recipes without a rated shot come last. Refines D-37 and D-42.
  - *Why:* the bean's number agrees with its best recipe, the one a re-buy starts from (D-73); a row's number says how good that recipe has been at its best.
- **D-136 — The Beans overview scrolls as one list.** Below the header, the open bean cards and the finished rows scroll together as one list; the header and the tab bar stay in place. While everything fits, nothing moves. Revises D-37, where only the finished list scrolled.
  - *Why:* with many open bags the cards would otherwise push the finished list off the screen.
- **D-137 — The order of beans.** On the Beans overview, open beans are listed by when they were added, newest first, as in the shot form's bean list; finished beans by when they were finished, most recent first. Refines D-37.
  - *Why:* the bag you just bought is the one you are dialing in; the bag you just finished is the one you look back on.
- **D-138 — Picking the roast date.** Tapping Roast date on the Add bean form opens the device's own date picker, on phones, tablets and computers alike; dates after today cannot be picked. A new form shows "Not set" until a date is picked, and saving without one says that the roast date is required. Once picked, the field shows the date and how long ago it was ("14 Oct", "2 days ago"). Refines D-41.
  - *Why:* the app runs mostly on phones and tablets, and each has a date picker its owner already knows; starting empty means today's date is never saved by accident.
- **D-139 — A re-buy shows which bean it repeats.** After a bean is picked in "Same as before", the dashed card reads "Same as Guji Hambela" with a small × that undoes the choice. Every field is filled from that bean except roast date and bag weight, and all stay editable. Refines D-41 and D-126.
  - *Why:* you see what the new bag is linked to and can change your mind.
- **D-140 — After adding a bean, its page opens.** *(Revised 2026-10-25: see D-195.)* "Add bean" saves the bean and opens its detail page (D-42). Adding a bean does not change the bean Home and "+" start from (D-32); a shot does. Refines D-41.
  - *Why:* the new bag's page is where you check what was saved and, after a re-buy, which recipe it starts from.
- **D-141 — Small details of the Add bean form.** *(Revised 2026-10-18: see D-142.)* The re-buy card's second line reads "Only roast date and bag weight are new" (D-139). Process and Roast level are optional: tapping the chosen chip or level again clears it. Refines D-41 and D-139.
  - *Why:* the line says exactly what the copy leaves out; a wrong tap on an optional choice can be undone without picking something else.
- **D-142 — Typing numbers, and what counts as the same bean.** Numbers on the Add bean form are written the international way: a point for decimals and, optionally, commas between groups of three digits ("250.5 g", "1,000 g", "1,900–2,100 m"); anything else, such as "250,5", says how to write it. The unpicked "Same as before" card keeps its drawn line, "Re-buy a past bean · only roast date is new". For "Same as before", bags count as the same bean when their names and roasters match, ignoring upper and lower case and spaces at either end. Refines D-41, D-126 and D-141.
  - *Why:* one way of writing numbers avoids reading "1,000" as one gram; small typing differences should not split a coffee into two rows.
- **D-143 — The yield in a recipe row.** On the bean detail page, a recipe's first line ends with the yield of its latest shot: "Grind 1.6 · 18.0 g → 36.0 g". A recipe without a shot, or whose latest shot has no yield, shows "Grind 1.6 · 18.0 g". Refines D-42 and D-128.
  - *Why:* yield is a result, not part of the recipe (D-13); the latest shot is the one Brew next starts from (D-43).
- **D-144 — A recipe row names the temperature only when it differs.** On the bean detail page, the setup line of a recipe row leaves out the temperature when all of the bean's recipes share it, as BeanDetail.png draws it; when they do not, every row names its temperature. Revises D-128, which used the bean card's line as it is.
  - *Why:* rows stay short as drawn, and a recipe brewed at another temperature still says so.
- **D-145 — A bean without shots can be deleted.** *(Refined 2026-10-27: see D-241, the confirmation is a dialog.)* The Edit bean form ends with a quiet "Delete bean" below "Save changes", only while the bean has no shots (for a bag added by mistake); a sheet asks "Delete this bean?" with "Delete bean" / "Keep it", as for a shot (D-116). Deleting removes the bean and any recipe kept only by its Brew next mark, then opens the Beans overview. A bean with shots is finished, never deleted, so its history stays. Refines D-40 and D-130.
  - *Why:* a mistaken bag should not stay in the list, but shot history is never lost (D-60, data-model §1).
- **D-147 — Adding gear.** *(Revised 2026-10-18: see D-158.)* "Add gear" on the Gear page opens a small sheet: Machine, Grinder, Basket. Picking one opens that kind's detail page empty, titled "Add machine" (or grinder, basket), with "Add machine" as its button. Refines D-38.
  - *Why:* one button in the header as drawn, and each kind keeps its own page.
- **D-148 — Archiving gear.** *(Revised 2026-10-23: see D-188.)* A gear page ends with a quiet "Archive" button (D-145's pattern) and a confirmation. Archived gear leaves the Gear list and every picker; past shots keep showing its name. An item My setup uses offers no Archive and says "Used in My setup · choose another default first" (D-83). There is no list of archived gear yet. Refines D-38 and D-83.
  - *Why:* gear that shots point to is archived, never deleted (data-model §1), and a quiet button keeps it out of the way.
- **D-149 — The default is chosen in My setup only.** The "Default" chip shows what My setup uses; it is changed in Edit My setup's pickers, not on the gear pages. Refines D-38.
  - *Why:* one place decides what new beans start from.
- **D-150 — A basket has a brand and a size instead of a name.** The basket page has Brand (text, e.g. "VST") and Size (grams, e.g. 18) side by side where Name was drawn; everywhere a basket is shown as "VST · 18 g". Existing baskets are split once ("VST 18 g" becomes VST and 18). Revises D-49.
  - *Why:* the design names baskets "VST · 18 g" on the My setup card; separate fields keep it consistent.
- **D-151 — Custom features can be renamed, switched off, and deleted while unused.** *(Revised 2026-10-18: see D-160, D-162.)* A custom feature can always be renamed and switched off. It can be deleted only while no shot has used it. Refines D-46.
  - *Why:* old shots keep their meaning; a feature added by mistake can go.
- **D-152 — Options for "Pick from a list".** In Add your own feature, "Pick from a list" shows one text row per option where Step and Range sit for numbers, with "+ Add option" below and a × on each row; at least two options. Refines D-46.
  - *Why:* each option gets a field, so commas in labels are no problem.
- **D-153 — Switching machine or grinder for one shot.** Tapping the gear line on the shot form's bean card ("Lelit Bianca · Timemore 064S") opens a sheet with Machine and Grinder lists; picking one changes it for this shot, and the setup features and the grind control follow. Refines D-94.
  - *Why:* the same pattern as switching the bean, where the gear is already named.
- **D-154 — The dose hint.** When the dose is outside the basket's dose range, a muted line under the core values says so: "VST · 18 g holds 17.0–19.0 g". It is shown only while the dose is outside and never blocks saving. Refines D-49.
  - *Why:* a gentle nudge, as D-49 asks, in plain words.
- **D-155 — No basket, no puck prep.** The basket picker on More › Setup starts with "No basket". The puck prep picker starts with "No puck prep", with a note under it: "Shots are easier to repeat with a puck prep routine. Add one in Library › Puck prep." A shot without them is its own recipe. Refines D-22 and D-25.
  - *Why:* a basket or routine can be left out for one shot; a routine is encouraged, not forced.
- **D-156 — The Library landing page arrives with Gear.** The Library tab opens the Library page (D-50) again. The Beans and Gear rows work with live summaries; Puck prep and Tags show their summaries dimmed and do nothing until M7. Revises D-124.
  - *Why:* with two sections working, the landing page is worth its tap.
- **D-157 — A step-by-step start after sign-up.** After creating the account, the app walks through Machine → Grinder → Basket (can be skipped) → My setup → first bean, each on its normal page with "Step 2 of 5" under the title and "Next" as its button. Puck prep is left out until M7. Leaving halfway is fine: the next time "+" is tapped, it resumes at the first missing step. Refines D-88.
  - *Why:* a new installation has nothing to brew with (D-88); the guide gets a new user to a first shot.
- **D-158 — What new gear starts with.** Add machine starts as Semi-auto with Temperature and Flat pressure switched on, the phases off, and a 58 mm group. Add grinder starts as Electric, Flat burrs, a Stepless dial with steps of 0.1, finest 0 and coarsest 10. Add basket starts as Precision, Double, 58 mm, without a dose range. The name (or the basket's brand) starts empty; everything can be changed before saving. Refines D-147.
  - *Why:* the most common home setups, so most new gear needs only a name and a few taps.
- **D-159 — The grinder's step interval is typed.** On the grinder page, "How the dial works" has three typed fields: **Step interval**, **Finest** and **Coarsest** (for example 0.25, 0.0 and 50.0). The step interval is how far − or + moves the grind on the shot form; any positive number is accepted, there is no fixed list of steps. Refines D-48.
  - *Why:* grinders differ widely; a typed step and range cover the most equipment and let the user choose the resolution.
- **D-160 — A feature counts as used once a recipe holds it.** A custom feature is "used" (D-151) as soon as any recipe has it in its setup, switched on or off. A recipe records every feature the machine has switched on, so a feature that was on the machine during any shot can no longer be deleted. Refines D-151.
  - *Why:* deleting it would make later shots stop matching the recipes they repeat (D-16), even where it was switched off.
- **D-161 — Your own features have a default in My setup.** Edit My setup shows a row for each switched-on custom feature of the chosen machine, the same row as on More › Setup, so a new bean can start with it on and at a value. Refines D-45.
  - *Why:* a feature you use on every shot should not have to be switched on again for each new bean.
- **D-162 — A used feature keeps its unit.** Once a custom feature is used (D-160), its unit can no longer be changed; its name, its switch, its step, its range and new list options still can. Refines D-151.
  - *Why:* the unit is what the stored numbers mean; the step and range only change how you tap.
- **D-38 — Gear page: "My setup" card on top, gear list below.** *(Revised 2026-10-18: see D-78, D-83, D-147, D-148, D-149.)*
  - **My setup** (a light cream card so it stands out): default machine, grinder, basket and puck prep routine, plus **default values** (dose, yield, grind, temperature, pressure profile). One "Edit" button.
  - Defaults are the **starting point for a bean's first shot** (and when switching gear). After that, D-03 applies: new shots copy the last shot.
  - **Gear list** grouped by type (Machines, Grinders, Baskets, later Other). Each row shows a short capability summary (e.g. "Semi-auto · Preinfusion, low bar start, low bar end"; "Stepless · steps of 0.1"); the default item carries a "Default" chip. Tapping a row opens the item, where its capability profile (D-02) and step sizes (D-07) are set.
  - "Add gear" sits in the header.
  - *Why:* one place answers "what do I brew with and what do new shots start from"; per-item details stay one tap away for tinkering.
- **D-44 — Gear detail (machine): capabilities are set by hand.** *(Revised 2026-10-17: see D-79; 2026-10-23: see D-184.)* Opens from a row on the Gear page. Name, **type** (Automatic, Semi-auto, Lever, Manual) and a **"What it can do"** list of switches — for the Lelit Bianca: Temperature (°C, steps of 1), Flat pressure (bar, steps of 0.5), Preinfusion (s), Low bar start (s at bar), Low bar end (s at bar) — plus **"Add your own feature"** for anything unusual, and group size. Switched-on features are exactly what the shot form shows (D-02). Full-width Save.
  - No built-in model catalog: the user sets everything. Type only labels the machine; it does not switch features on or off.
  - Grinders get the same pattern (dial type: stepped/stepless, step size, range) — to be drawn.
  - *Why:* a hand-set profile works for any machine, including modified or rare ones, and keeps the app free of a catalog to maintain.
- **D-48 — Gear detail (grinder).** *(Revised 2026-10-18: see D-79, D-159.)* Same pattern as the machine page (D-44), set by hand. Name; **type** (Electric / Hand) and **burrs** (Flat / Conical) side by side; **burr size** (mm). Then **"How the dial works"**, which drives the grind control on the shot form:
  - **Dial:** Stepped (clicks or numbers) or Stepless (any point on the dial).
  - **Step per tap:** how much − or + moves the grind (0.1 for the Timemore 064S).
  - **Finest** and **Coarsest** dial values (0.0 and 16.0 for the 064S).
  - A **Preview** of the shot form's Grind card, framed like the custom-feature preview (D-46), with the step on its buttons ("− 0.1", "+ 0.1") and the range beside it.
  - *Why:* the dial is the one grinder detail that changes how you log every shot; burr info is nerd context for Insights (e.g. comparing grinders) at no cost on the shot form.
- **D-49 — Gear detail (basket).** *(Revised 2026-10-18: see D-79, D-150, D-154.)* Same pattern as machine and grinder. Name; **type** (Precision, Standard, Pressurized); **shot size** (Single, Double, Triple); **diameter** (mm) with a fit check against your machines ("Fits Lelit Bianca"); optional **dose range** (from–to, e.g. 17.0–19.0 g). When a dose on the shot form falls outside the range, the form shows a gentle hint — never a block.
  - *Why:* basket choice changes extraction and is part of the recipe (D-13); the dose range turns the basket's spec into a useful nudge without extra input per shot.
- **D-79 — Gear sizes can have decimals.** Group size, burr size and basket diameter accept decimals (e.g. 58.5 mm), stored like every other decimal number. Refines D-44, D-48 and D-49.
  - *Why:* real gear comes in sizes such as 58.5 mm and 63.5 mm; rounding them would make the fit check and grinder comparisons wrong.
- **D-83 — Gear and routines that My setup uses cannot be archived.** *(Revised 2026-10-18: see D-148.)* Archiving is not offered for the default machine, grinder, basket or puck prep routine; the item says "Used in My setup · choose another default first". Refines D-38.
  - *Why:* a new shot can always fall back to My setup (D-75), so My setup must only point to items you can pick.
- **D-46 — "Add your own feature".** *(Revised 2026-10-18: see D-151, D-152.)* From the machine detail page (D-44), a bottom sheet lets the user define any capability of that machine the app doesn't know (e.g. a bloom pause, a paddle position). Fields:
  - **Name.**
  - **Kind of value:** Number with unit, Seconds, On / off, Pick from a list. The fields below adapt (unit for numbers, options for lists).
  - **Step** and optional **Range**.
  - **Preview**: the exact row as it will appear on the shot form under **More › Setup** (switch, name, −/+ value), framed and labelled so it reads as a preview, then **Add feature**.
  - A machine feature is always something you **set before the shot**, so it is part of the **recipe** (D-13): changing it starts a new recipe and is highlighted like any other change (D-15). Stored on every shot and available to Insights.
  - *Why:* lets any machine fit without the app knowing about it in advance, while keeping the recipe-vs-result model intact.
- **D-47 — Measuring gear is out of scope for now.** Scales, refractometers and similar tools are **gear of their own**, not features of a machine (a Bianca has no scale). How they fit — what they measure (yield, time, TDS), and whether those become result fields — is parked as an open topic. Until then, custom features are machine features only.
- **D-45 — Edit My setup: full-screen form.** *(Revised 2026-10-18: see D-161.)* Opens from "Edit" on the My setup card. Same pattern as Add bean (D-41): close (X), title with "Starting point for new beans", one Save at the bottom, fits the screen (D-36).
  - **Gear:** four pickers in a 2×2 grid — machine, grinder, basket, puck prep routine.
  - **Default values:** dose, yield, grind, temperature as −/+ cards (same controls as the shot form), with the calculated ratio below.
  - **Pressure profile:** one summary row that opens the same phase editor as the More sheet (D-24).
  - Which default fields appear follows the chosen machine's switched-on features (D-44) and the grinder's step size (D-07).
  - *Why:* one familiar form for "what new beans start from"; reusing the shot form's controls means nothing new to learn.
- **D-26 — Puck prep routines as flowcharts.** A Puck prep overview where the user creates **steps** (individual prep methods, e.g. WDT, distributor, tamp, puck screen, RDT, or anything custom) and links them into one or more **routines** shown as flowcharts. The shot form references a routine (D-25).
  - *Why:* covers any prep style, however unusual, without a fixed list; coffee nerds will enjoy building and seeing the flow.
- **D-51 — Puck prep: overview and routine builder.** *(Revised 2026-10-19: see D-76, D-163 to D-167; 2026-10-23: see D-187.)* Refines D-26.
  - **Routines are a straight line**, top to bottom — no branches. Reorder by dragging, insert between any two steps.
  - **Steps can carry optional settings** (e.g. WDT 20 s, Tamp 15 kg, RDT 2 sprays). The values are recorded with each shot, so Insights can compare them.
  - **Overview** (Library › Puck prep): "New routine" in the header. **Routines** as cards: name, "In use" chip on the routine My setup / the last shot uses, the steps as a mini flow (WDT → Distributor → Tamp → Puck screen), and "23 shots · average score 7.4" — so routines can be compared at a glance. Below, **Your steps**: the step library as chips with their setting unit ("WDT · seconds"), plus a dashed "New step".
  - **Routine builder** (full-screen, Save at the bottom): name, then a vertical flowchart between two caps, **"Dose in basket"** and **"Lock in and brew"**. Each step is a row with a drag handle, its name, its setting as a tappable amber value (or "No settings"), and remove. Between steps, a line with a small **+** to insert a step there.
  - Changing the routine on a shot, or a step's setting, is a **recipe change** (D-13).
  - *Why:* a straight line matches how puck prep is actually done and fits a phone; the start/end caps make it read as a flow, not a list; per-step settings and per-routine averages turn prep into something you can learn from.
- **D-52 — New step.** *(Revised 2026-10-19: see D-168, D-169; 2026-10-23: see D-185.)* "New step" on the Puck prep overview opens a bottom sheet (same pattern as "Add your own feature", D-46): **Name**; **Setting** — No setting, Number with unit, Seconds, Pick from a list; then the fields that kind needs — **Unit** and **Step**, **Starts at** (the value it gets when added to a routine) and optional **Range**; a framed **Preview** of the step's row in the routine builder; **Add step**.
  - Routine cards keep a simple **average score across all shots** for now; fair comparisons (same bean, same recipe otherwise) belong in Insights.
  - *Why:* one consistent way to define anything custom — machine features and prep steps look and work alike.
- **D-29 — Tags (flavor notes) get a home.** A place to see, rename, merge and remove flavor tags, including custom ones added from the Tasting tab.
  - *Why:* custom tags will drift (typos, duplicates); a home keeps them clean enough for Insights.
- **D-53 — Tags page.** *(Revised 2026-10-19: see D-171 to D-174, D-180, D-182.)* Library › Tags. "Add tag" in the header, a search field, then tags as chips **grouped by flavor family** (Fruity, Sweet, Floral, Nutty & roasty, Other), each with its **usage count** ("Berry 12"); user-added tags carry a small "custom" label. **Families are fixed** (a built-in set plus "Other"); users choose a family for custom tags but cannot create or rename families. Tapping a tag opens rename / merge / remove.
  - **Duplicate finder:** when two tags look alike (e.g. "Dark choclate" and "Dark chocolate"), a cream card at the top suggests merging them, with a one-tap **Merge** into the more-used tag. Merging updates every shot that used the old tag.
  - *Why:* families make 18+ tags scannable and mirror how tasters think; counts show what you actually taste; the duplicate finder keeps Insights clean without asking the user to audit their tags. Fixed families let Insights say things like "you prefer fruity coffees" reliably.
- **D-163 — "In use" on both routines.** *(Revised 2026-10-19: see D-177.)* On the Puck prep page, the routine My setup uses and the routine the last shot used both carry "In use"; usually they are the same one. Refines D-51.
  - *Why:* both are routines you would not want to change or archive by surprise.
- **D-164 — Inserting a step picks from your steps.** The small + between two steps in the routine builder opens a sheet with your steps; the same step may appear more than once in a routine. "New step" at the bottom of the sheet makes one on the spot. Refines D-51.
  - *Why:* building a routine should not need a detour to the Puck prep page.
- **D-165 — Setting a step's value in the builder.** Tapping a step's amber value ("20 s", "15 kg") opens a small sheet: −/+ with the step's step and range, and tap to type, for numbers and seconds; the options for a list. This is the routine's own value for the step. Refines D-51.
  - *Why:* the same controls as everywhere else, without crowding the flow.
- **D-166 — A step's value can change for one shot.** *(Revised 2026-10-19: see D-178.)* On the shot form, tapping the puck prep row in More › Setup shows the routine's steps with their values, which can be changed for this shot. A change is a recipe change (D-51) and turns sage like any other change (D-90). Refines D-25 and D-76.
  - *Why:* trying WDT 30 s instead of 20 s should not need a new routine.
- **D-167 — Changing and removing routines.** *(Revised 2026-10-23: see D-188.)* Tapping a routine card opens it in the routine builder. A quiet "Archive" at the bottom, with a confirmation, archives it: it leaves the Puck prep page and the pickers, past shots keep its name. It is not offered for My setup's routine (D-83). A routine no shot has used can be deleted for good instead. Refines D-51 and D-148.
  - *Why:* the same pattern as gear, while a routine made by mistake can go without leaving a trace.
- **D-168 — Changing and removing steps.** *(Revised 2026-10-19: see D-175, D-176.)* Tapping a step chip on the Puck prep page opens the step sheet (D-52). Its name, step, range and starting value can always change. Once a shot has used it, its kind of setting, its unit and its list options stay, and it is archived instead of deleted; a step no shot has used can be deleted. Refines D-52, as D-160 to D-162 do for machine features.
  - *Why:* one rule for everything custom; the values shots recorded keep their meaning.
- **D-169 — A step in a routine stays.** A step that a routine (not archived) contains cannot be archived or deleted; its sheet says "Used in Daily routine" instead. Refines D-168.
  - *Why:* a routine should never lose a step behind your back.
- **D-170 — Recipe labels name a differing step value.** When two recipes in the Journal's recipe filter differ only in a step value, the label names it ("WDT 30 s"). Refines D-121.
  - *Why:* step values are now set per routine and per shot (D-165, D-166), so recipes can differ only there.
- **D-171 — Removing a flavor note.** *(Revised 2026-10-19: see D-181, D-182; 2026-10-23: see D-188.)* "Remove" on a note that shots have used archives it: it leaves the Tasting chips and the Tags page, and past shots still show it. A note no shot has used is deleted. Refines D-53.
  - *Why:* what shots point to is kept, as everywhere else in the app.
- **D-172 — Built-in notes can change too.** Built-in notes can be renamed, merged and removed like your own; only your own notes can change family. Refines D-53.
  - *Why:* the vocabulary is yours to tidy; fixed families keep Insights reliable.
- **D-173 — When two notes look alike.** *(Revised 2026-10-19: see D-179.)* The "Same tag twice?" card appears for two notes with the same name ignoring case, spaces and accents, or with one or two letters different when the names are five letters or longer. Besides "Merge", the card has a quiet "Keep both", remembered for that pair. Refines D-53.
  - *Why:* catches typos without nagging about notes that are meant to be different.
- **D-174 — Adding a note on the Tags page.** "Add tag" opens a sheet with Name and the five families as choices (Other chosen to start), then "Add tag". Refines D-53.
  - *Why:* on the Tags page you have time to place the note; the Tasting tab keeps its quick way (D-101).
- **D-175 — A step change that breaks a routine is refused.** Saving a step is refused when a routine (not archived) that holds it would no longer fit: a value outside the new range, a changed kind of setting, or a removed list option it uses. The sheet names the routine: "Daily routine uses 15 kg, outside this range". You change the routine first or choose a wider range. Refines D-168 and D-169.
  - *Why:* a routine whose values no longer fit would make every shot with it fail to save.
- **D-176 — An unused step is deleted, also from archived routines.** "Delete step" on a step no shot used deletes it and takes it out of any archived routine that still holds it. Refines D-168.
  - *Why:* archived routines are out of sight; an unused step should leave no trace.
- **D-177 — Two "In use" chips are both cream.** When My setup's routine and the last shot's routine differ, both carry the same cream "In use" chip. Refines D-163 and the one-cream rule of the visual direction.
  - *Why:* it is one meaning shown twice, and the two usually coincide.
- **D-178 — A step value outside its range is brought into range.** When a shot copies a step value that no longer fits its step (its range was narrowed or its option removed since, D-168), the new shot starts at the nearest end of the range, or the routine's own value for a list, shown in sage as a change. Editing an earlier shot keeps the values it was brewed with. Refines D-76 and D-166.
  - *Why:* the next shot can always be saved, and history is never rewritten.
- **D-179 — Look-alike notes start with the same letter.** The "one or two letters different" rule of D-173 applies only when both names start with the same letter (ignoring case and accents). Names that are the same ignoring case, spaces and accents still always count. Refines D-173.
  - *Why:* typos rarely hit the first letter, while real notes like Honey and Winey, Berry and Cherry, Toasted and Roasted would otherwise be flagged; Honey and Winey are both built in.
- **D-180 — Merging from the card asks first.** "Merge" on the "Same tag twice?" card opens the same confirmation as merging from the tag sheet ("Merge into Dark chocolate?", "This cannot be undone."). Refines D-53.
  - *Why:* a merge cannot be undone, and every other action that cannot be undone asks first.
- **D-181 — A removed note comes back when you type it.** Typing a removed note's name, in "Add your own" on the Tasting tab or in "Add tag", brings that note back to the chips and the Tags page, with its past shots counted. Refines D-101 and D-171.
  - *Why:* it is the same note; a second one with the same name would split its shots.
- **D-182 — A shot keeps working when its notes were merged or deleted meanwhile.** When a shot is saved with a note that was merged since the form opened (or while it waited offline), it gets the note it was merged into; a note deleted since is left off. The shot saves. Refines D-53 and D-171.
  - *Why:* a shot is never lost over a tidied tag list, also when it was brewed offline.
- **D-184 — Low bar start and low bar end are no longer built in.** A machine's "What it can do" list keeps Temperature, Flat pressure and Preinfusion built in; Low bar start and Low bar end leave it, also for new machines. A machine that has either switched on keeps it as it is, with its seconds and pressure, so past shots and recipes do not change. Once switched off and saved, it leaves the machine and cannot be switched on again there. Anyone else adds such a phase with "Add your own feature", as Seconds (without a pressure). Revises D-24 and D-44.
  - *Why:* few machines have these phases; as built-ins they showed on every new machine and could not be removed.
- **D-185 — Range fields open the number keypad.** The Range field on New step and on Add your own feature opens the phone's number keypad, like Step and Starts at, not the full keyboard. Refines D-46 and D-52.
  - *Why:* a range is two numbers; the full keyboard is a detour.
- **D-187 — A new routine asks to be used.** Saving a new routine in the routine builder asks "Use it for new shots?". Yes makes it My setup's routine, so the next shot starts with it, also on a bean with shots or a re-buy; a recipe marked Brew next keeps its own routine (confirmed 2026-10-23). No saves it as it is. Refines D-51 and D-38.
  - *Why:* a routine made and then forgotten on the shot form records nothing; puck prep matters for repeating a shot.
- **D-188 — Archived items have a list and can come back.** Gear, Puck prep and Tags each end with a quiet "Archived" row that opens a list of what was archived there (gear; routines and steps; flavor notes). Each item can be restored, which puts it back in its list and pickers. A restored routine brings back the archived steps it holds. When a routine no longer fits its steps (a range narrowed or a step deleted while it was archived), it is restored with its values brought into range and opens in the routine builder to check and save (confirmed 2026-10-23). Revises D-148, D-167 and D-171.
  - *Why:* archived things vanished without a trace; a way back makes archiving safe to use.

## 11. Visual direction

- **D-18 — Coffee-toned, surface-based dark UI.** *(Refined 2026-10-27: see D-241, bottom sheets get a thin outline.)* Dark roast background with slightly lighter mocha cards; separation comes from surfaces, not borders or dividers. Soft rounded corners, generous spacing, a friendly geometric sans (Figtree) with tabular numbers. One full-width primary action per task screen.
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
  - *(Refined 2026-10-27: see D-241, a muted red for the button that deletes.)*

- **D-241 — A confirmation is a dialog in the middle of the screen, and deleting looks different from keeping.** A confirmation (D-116, D-145) is no longer a bottom sheet: it opens as a dialog in the middle of the screen, over all of it, with a thin outline in the line color; tapping the dimmed screen closes it, as for a sheet. In it, the button that deletes, removes or archives ("Delete shot", "Delete bean", "Remove tag", "Archive", "Sign out and delete") is a new muted red, used for nothing else; the button that keeps things as they are ("Keep it", "Stay signed in") is the amber primary button. The dialog covers the whole screen, the form's own Save and Delete buttons included, so only its two choices show. Every bottom sheet also gets the thin outline, so its edge is clear against the dimmed screen. The tag sheet's "Remove this tag?" step stays inside the tag sheet, with the same red and amber buttons. Refines D-18, D-19, D-21, D-116 and D-145.
  - *Why:* the owner found "Delete shot" and "Keep it" too alike, with the amber Delete looking like the expected choice and the page's own Save showing under the sheet; an important question belongs in the middle of the screen; red is the color people already read as "this deletes something".

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
- **D-88 — A new installation starts with the built-in flavor tags only.** *(Revised 2026-10-18: see D-105, D-157.)* Creating the account adds the built-in tags; gear, puck prep, My setup and beans are added in Library. The reference setup (Lelit Bianca, Timemore 064S, VST 18 g, Daily routine) is a seed for development, tests and screenshots, not part of a real installation.
  - *Why:* every home barista's gear is different; example gear would have to be removed before use.
- **D-105 — Until M11 the published image can seed the reference setup.** The image published from `main` carries a command that fills an empty installation with the reference setup, so the app can be tried on a server before gear and My setup can be added in the app (roadmap M6). It only works before an account exists. It is removed from the image when the real install guide lands (roadmap M11). Refines D-88.
  - *Why:* trying the app at the brew station early is the point of building the core loop first (D-70); without gear a server install could not log a shot.
- **D-61 — Offline: the app opens offline, and shots wait to sync.** *(Revised 2026-10-26: see D-235, D-237 to D-239.)* A service worker caches the app and the data needed to brew (open beans, their recipes, gear, routines, tags, My setup), so the app opens and the shot form prefills without a connection. A shot saved offline (new or edited) goes into a **queue on the device** and is sent when the connection returns; the server accepts each queued shot exactly once. Library changes need a connection. *(Revised 2026-10-16: saving offline was first out of scope; 2026-10-26: see D-218 to D-229.)*
  - *Why:* a shot should never be lost because the Wi-Fi dropped at the brew station; limiting the queue to shots keeps the sync logic small.
- **D-217 — The app icon is the logo.** *(Revised 2026-10-26: see D-230.)* The home-screen icon is the bean-with-glasses mark itself (D-34), drawn from its vector file so it is sharp at every size. Where the phone needs a full square (Android's adaptive icon), the mark sits inside the safe area on the app's own background. Refining the logo stays open (open topic 17) and reaches the icon through a design-system sync (D-58).
  - *Why:* the owner wants the logo in high quality, not a new mark; the vector file gives that at every size.
- **D-218 — Installing the app and offline need https.** Installing the app and working offline (D-61) only work when the app is opened over https (or on localhost). Opened over plain http the app keeps working online as before, without an error. The install guide (M11) asks for https. Settles the plain-http open item.
  - *Why:* browsers allow the service worker and installing only on secure connections; the owner already reaches the server over https.
- **D-219 — What opens offline.** *(Revised 2026-10-26: see D-235, D-236.)* Home, the shot form and the Journal always open offline. Any other page already visited opens from what the phone kept, read only, with an "Offline" line at the top. Changes other than shots (Library, Settings) say they need a connection and change nothing. The wording is approved by screenshot in the pull request that builds it. Refines D-61.
  - *Why:* the brew station needs Home, the shot form and the Journal; read-only pages are better than a blank screen, and keeping changes to shots keeps the sync logic small (D-61).
- **D-220 — A shot saved offline keeps the time it was brewed.** A shot saved without a connection gets the time on the phone when Save was pressed, not the time it reaches the server. An edit or a score given offline keeps the shot's brew time. Refines D-61.
  - *Why:* the Journal, the weekly counts and Insights are about when the shot was brewed.
- **D-221 — How a waiting shot looks.** A shot that is still waiting to send shows a muted "Waiting to send" line with an icon on its Journal row and on Home's Last shot card. It is built from design-system parts and approved by screenshot in the pull request that builds it; the canvas can design it later. Settles open topic 23.
  - *Why:* waiting for a canvas design would hold up M10, as with Home and Insights (D-198, D-207).
- **D-222 — The next shot starts from a waiting shot.** A shot waiting to send is the last shot brewed, so the next shot starts from it (D-03) and the recipe tag judges it against it. Refines D-03 and D-61.
  - *Why:* dialling in offline must work like dialling in online: each shot builds on the one before.
- **D-223 — Rating offline waits like an edit.** *(Revised 2026-10-26: see D-239.)* A score given offline on the Rate sheet waits on the phone and is sent like an edited shot. Refines D-61 and D-111.
  - *Why:* rating right after the shot is the habit the app builds (D-54, D-111); it should not need a connection.
- **D-224 — A queued shot the server refuses is kept.** *(Revised 2026-10-26: see D-237, D-238.)* When the server refuses a shot that waited on the phone, the shot stays on the phone, marked "Not saved" in the Journal. Tapping it opens the shot form with its values, to fix and save it again, or to delete it. Refines D-61.
  - *Why:* a shot is never lost (D-61, D-182), and the owner decides what happens to it.
- **D-225 — Signing out clears the phone.** Signing out removes everything the app kept on the phone: the cached pages and data, the draft and any waiting shots. When shots are still waiting, signing out asks first (for example "1 shot is still waiting to send"); the wording is approved by screenshot in the pull request that builds it. Refines D-61.
  - *Why:* the app is self-hosted and private; a signed-out phone keeps nothing, and a waiting shot is never deleted without asking.
- **D-226 — The shot form keeps a draft.** A new or edited shot is kept on the phone while it is being entered, so a reload or closing the app never loses input; opening the form again restores it. Save and Back end the draft. Switching the bean (D-94) or "Use last shot recipe" (D-43) still starts the form again, as now. Refines D-61.
  - *Why:* the Wi-Fi or the phone should never cost a shot; switching bean is a deliberate fresh start.
- **D-227 — A new version never interrupts a shot.** *(Revised 2026-10-26: see D-229.)* When a new version of the app is installed on the server, the phone takes it the next time the app opens, never while a form is open. Shots waiting from the old version are still sent.
  - *Why:* updating mid-shot could lose input; waiting shots must survive an update.
- **D-228 — The installed app opens standalone.** Installed on a phone, the app opens without the browser's address bar, and the phone's status bar (clock, battery) stays visible. The app icon as built from the logo is approved (D-217).
  - *Why:* the usual choice for an installed app; the clock stays in view at the brew station.
- **D-229 — An update takes over once the app is closed.** *(Revised 2026-10-26: see D-236.)* A new version takes over when every window of the app is closed (D-227). On Android an app left open among the recent apps keeps the old version until it is swiped away. Refines D-227.
  - *Why:* the safe way to never interrupt a shot; a few hours on the old version harms nothing.
- **D-230 — The plain app icon is cropped to the bean.** A launcher that sets the icon on its own disc (as on the owner's Pixel) shrinks it, so the plain icons are cropped to the bean, which fills most of their height. The adaptive icon keeps the bean inside Android's safe circle. Refines D-217.
  - *Why:* the owner found the installed icon a little small.
- **D-231 — A waiting shot can be changed or deleted on the phone.** *(Revised 2026-10-26: see D-238.)* Tapping a shot that is still waiting to send, in the Journal or on Home's Last shot card, opens the shot form with its values. Saving keeps it waiting with the change, and its brew time stays (D-220); deleting removes it from the phone. This works the same way as for a "Not saved" shot (D-224). Refines D-221.
  - *Why:* the shot is not on the server yet, so its page cannot open offline. The form is where the shot can be changed, as with a refused shot.
- **D-232 — Saving offline looks like saving online.** Save without a connection returns to where "+" was pressed and shows the usual "Shot saved" bar (D-95, D-200). The shot then shows "Waiting to send" (D-221). Refines D-61.
  - *Why:* the shot is safe on the phone. Saving is the same habit with or without a connection.
- **D-233 — Home counts a waiting shot once it is sent.** Only Home's Last shot card shows a waiting shot at once (D-221, D-222). This week, the grams left and the best recipe include it once it reaches the server. Refines D-32 and D-221.
  - *Why:* those numbers come from the server; the Last shot card is what the next shot builds on.
- **D-234 — Settings shows the version.** At the bottom of Settings, a line names the version of the app on the phone by when it was built ("Version of 26 October 2026, 13:19"). Refines D-199.
  - *Why:* the owner asked for it, to tell whether the phone has taken the newest version (D-229).
- **D-235 — A slow connection counts as offline after 4 seconds.** When the server has not answered within 4 seconds, a page the phone has kept opens from its copy, and a shot, an edit or a score being saved waits on the phone (D-61), as when there is no connection at all. The "Offline" line shows (D-219). Other changes (Library, Settings) keep waiting for the server, since a slow server may still make them. Refines D-61 and D-219.
  - *Why:* weak Wi-Fi at the brew station, or the server restarting after an update, should not leave the app spinning; the kept copy and the waiting shot are already safe.
- **D-236 — Offline copies stay current while an update waits.** While a new version waits for the app to be closed (D-229), the version on the phone keeps taking fresh copies of Home, the Journal and the shot forms from the newer server. Going offline then opens the latest data, never the data from the moment of the update. Refines D-219 and D-229.
  - *Why:* on Android the app can stay among the recent apps for days; a shot form prefilled from an old last shot would judge the recipe wrongly.
- **D-237 — "Not saved" says why, and one stuck shot does not hold up the others.** A shot the server refuses shows the server's reason in its form, under the "Not saved" message (D-224). A shot the server itself fails on three tries in a row, without refusing it (not a page from a proxy while the server restarts, which counts as no answer), is marked "Not saved" too ("The server could not save it"), so the shots behind it are sent. It can be saved again from its form. Refines D-224.
  - *Why:* a shot that silently waits forever, holding every later shot back, is the one way the queue could hide a problem.
- **D-238 — A waiting change can be discarded.** A waiting or "Not saved" change to a shot already on the server (an edit or a score) can be discarded from its form: the form opened from the Journal for an edit, or the shot's edit page for either (D-239) offers "Discard change": the change is removed from the phone and the shot stays as the server has it. A new shot keeps "Delete" (D-231). Refines D-224 and D-231.
  - *Why:* a refused edit that the form cannot fix must not be stuck on the phone.
- **D-239 — A shot's edit page shows what waits for it.** Opening a saved shot's edit page while a change or a score for it waits on the phone shows that change, and saving online includes it. A save made while the phone is sending the same shot waits until that send is done. Refines D-223.
  - *Why:* a score given offline must never be overwritten by an edit made right after the connection returns.
- **D-62 — Claude Code writes all the code, so guardrails come first.** *(Revised 2026-10-26: see D-240.)* The owner decides behavior (this log, the design system, the running app) and does not review code. Therefore: TypeScript strict mode; automated tests on domain logic (recipe matching, prefill rules, statistics) written before the UI that uses it, each test naming the D-number it protects; linting and formatting enforced; CI must pass before anything is merged; a separate review pass by Claude Code before merge. CLAUDE.md points to this log (behavior) and the design system (visuals) as sources of truth. *(Revised 2026-10-16: was "most of the code".)*
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
- **D-69 — The GitHub repository is home; design sources are synced into it.** *(Revised 2026-10-18: see D-146; 2026-10-19: see D-183.)* The code lives in a private GitHub repository (`coffee-nerd`), to be opened as open source once mature.
  - **Documents** (this log, the data model, the roadmap) have their master copy in the repository's `docs/`. The claude.ai Project keeps a mirror that is refreshed whenever the documents change there.
  - **Visuals** keep their master in the design system and canvas artifacts (D-58). The repository holds a synced, read-only copy: `design-system/` (tokens, CSS, guidelines, logo) and `docs/screens/` (every screen as PNG and HTML at 412 × 915). A visual change is made in the artifact first, then re-exported. Claude Code's file tools are blocked from editing these folders.
  - *Why:* Claude Code works best with everything in the repository, in plain files it can read and test against; a screenshot it can compare with beats a link. One master per kind of source prevents two versions drifting apart.
- **D-146 — The design-system sync of October 2026 is made in the repository.** *(Revised 2026-10-19: see D-183.)* For the items left over from M4 and M5 (D-119, D-123, D-145), Claude updates `design-system/` in the repository directly, and the owner copies those changes back into the design-system artifact. The rule that blocked edits to `design-system/` is lifted; `docs/screens/` stays read-only. Revises D-69.
  - *Why:* the owner asked for the sync without needing to make each change by hand first.
- **D-183 — Claude designs undesigned screens on the canvas and exports them.** Screens and states that were built without a design are drawn by Claude on the UX canvas, from the design system's parts and the wording the app and decisions already use. Claude then exports each new canvas screen into `docs/screens/` itself (PNG at 2× and static HTML at 412 × 915, the same format as before) and adds it to the screens list. A screen still changes on the canvas first; the files in `docs/screens/` are only ever replaced by an export, never edited by hand. In `docs/open-items.md`, an item the canvas now designs moves to a "Designed, ready to build" table naming its canvas screens, and is deleted once the app matches them. The setting that blocked writes to `docs/screens/` is removed so exports can be written. Revises D-69 and D-146.
  - *Why:* the owner wants the states that were waiting for the canvas designed without exporting each screen by hand, while the canvas stays the one master for screens.
- **D-70 — How Claude Code builds the app.** *(Revised 2026-10-26: see D-240.)* Work follows `docs/roadmap.md`, one milestone at a time: branch, tests first for logic, `/build-screen` (screenshot compared with the reference) for screens, a fresh-context `decision-reviewer` pass, then a pull request that may only merge with green CI. `CLAUDE.md` stays short (under 200 lines) and points to the sources of truth; detail lives in path-scoped rules, skills and one reviewer subagent, following Anthropic's Claude Code best practices.
  - The build order puts the core loop first (foundation → domain logic → database → shot form → Journal) so the app can be tried at the brew station early, then the Library pages, Home, Insights and offline.
  - *Why:* the owner does not review code (D-62), so every change must prove itself: by tests, by screenshots against the design, and by an independent review that traces back to decisions.
- **D-240 — Parallel threads, and Claude merges what the owner does not need to see.** Up to three threads may work at once, each on its own area (files and screens no other open pull request touches) and each with one pull request open at a time. Milestones still go in order: the next one starts once the current one's features are built and only fixes are left. A pull request that changes only documentation (not decisions), tests, CI, or code that keeps decided behavior and looks (a bug fix, a refactor) is merged by its thread once CI is green and a fresh-context review approves it. The owner still merges every pull request that records or changes a decision, adds or changes a screen, a look or wording, changes the database, changes the guardrails (`CLAUDE.md`, `.claude/`), or needs a check on the phone. Refines D-62 and D-70.
  - *Why:* every pull request waited for the owner's merge, which made the owner the bottleneck; the ones the owner would only skim can prove themselves by tests and the independent review (D-62), while everything the owner decides or sees stays with the owner. `main` cannot be protected on this plan, so the review is the real safety net.

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
9. ~~Bean overview, Add bean, bean detail~~ (D-37, D-35, D-40, D-41, D-42; recipe detail: the filtered Journal, D-125)
10. ~~Pressure profile options~~ (D-24)
11. ~~Setup sheet: show how a changed setup value is highlighted~~ (D-90)
12. ~~Puck prep routine builder and New step~~ (D-51, D-52)
13. ~~Gear list, machine detail, Edit My setup~~ (D-38, D-44, D-45, D-48, D-49)
14. ~~Tags home~~ (D-29, D-53, D-171 to D-174, D-179 to D-182)
15. Home: design the other three graphs (Time vs. yield, Roast age, Consistency) — after Insights (M9); Home ships with Dial-in progress only (D-193)
16. ~~Journal, Insights, shot detail~~ (D-54 to D-57) — still to do: more Dial-in cards (e.g. grind vs time scatter, sour/bitter vs ratio); M9 ships Dial-in with the bell curve only (D-201)
17. Logo: refine the bean-with-glasses mark (the app icon is the logo as it is, D-217)
18. ~~Library landing page~~ (D-50)
19. ~~Origin field: free text vs. a country list~~ (D-41: country picker + free-text region)
20. Measuring gear (scales, refractometers): where it fits, what it records (results like yield, time, TDS) (D-47)
21. Grinder: "Log burr change / recalibration" — a dated marker on the grinder that also shows as a line on Home's graphs (future)
22. Households: each user builds their own Library, or a household share toggle on Library items (D-60; the data model supports both)
23. ~~Shot form when a save fails offline~~ (D-61: queued and sent when online; a waiting shot's look: D-221)
24. ~~Data model~~ (`docs/data-model.md`, D-63 to D-68)
25. ~~Repository setup and CLAUDE.md~~ (D-69, D-70; `docs/roadmap.md`)
26. Open source: license (e.g. MIT or AGPL), contributing guide and code of conduct, when the project is mature (D-69, roadmap M11)
27. Optional: `@claude` in GitHub issues and pull requests (Claude Code GitHub Action; needs the Claude GitHub app and a secret)
