<script lang="ts">
  // Shot detail (screen 26, D-57): bean and setup card, core values and ratio, taste, "Compared with this
  // recipe" (D-109, D-110), notes, and Edit (D-113).
  import { resolve } from '$app/paths';
  import { recipeTagText } from '#lib/domain/fingerprint.ts';
  import {
    clockTime,
    compareWithRecipe,
    comparisonText,
    dayLabel,
    roastAgeText
  } from '#lib/domain/journal.ts';
  import { tasteWords, type TasteScale } from '#lib/domain/taste.ts';
  import { decimalsFor, formatNumber, formatRatio, type Thousandths } from '#lib/domain/units.ts';
  import TabBar from '#lib/components/TabBar.svelte';
  import type { PageProps } from './$types';

  let { data }: PageProps = $props();

  const shot = $derived(data.shot);
  const when = $derived(
    `${dayLabel(shot.brewedAt, data.now, shot.timeZone)} ${clockTime(shot.brewedAt, shot.timeZone)}`
  );
  const ratio = $derived(formatRatio(shot.yield, shot.dose));

  const shown = (value: Thousandths, step: Thousandths, atLeast: number) =>
    formatNumber(value, Math.max(atLeast, decimalsFor(value, step)));
  const tiles = $derived([
    { label: 'Grind', value: shown(shot.grind, shot.grindStep, 0), unit: '' },
    { label: 'Dose', value: shown(shot.dose, shot.steps.dose, 1), unit: 'g' },
    {
      label: 'Yield',
      value: shot.yield === null ? null : shown(shot.yield, shot.steps.yield, 1),
      unit: 'g'
    },
    {
      label: 'Time',
      value: shot.time === null ? null : shown(shot.time, shot.steps.time, 1),
      unit: 's'
    }
  ]);

  // D-109, D-110: time and score against the recipe's other shots.
  const comparisons = $derived([
    {
      label: 'Time',
      measure: 'time' as const,
      value: shot.time === null ? null : `${shown(shot.time, shot.steps.time, 1)} s`,
      missing: 'Not set',
      result: compareWithRecipe(
        shot.time,
        shot.recipe.others.map((o) => o.time)
      ),
      average: (mean: number) => `vs μ ${formatNumber(Math.round(mean), 1)} s`
    },
    {
      label: 'Score',
      measure: 'score' as const,
      value: shot.taste.score === null ? null : String(shot.taste.score),
      missing: 'Not rated',
      result: compareWithRecipe(
        shot.taste.score,
        shot.recipe.others.map((o) => o.score)
      ),
      average: (mean: number) => `vs average ${mean.toFixed(1)}`
    }
  ]);

  // D-57: balance, body and sweetness as small scales, and aftertaste when it is set (D-115); the
  // handle sits where the value is.
  const scales: { scale: TasteScale; label: string }[] = $derived([
    { scale: 'balance', label: 'Balance' },
    { scale: 'body', label: 'Body' },
    { scale: 'sweetness', label: 'Sweetness' },
    ...(shot.taste.aftertaste === null
      ? []
      : [{ scale: 'aftertaste' as const, label: 'Aftertaste' }])
  ]);
  // D-118: "New recipe" in cherry, what changed after it in muted ink, as on the shot form.
  const [tagMain, ...tagRest] = $derived(recipeTagText(shot.recipeTag).split(' · '));
  const position = (scale: TasteScale, value: number) =>
    scale === 'balance' ? ((value + 10) / 20) * 100 : value * 10;
</script>

<header>
  <a
    class="back cn-tap"
    href={data.fromHome
      ? resolve('/')
      : data.filters
        ? resolve(`/journal?${data.filters}`)
        : resolve('/journal')}
    aria-label={data.fromHome ? 'Back to Home' : 'Back to Journal'}
  >
    <svg
      width="22"
      height="22"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      stroke-width="2"
      stroke-linecap="round"
      stroke-linejoin="round"
      aria-hidden="true"><path d="M19 12H5M11 6l-6 6 6 6"></path></svg
    >
  </a>
  <div class="title">
    <h1 class="cn-type-title">Shot</h1>
    <span class="when">{when}</span>
  </div>
  <!-- D-57, D-113: the shot form in edit mode. -->
  <a
    class="edit cn-tap"
    href={data.fromHome
      ? resolve('/journal/[id]/edit?from=home', { id: shot.id })
      : resolve('/journal/[id]/edit', { id: shot.id })}>Edit</a
  >
</header>

<main>
  <section class="cn-card setup" aria-label="Bean and setup">
    <div class="bean">
      <span class="name">{shot.beanName}</span>
      <span class="soft">{roastAgeText(shot.roastDate, shot.brewedAt, shot.timeZone)}</span>
    </div>
    <span class="soft">{shot.gear}</span>
    {#if shot.setup}<span class="soft">{shot.setup}</span>{/if}
    <span class="cn-tag" class:cn-tag--new={shot.recipeTag.kind === 'new'}
      >{tagMain}{#if tagRest.length}<span class="tag-detail">{` · ${tagRest.join(' · ')}`}</span
        >{/if}</span
    >
  </section>

  <section class="tiles" aria-label="Core values">
    {#each tiles as tile (tile.label)}
      <div class="tile">
        <span class="tile-label">{tile.label}</span>
        <span class="tile-value">
          {#if tile.value === null}
            <!-- An empty yield or time (D-91); not designed yet (docs/open-items.md). -->
            <span class="unit">Not set</span>
          {:else}
            {tile.value}{#if tile.unit}<span class="unit">{` ${tile.unit}`}</span>{/if}
          {/if}
        </span>
      </div>
    {/each}
  </section>
  {#if ratio}<div class="ratio">Ratio <span>{ratio}</span></div>{/if}

  <section class="cn-card taste" aria-label="Taste">
    <div class="score">
      {#if shot.taste.score === null}
        <!-- An unrated shot (D-11); not designed yet (docs/open-items.md). -->
        <span class="not-rated">Not rated</span>
      {:else}
        <span class="number">{shot.taste.score}</span>
        <span class="word">score</span>
      {/if}
    </div>
    <div class="scales">
      {#each scales as { scale, label } (scale)}
        {@const value = shot.taste[scale]}
        <div class="scale">
          <span>{label}</span>
          <span class="track">
            {#if value !== null}
              <span class="handle" style:left="calc({position(scale, value)}% - 6px)"></span>
            {/if}
          </span>
          <span class="soft words">{tasteWords(scale, value)}</span>
        </div>
      {/each}
      {#if shot.flavors.length}
        <ul class="flavors" aria-label="Flavor notes">
          {#each shot.flavors as flavor (flavor)}<li>{flavor}</li>{/each}
        </ul>
      {/if}
    </div>
  </section>

  <section class="cn-card compared" aria-labelledby="compared-title">
    <div class="compared-head">
      <h2 id="compared-title">Compared with this recipe</h2>
      <span class="count"
        >{shot.recipe.shotCount} {shot.recipe.shotCount === 1 ? 'shot' : 'shots'}</span
      >
    </div>
    <div class="measures">
      {#each comparisons as c (c.label)}
        {@const sentence =
          c.result.kind === 'compared' ? comparisonText(c.measure, c.result.sigmas) : null}
        <div class="measure">
          <span class="soft-13">{c.label}</span>
          {#if c.value === null}
            <span class="soft-13">{c.missing}</span>
          {:else}
            <span
              ><b>{c.value}</b>{#if c.result.kind === 'compared'}<span class="soft-13"
                  >{` ${c.average(c.result.mean)}`}</span
                >{/if}</span
            >
            {#if c.result.kind === 'not-enough'}
              <span class="verdict">Not enough shots yet</span>
            {:else if sentence}
              <span class="verdict">{sentence}</span>
            {/if}
          {/if}
        </div>
      {/each}
    </div>
  </section>

  {#if shot.notes}
    <section class="cn-card notes" aria-label="Notes">
      <span class="notes-label">Notes · just for you</span>
      <span class="notes-text">{shot.notes}</span>
    </section>
  {/if}
</main>

<TabBar current="journal" />

<style>
  header {
    display: grid;
    grid-template-columns: 48px 1fr auto;
    align-items: center;
    height: 60px;
    flex: none;
    padding: 0 var(--space-3) 0 var(--space-2);
  }

  .back {
    width: var(--touch-min);
    height: var(--touch-min);
    display: flex;
    align-items: center;
    justify-content: center;
    border-radius: var(--radius-sm);
    color: var(--ink);
  }

  /* Amber: an action you take (D-19). */
  .edit {
    display: flex;
    align-items: center;
    height: var(--touch-min);
    padding: 0 14px;
    border-radius: var(--radius-sm);
    color: var(--amber);
    font-size: 15px;
    font-weight: 600;
    text-decoration: none;
  }

  .title {
    display: flex;
    flex-direction: column;
  }

  h1 {
    margin: 0;
  }

  .when {
    font-size: 12px;
    color: var(--ink-muted);
  }

  main {
    flex: 1;
    min-height: 0;
    display: flex;
    flex-direction: column;
    gap: var(--space-3);
    padding: var(--space-1) var(--space-5) var(--space-3);
    /* D-36: the screen fits; a long note scrolls inside its own card. */
    overflow: hidden;
  }

  .soft {
    font-size: 13px;
    color: var(--ink-muted);
  }

  .setup {
    display: flex;
    flex-direction: column;
    gap: 6px;
    padding: var(--space-3) 14px;
  }

  .bean {
    display: flex;
    justify-content: space-between;
    align-items: baseline;
    gap: var(--space-2);
  }

  .name {
    font-size: 16px;
    font-weight: 600;
  }

  .tiles {
    display: grid;
    grid-template-columns: repeat(4, minmax(0, 1fr));
    gap: var(--space-2);
  }

  .tile {
    display: flex;
    flex-direction: column;
    gap: 2px;
    padding: 10px var(--space-3);
    border-radius: var(--radius-md);
    background: var(--surface);
  }

  .tile-label {
    font-size: 12px;
    color: var(--ink-muted);
  }

  .tile-value {
    font-size: 20px;
    font-weight: 700;
  }

  .unit {
    font-size: 13px;
    font-weight: 500;
    color: var(--ink-muted);
  }

  .ratio {
    margin-top: calc(-1 * var(--space-1));
    text-align: center;
    font-size: 13px;
    color: var(--ink-muted);
  }

  .ratio span {
    color: var(--ink);
    font-weight: 600;
  }

  .taste {
    display: flex;
    gap: 14px;
    padding: 14px;
  }

  .score {
    display: flex;
    flex-direction: column;
    align-items: center;
    justify-content: center;
    width: 72px;
    flex: none;
    border-radius: var(--radius-md);
    background: var(--bg);
  }

  .number {
    font-size: 32px;
    font-weight: 700;
    line-height: 1;
  }

  .word {
    font-size: 12px;
    color: var(--ink-muted);
  }

  .not-rated {
    font-size: 12px;
    color: var(--ink-muted);
    text-align: center;
  }

  .scales {
    flex: 1;
    min-width: 0;
    display: flex;
    flex-direction: column;
    gap: 9px;
  }

  .scale {
    display: grid;
    grid-template-columns: 82px 1fr 92px;
    align-items: center;
    gap: 10px;
    font-size: 13px;
  }

  .track {
    position: relative;
    height: 6px;
    border-radius: 3px;
    background: var(--bg);
  }

  .handle {
    position: absolute;
    top: -3px;
    width: 12px;
    height: 12px;
    border-radius: 6px;
    background: var(--amber);
  }

  .words {
    text-align: right;
  }

  .flavors {
    display: flex;
    flex-wrap: wrap;
    gap: 6px;
    margin: 0;
    padding: 0;
    list-style: none;
  }

  .flavors li {
    padding: var(--space-1) 10px;
    border-radius: var(--radius-block);
    background: var(--bg);
    font-size: 13px;
    font-weight: 600;
  }

  .tag-detail {
    color: var(--ink-muted);
    font-weight: 500;
  }

  .compared {
    display: flex;
    flex-direction: column;
    gap: 10px;
    padding: 14px;
  }

  .compared-head {
    display: flex;
    justify-content: space-between;
    align-items: baseline;
  }

  .compared h2 {
    margin: 0;
    font-size: 15px;
    font-weight: 600;
  }

  /* The recipe's history is cherry (D-19). */
  .count {
    font-size: 12px;
    font-weight: 600;
    color: var(--cherry);
  }

  .measures {
    display: grid;
    grid-template-columns: repeat(2, minmax(0, 1fr));
    gap: 10px;
    font-size: 13px;
  }

  .measure {
    display: flex;
    flex-direction: column;
    gap: 2px;
  }

  .measure b {
    font-weight: 700;
  }

  .soft-13 {
    color: var(--ink-muted);
  }

  .verdict {
    color: var(--ink-soft);
  }

  .notes {
    display: flex;
    flex-direction: column;
    gap: var(--space-1);
    min-height: 0;
    flex-shrink: 1;
    padding: var(--space-3) 14px;
  }

  .notes-label {
    font-size: 12px;
    color: var(--ink-muted);
  }

  .notes-text {
    font-size: 14px;
    line-height: 1.4;
    white-space: pre-line;
    overflow-wrap: anywhere;
    min-height: 0;
    overflow-y: auto;
  }
</style>
