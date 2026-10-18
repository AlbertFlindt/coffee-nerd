<script lang="ts">
  // Gear (screen 8, D-38): the cream My setup card, then the gear grouped by kind, each with a short
  // summary and the Default chip for what My setup uses (D-149). "Add gear" asks for the kind first (D-147).
  // Only the list scrolls (D-36). "Edit" opens Edit My setup (screen 13, D-45), the only place the default
  // is chosen (D-149).
  import { resolve } from '$app/paths';
  import BottomSheet from '#lib/components/BottomSheet.svelte';
  import TabBar from '#lib/components/TabBar.svelte';
  import type { GearRow } from '#lib/server/db/gear.ts';
  import type { PageProps } from './$types';

  let { data }: PageProps = $props();
  const page = $derived(data.page);
  let adding = $state(false);
</script>

<svelte:head><title>Gear · Coffee Nerd</title></svelte:head>

{#snippet group(title: string, rows: GearRow[])}
  {#if rows.length > 0}
    <h2>{title}</h2>
    <div class="rows">
      {#each rows as row (row.id)}
        <a class="row cn-tap" href={resolve('/library/gear/[id]', { id: row.id })}>
          <span class="text">
            <span class="name">{row.name}</span>
            <span class="summary">{row.summary}</span>
          </span>
          {#if row.isDefault}
            <span class="chip">Default</span>
          {:else}
            <svg
              class="chevron"
              width="18"
              height="18"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              stroke-width="2"
              stroke-linecap="round"
              aria-hidden="true"><path d="M9 6l6 6-6 6" /></svg
            >
          {/if}
        </a>
      {/each}
    </div>
  {/if}
{/snippet}

<header>
  <a class="back cn-tap" href={resolve('/library')} aria-label="Back to Library">
    <svg
      width="22"
      height="22"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      stroke-width="2"
      stroke-linecap="round"
      stroke-linejoin="round"
      aria-hidden="true"><path d="M19 12H5M11 6l-6 6 6 6" /></svg
    >
  </a>
  <h1>Gear</h1>
  <button class="cn-btn-add cn-tap-strong" type="button" onclick={() => (adding = true)}>
    <svg
      width="16"
      height="16"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      stroke-width="2.6"
      stroke-linecap="round"
      aria-hidden="true"><path d="M12 5v14M5 12h14" /></svg
    >Add gear</button
  >
</header>

<main>
  <section class="cn-card cn-card--cream setup" aria-label="My setup">
    <div class="setup-head">
      <div class="setup-title">
        <h2 class="setup-name">My setup</h2>
        <span class="muted">Starting point for new beans</span>
      </div>
      <a class="edit cn-tap" href={resolve('/library/gear/setup')}>Edit</a>
    </div>
    {#if page.mySetup}
      <div class="grid">
        <div class="cell">
          <span class="label">Machine</span><span>{page.mySetup.machine}</span>
        </div>
        <div class="cell">
          <span class="label">Grinder</span><span>{page.mySetup.grinder}</span>
        </div>
        <div class="cell">
          <span class="label">Basket</span><span>{page.mySetup.basket ?? 'No basket'}</span>
        </div>
        <div class="cell">
          <span class="label">Puck prep</span><span>{page.mySetup.routine ?? 'No puck prep'}</span>
        </div>
      </div>
      <div class="values">
        <span class="label">Default values</span>
        {#if page.mySetup.values}<span>{page.mySetup.values}</span>{/if}
        {#if page.mySetup.setup}<span>{page.mySetup.setup}</span>{/if}
      </div>
    {:else}
      <p class="muted none">Not set up yet</p>
    {/if}
  </section>

  <div class="list">
    {@render group('Machines', page.machines)}
    {@render group('Grinders', page.grinders)}
    {@render group('Baskets', page.baskets)}
  </div>
</main>

<TabBar current="library" />

{#if adding}
  <!-- D-147: "Add gear" asks for the kind, then opens that kind's page, empty. -->
  <BottomSheet short label="Add gear" closeLabel="Close" onclose={() => (adding = false)}>
    <h2 class="cn-type-heading sheet-title">Add gear</h2>
    <form class="kinds" method="GET" action={resolve('/library/gear/new')}>
      <button class="kind cn-tap" name="kind" value="machine">Machine</button>
      <button class="kind cn-tap" name="kind" value="grinder">Grinder</button>
      <button class="kind cn-tap" name="kind" value="basket">Basket</button>
    </form>
  </BottomSheet>
{/if}

<style>
  header {
    display: grid;
    grid-template-columns: 48px 1fr auto;
    align-items: center;
    height: 64px;
    padding: 0 var(--space-4) 0 var(--space-2);
  }

  h1 {
    margin: 0;
    font-size: 20px;
    font-weight: 600;
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

  main {
    flex: 1;
    min-height: 0;
    display: flex;
    flex-direction: column;
    gap: var(--space-3);
    padding: var(--space-1) var(--space-5) 0;
  }

  .setup {
    display: flex;
    flex: none;
    flex-direction: column;
    gap: var(--space-3);
  }

  .setup-head {
    display: flex;
    justify-content: space-between;
    align-items: center;
  }

  .setup-title {
    display: flex;
    flex-direction: column;
    gap: 2px;
  }

  .setup-name {
    margin: 0;
    font-size: 17px;
    font-weight: 700;
    color: inherit;
  }

  .muted,
  .label {
    color: var(--on-cream-muted);
  }

  .muted {
    font-size: 13px;
  }

  .none {
    margin: 0;
  }

  .edit {
    display: flex;
    align-items: center;
    height: var(--touch-min);
    padding: 0 var(--space-4);
    border-radius: var(--radius-pill);
    background: var(--bg);
    color: var(--ink);
    font-size: 14px;
    font-weight: 600;
    text-decoration: none;
  }

  .grid {
    display: grid;
    grid-template-columns: repeat(2, minmax(0, 1fr));
    gap: 10px var(--space-4);
    font-size: 14px;
    font-weight: 600;
  }

  .cell {
    display: flex;
    flex-direction: column;
    gap: 1px;
  }

  .label {
    font-size: 12px;
    font-weight: 400;
  }

  .values {
    display: flex;
    flex-direction: column;
    gap: var(--space-1);
    padding-top: 10px;
    border-top: 1px solid color-mix(in srgb, var(--on-cream-muted) 25%, transparent);
    font-size: 14px;
  }

  /* D-36: the gear list is the part that scrolls. */
  .list {
    flex: 1;
    min-height: 0;
    display: flex;
    flex-direction: column;
    gap: 10px;
    overflow-y: auto;
    padding-bottom: var(--space-4);
  }

  h2 {
    margin: var(--space-1) 0 0;
    font-size: 14px;
    font-weight: 600;
    color: var(--ink-muted);
  }

  .rows {
    display: flex;
    flex-direction: column;
    gap: 2px;
    border-radius: var(--radius-lg);
    overflow: hidden;
  }

  .row {
    display: flex;
    flex: none;
    align-items: center;
    gap: var(--space-3);
    min-height: 64px;
    padding: 0 var(--space-4);
    background: var(--surface);
    color: var(--ink);
    text-decoration: none;
  }

  .text {
    flex: 1;
    min-width: 0;
    display: flex;
    flex-direction: column;
    gap: 2px;
  }

  .name {
    font-size: 15px;
    font-weight: 600;
  }

  .summary {
    font-size: 13px;
    color: var(--ink-muted);
  }

  .chip {
    flex: none;
    padding: 3px 8px;
    border-radius: var(--radius-pill);
    background: var(--cream);
    color: var(--on-cream);
    font-size: 12px;
    font-weight: 700;
  }

  .chevron {
    flex: none;
    color: var(--ink-muted);
  }

  .sheet-title {
    margin: 4px 0 0;
  }

  .kinds {
    display: flex;
    flex-direction: column;
    gap: 2px;
    border-radius: var(--radius-md);
    overflow: hidden;
  }

  .kind {
    min-height: 56px;
    padding: 0 14px;
    border: none;
    background: var(--surface-sheet-field);
    color: var(--ink);
    font-size: 15px;
    font-weight: 600;
    text-align: left;
  }
</style>
