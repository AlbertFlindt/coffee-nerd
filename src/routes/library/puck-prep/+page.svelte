<script lang="ts">
  // Puck prep (screen 18, D-51): your routines as cards (name, "In use" for My setup's and the last shot's
  // routine, D-163, the steps as a mini flow, shots and average score), then your steps as chips with
  // their unit and "New step" (D-52). A step chip opens the step sheet (D-168); a card or "New routine"
  // opens the routine builder (D-167). Only the page area scrolls (D-36).
  import { goto } from '$app/navigation';
  import { resolve } from '$app/paths';
  import { page as current } from '$app/state';
  import ArchivedLink from '#lib/components/ArchivedLink.svelte';
  import BottomSheet from '#lib/components/BottomSheet.svelte';
  import StepSheet from '#lib/components/StepSheet.svelte';
  import TabBar from '#lib/components/TabBar.svelte';
  import { formatNumber } from '#lib/domain/units.ts';
  import type { RoutineCard } from '#lib/server/db/puck-prep.ts';
  import type { PageProps } from './$types';

  let { data }: PageProps = $props();
  const page = $derived(data.page);
  /** The step sheet: null closed, 'new' to add, or the id of the step being changed. */
  let sheet: 'new' | string | null = $state(null);
  const editing = $derived(page.steps.find((s) => s.id === sheet));

  // D-187: a routine just saved asks to be used for new shots (`?ask=<id>`), unless My setup uses it.
  const asking = $derived(
    page.routines.find((r) => r.id === current.url.searchParams.get('ask') && !r.inMySetup)
  );
  let answering = $state(false);
  const notNow = () => goto(resolve('/library/puck-prep'), { replaceState: true });

  function stats(r: RoutineCard): string {
    if (r.shots === 0) return 'No shots yet';
    const shots = `${r.shots} ${r.shots === 1 ? 'shot' : 'shots'}`;
    return r.averageScore === null
      ? `${shots} · not rated yet`
      : `${shots} · average score ${formatNumber(Math.round(r.averageScore * 1000), 1)}`;
  }
</script>

<svelte:head><title>Puck prep · Coffee Nerd</title></svelte:head>

{#snippet plus(size: number)}
  <svg
    width={size}
    height={size}
    viewBox="0 0 24 24"
    fill="none"
    stroke="currentColor"
    stroke-width="2.6"
    stroke-linecap="round"
    aria-hidden="true"><path d="M12 5v14M5 12h14" /></svg
  >
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
  <h1>Puck prep</h1>
  <a class="cn-btn-add cn-tap-strong add" href={resolve('/library/puck-prep/routine/new')}
    >{@render plus(16)}New routine</a
  >
</header>

<main>
  <!-- Screen 51: without routines the heading has no count. -->
  <h2>Routines{page.routines.length ? ` · ${page.routines.length}` : ''}</h2>
  {#each page.routines as r (r.id)}
    <a class="card cn-tap" href={resolve('/library/puck-prep/routine/[id]', { id: r.id })}>
      <div class="card-head">
        <span class="name">{r.name}</span>
        {#if r.inUse}<span class="chip">In use</span>{/if}
      </div>
      <div class="flow" role="img" aria-label={r.steps.join(', then ')}>
        {#each r.steps as step, i (i)}
          {#if i > 0}
            <svg
              width="14"
              height="14"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              stroke-width="2.4"
              stroke-linecap="round"
              stroke-linejoin="round"
              aria-hidden="true"><path d="M5 12h14M13 6l6 6-6 6" /></svg
            >
          {/if}
          <span class="step" aria-hidden="true">{step}</span>
        {/each}
      </div>
      <span class="stats">{stats(r)}</span>
    </a>
  {:else}
    <!-- Screen 51: an empty dashed frame where the routines go. -->
    <p class="empty">No routines yet.</p>
  {/each}

  <div class="steps-head">
    <h2>Your steps · {page.steps.length}</h2>
    <span class="hint">Building blocks for routines</span>
  </div>
  <div class="chips">
    {#each page.steps as s (s.id)}
      <button type="button" class="chip-step cn-tap" onclick={() => (sheet = s.id)}>
        {s.name}{#if s.unit}<span class="unit">&nbsp;· {s.unit}</span>{/if}
      </button>
    {/each}
    <button type="button" class="chip-step new cn-tap" onclick={() => (sheet = 'new')}>
      {@render plus(14)}New step
    </button>
  </div>
  <ArchivedLink area="puck-prep" count={data.archived} />
</main>

<TabBar current="library" />

{#if sheet === 'new'}
  <StepSheet onclose={() => (sheet = null)} />
{:else if editing}
  {#key editing.id}
    <StepSheet step={editing} onclose={() => (sheet = null)} />
  {/key}
{:else if asking}
  <BottomSheet short label="Use it for new shots" closeLabel="Not now" onclose={notNow}>
    <h2 class="sheet-title">Use it for new shots?</h2>
    <p class="note">
      {asking.name} becomes My setup’s routine, and your next shot starts with it.
    </p>
    <form
      class="confirm"
      method="POST"
      action="?/useForNewShots"
      onsubmit={() => (answering = true)}
    >
      <input type="hidden" name="id" value={asking.id} />
      <button class="cn-btn-primary cn-tap-strong" type="submit" disabled={answering}
        >Use it for new shots</button
      >
      <button class="cn-btn-secondary cn-tap" type="button" onclick={notNow}>Not now</button>
    </form>
  </BottomSheet>
{/if}

<style>
  .sheet-title {
    margin: 4px 0 0;
    font-size: 19px;
    line-height: 24px;
    font-weight: 700;
  }

  .note {
    margin: -8px 0 8px;
    font-size: 14px;
    line-height: 1.45;
    color: var(--ink-soft);
  }

  .confirm {
    --surface: var(--surface-sheet-field);
    display: flex;
    flex-direction: column;
    gap: var(--space-2);
  }

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
    padding: var(--space-1) var(--space-5) var(--space-4);
    overflow-y: auto;
  }

  h2 {
    margin: 0;
    font-size: 14px;
    font-weight: 600;
    color: var(--ink-muted);
  }

  .card {
    flex: none;
    display: flex;
    flex-direction: column;
    gap: var(--space-3);
    padding: var(--space-4);
    border-radius: var(--radius-xl);
    background: var(--surface);
    color: var(--ink);
    text-decoration: none;
  }

  .card-head {
    display: flex;
    align-items: center;
    gap: var(--space-2);
  }

  .name {
    flex: 1;
    font-size: 17px;
    font-weight: 700;
  }

  .chip {
    padding: 3px 8px;
    border-radius: var(--radius-pill);
    background: var(--cream);
    color: var(--on-cream);
    font-size: 12px;
    font-weight: 700;
  }

  .flow {
    display: flex;
    flex-wrap: wrap;
    align-items: center;
    gap: 6px;
    font-size: 13px;
    font-weight: 600;
    color: var(--ink-muted);
  }

  .step {
    padding: 6px 10px;
    border-radius: var(--radius-sm);
    background: var(--bg);
    color: var(--ink);
  }

  /* Screens 18, 50: the link reads as a button, without the browser's underline. */
  .add {
    text-decoration: none;
  }

  .stats,
  .hint {
    font-size: 13px;
    color: var(--ink-muted);
  }

  .hint {
    font-size: 12px;
  }

  .empty {
    display: flex;
    align-items: center;
    justify-content: center;
    min-height: 140px;
    margin: 0;
    padding: 0 28px;
    border-radius: var(--radius-xl);
    border: 1.5px dashed var(--line);
    font-size: 16px;
    font-weight: 600;
    text-align: center;
  }

  .steps-head {
    display: flex;
    justify-content: space-between;
    align-items: baseline;
    margin-top: var(--space-2);
  }

  .chips {
    display: flex;
    flex-wrap: wrap;
    gap: var(--space-2);
  }

  .chip-step {
    display: inline-flex;
    align-items: center;
    gap: 6px;
    height: var(--touch-min);
    padding: 0 14px;
    border-radius: var(--radius-pill);
    border: none;
    background: var(--surface);
    color: var(--ink);
    font-size: 14px;
    font-weight: 600;
  }

  .unit {
    font-weight: 500;
    color: var(--ink-muted);
  }

  .new {
    border: 1.5px dashed var(--line);
    background: transparent;
    color: var(--ink-muted);
    font-weight: 500;
  }
</style>
