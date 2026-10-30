<script lang="ts">
  // An area's archived items: grouped like the page they came from, each with its line and a
  // Restore button that puts it back in its list and pickers. Only the list scrolls.
  import { enhance } from '$app/forms';
  import { resolve } from '$app/paths';
  import type { ArchiveArea, ArchivedGroup } from '#lib/server/db/archived.ts';

  let {
    area,
    groups,
    problem = null
  }: {
    area: ArchiveArea;
    groups: ArchivedGroup[];
    /** A restore that failed: the row and what to say under it. */
    problem?: { id: string; problem: string } | null;
  } = $props();
  const back = $derived(
    {
      gear: resolve('/library/gear'),
      'puck-prep': resolve('/library/puck-prep'),
      tags: resolve('/library/tags')
    }[area]
  );
  const backLabel = $derived(
    { gear: 'Back to Gear', 'puck-prep': 'Back to Puck prep', tags: 'Back to Tags' }[area]
  );
  let restoring: string | null = $state(null);
</script>

<header>
  <a class="back cn-tap" href={back} aria-label={backLabel}>
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
  <h1>Archived</h1>
</header>

<main>
  <p class="note">Archived items are left out of lists and pickers. Past shots keep them.</p>
  {#each groups as group (group.title)}
    <h2>{group.title}</h2>
    <div class="rows">
      {#each group.items as item (item.id)}
        <div class="row">
          <span class="text">
            <span class="name">{item.name}</span>
            {#if item.detail}<span class="summary">{item.detail}</span>{/if}
          </span>
          <form
            method="POST"
            action="?/restore"
            use:enhance={() => {
              restoring = item.id;
              return async ({ update }) => {
                await update();
                restoring = null;
              };
            }}
          >
            <input type="hidden" name="kind" value={item.kind} />
            <input type="hidden" name="id" value={item.id} />
            <button
              class="restore cn-tap"
              disabled={restoring === item.id}
              aria-label="Restore {item.name}">Restore</button
            >
          </form>
        </div>
        {#if problem?.id === item.id}<p class="problem" role="alert">{problem.problem}</p>{/if}
      {/each}
    </div>
  {:else}
    <p class="empty">Nothing archived.</p>
  {/each}
</main>

<style>
  header {
    display: grid;
    grid-template-columns: 48px 1fr;
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

  /* The list scrolls inside the page. */
  main {
    flex: 1;
    min-height: 0;
    display: flex;
    flex-direction: column;
    gap: 10px;
    overflow-y: auto;
    padding: var(--space-1) var(--space-5) var(--space-4);
  }

  .note,
  .empty {
    margin: 0;
    font-size: 13px;
    line-height: 1.4;
    color: var(--ink-muted);
  }

  h2 {
    margin: var(--space-1) 0 0;
    font-size: 14px;
    font-weight: 600;
    color: var(--ink-muted);
  }

  .rows {
    display: flex;
    flex: none;
    flex-direction: column;
    gap: 2px;
    border-radius: var(--radius-lg);
    overflow: hidden;
  }

  .row {
    display: flex;
    align-items: center;
    gap: var(--space-3);
    min-height: 64px;
    padding: 0 var(--space-3) 0 var(--space-4);
    background: var(--surface);
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
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
  }

  .problem {
    margin: 0;
    padding: var(--space-2) var(--space-4);
    background: var(--surface);
    font-size: 13px;
    color: var(--ink-muted);
  }

  .restore {
    height: var(--touch-min);
    padding: 0 var(--space-4);
    border: none;
    border-radius: var(--radius-pill);
    background: var(--bg);
    color: var(--ink);
    font-size: 14px;
    font-weight: 600;
  }
</style>
