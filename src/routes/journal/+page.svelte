<script lang="ts">
  // Journal (screen 22, D-54): header, filter chips, then the shots grouped by day. Only the list
  // scrolls (D-36).
  import { tick } from 'svelte';
  import { enhance } from '$app/forms';
  import { resolve } from '$app/paths';
  import BottomSheet from '#lib/components/BottomSheet.svelte';
  import JournalRow from '#lib/components/JournalRow.svelte';
  import ScoreRow from '#lib/components/ScoreRow.svelte';
  import { clockTime, groupByDay } from '#lib/domain/journal.ts';
  import TabBar from '#lib/components/TabBar.svelte';
  import type { PageProps } from './$types';

  let { data }: PageProps = $props();

  const journal = $derived(data.journal);
  const groups = $derived(groupByDay(journal.shots, data.now, journal.timeZone));
  const beanName = $derived(journal.beans.find((b) => b.id === journal.beanId)?.name);
  const weekText = $derived(
    `${journal.shotsThisWeek} ${journal.shotsThisWeek === 1 ? 'shot' : 'shots'} this week`
  );
  let beanSheet = $state(false);
  let recipeSheet = $state(false);
  const recipeLabel = $derived(journal.recipes.find((r) => r.id === journal.recipeId)?.label);

  // D-111: the Rate sheet. A tap on a score saves it; a slide saves where the finger lifts (D-10).
  let rating: (typeof journal.shots)[number] | null = $state(null);
  let score: number | null = $state(null);
  let pressing = false;
  let rateForm: HTMLFormElement | undefined = $state();
  let rateFailed = $state(false);
  const openRate = (shot: (typeof journal.shots)[number]) => {
    score = null;
    rateFailed = false;
    rating = shot;
  };
  const submitScore = async () => {
    if (score === null) return;
    await tick(); // the hidden input carries the new score first
    rateForm?.requestSubmit();
  };
</script>

{#snippet chevron()}
  <svg
    width="14"
    height="14"
    viewBox="0 0 24 24"
    fill="none"
    stroke="currentColor"
    stroke-width="2.2"
    stroke-linecap="round"
    aria-hidden="true"><path d="M6 9l6 6 6-6" /></svg
  >
{/snippet}

<header>
  <h1 class="cn-type-display">Journal</h1>
  <span class="week">{weekText}</span>
</header>

<div class="filters" role="group" aria-label="Filters">
  <button
    type="button"
    class="cn-chip chip"
    class:is-on={beanName !== undefined}
    aria-haspopup="dialog"
    onclick={() => (beanSheet = true)}
  >
    <span class="chip-label">{beanName ?? 'All beans'}</span>
    {@render chevron()}
  </button>
  <form method="GET">
    {#if journal.beanId}<input type="hidden" name="bean" value={journal.beanId} />{/if}
    {#if journal.recipeId}<input type="hidden" name="recipe" value={journal.recipeId} />{/if}
    <button
      type="submit"
      class="cn-chip chip"
      aria-pressed={journal.unrated}
      name={journal.unrated ? undefined : 'unrated'}
      value={journal.unrated ? undefined : '1'}
    >
      Unrated · {journal.unratedCount}
    </button>
  </form>
  <!-- D-112: the recipe filter appears once a bean is chosen. -->
  {#if journal.beanId}
    <button
      type="button"
      class="cn-chip chip"
      class:is-on={recipeLabel !== undefined}
      aria-haspopup="dialog"
      onclick={() => (recipeSheet = true)}
    >
      <span class="chip-label">{recipeLabel ?? 'Any recipe'}</span>
      {@render chevron()}
    </button>
  {/if}
</div>

<main>
  {#each groups as group (group.label)}
    <section aria-label={group.label}>
      <h2>{group.label}</h2>
      {#each group.shots as shot (shot.id)}
        <JournalRow
          {shot}
          timeZone={journal.timeZone}
          steps={journal.steps}
          onrate={() => openRate(shot)}
        />
      {/each}
    </section>
  {:else}
    <!-- Not designed yet (docs/open-items.md). -->
    <p class="empty">
      {#if journal.unrated}No unrated shots.{:else}No shots yet.{/if}
    </p>
  {/each}
</main>

{#if beanSheet}
  <BottomSheet
    label="Choose a bean"
    closeLabel="Close bean list"
    onclose={() => (beanSheet = false)}
  >
    <h2 class="cn-type-heading sheet-title">Beans</h2>
    <!-- Not designed yet: a plain list of the beans that have shots (docs/open-items.md). -->
    <form class="beans" method="GET" action={resolve('/journal')}>
      {#if journal.unrated}<input type="hidden" name="unrated" value="1" />{/if}
      <button
        type="submit"
        class="bean cn-tap"
        onclick={() => (beanSheet = false)}
        aria-pressed={journal.beanId === null}>All beans</button
      >
      {#each journal.beans as b (b.id)}
        <button
          type="submit"
          name="bean"
          value={b.id}
          class="bean cn-tap"
          onclick={() => (beanSheet = false)}
          aria-pressed={b.id === journal.beanId}>{b.name}</button
        >
      {/each}
    </form>
  </BottomSheet>
{/if}

{#if recipeSheet}
  <BottomSheet
    label="Choose a recipe"
    closeLabel="Close recipe list"
    onclose={() => (recipeSheet = false)}
  >
    <h2 class="cn-type-heading sheet-title">Recipes</h2>
    <!-- Not designed yet: a plain list of the bean's recipes (D-112, docs/open-items.md). -->
    <form class="beans" method="GET" action={resolve('/journal')}>
      <input type="hidden" name="bean" value={journal.beanId} />
      {#if journal.unrated}<input type="hidden" name="unrated" value="1" />{/if}
      <button
        type="submit"
        class="bean cn-tap"
        onclick={() => (recipeSheet = false)}
        aria-pressed={journal.recipeId === null}>Any recipe</button
      >
      {#each journal.recipes as r (r.id)}
        <button
          type="submit"
          name="recipe"
          value={r.id}
          class="bean cn-tap"
          onclick={() => (recipeSheet = false)}
          aria-pressed={r.id === journal.recipeId}>{r.label}</button
        >
      {/each}
    </form>
  </BottomSheet>
{/if}

{#if rating}
  <BottomSheet
    short
    label="Rate the shot"
    closeLabel="Close without rating"
    onclose={() => (rating = null)}
  >
    <!-- Not designed yet beyond D-111: the shot as the title, then the score row (docs/open-items.md). -->
    <h2 class="cn-type-heading sheet-title">
      {`${rating.beanName} · ${clockTime(rating.brewedAt, journal.timeZone)}`}
    </h2>
    <form
      bind:this={rateForm}
      method="POST"
      action="?/rate"
      use:enhance={() =>
        async ({ result, update }) => {
          await update();
          // Closes only once the score is saved; otherwise the sheet stays with a message.
          if (result.type === 'success') rating = null;
          else rateFailed = true;
        }}
    >
      <input type="hidden" name="shotId" value={rating.id} />
      <input type="hidden" name="score" value={score ?? ''} />
      <div
        role="presentation"
        onpointerdowncapture={() => (pressing = true)}
        onpointerup={() => {
          pressing = false;
          submitScore();
        }}
        onpointercancel={() => (pressing = false)}
      >
        <ScoreRow
          value={score}
          previous={rating.previousScore}
          onchange={(v) => {
            score = v;
            if (!pressing) submitScore();
          }}
        />
      </div>
    </form>
    {#if rateFailed}
      <!-- Not designed yet (docs/open-items.md). -->
      <p class="problem" role="alert">The score could not be saved. Nothing was changed.</p>
    {/if}
  </BottomSheet>
{/if}

<TabBar current="journal" />

<style>
  header {
    display: flex;
    flex-direction: column;
    gap: 2px;
    padding: var(--space-5) var(--space-5) 10px;
  }

  h1 {
    margin: 0;
  }

  .week {
    font-size: 14px;
    color: var(--ink-muted);
  }

  .filters {
    display: flex;
    gap: var(--space-2);
    padding: var(--space-1) var(--space-5) var(--space-3);
    /* With a long bean or recipe name the chips slide sideways, never off the screen for good. */
    overflow-x: auto;
  }

  .filters form {
    flex: none;
  }

  .chip {
    height: var(--touch-min);
    flex: none;
    white-space: nowrap;
    max-width: 200px;
  }

  .chip-label {
    min-width: 0;
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
  }

  main {
    flex: 1;
    min-height: 0;
    display: flex;
    flex-direction: column;
    gap: var(--space-4);
    padding: 0 var(--space-5) var(--space-4);
    /* D-36: the list is the scrolling region. */
    overflow-y: auto;
  }

  section {
    display: flex;
    flex-direction: column;
    gap: var(--space-2);
  }

  h2 {
    margin: 0;
    font-size: 14px;
    font-weight: 600;
    color: var(--ink-muted);
  }

  .empty {
    margin: 0;
    color: var(--ink-muted);
  }

  .problem {
    margin: 0;
    font-size: 13px;
    color: var(--ink-soft);
  }

  .sheet-title {
    margin: 4px 0 0;
  }

  .beans {
    display: flex;
    flex-direction: column;
    gap: 2px;
    border-radius: var(--radius-md);
    overflow-y: auto;
  }

  .bean {
    min-height: 56px;
    padding: 0 14px;
    border: none;
    background: var(--surface-sheet-field);
    color: var(--ink);
    font-size: 15px;
    font-weight: 600;
    text-align: left;
  }

  .bean[aria-pressed='true'] {
    color: var(--amber);
  }
</style>
