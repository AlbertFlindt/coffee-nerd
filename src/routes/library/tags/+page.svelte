<script lang="ts">
  // Tags (screen 21, D-53): "Add tag", a search field, the cream "Same tag twice?" card with Merge (it asks
  // first, D-180) and a quiet "Keep both" (D-173), then your notes as chips by family with their count and "custom" for the
  // ones you added. A chip opens the tag sheet. Only the chip area scrolls (D-36).
  import { enhance } from '$app/forms';
  import { resolve } from '$app/paths';
  import TabBar from '#lib/components/TabBar.svelte';
  import TagSheet from '#lib/components/TagSheet.svelte';
  import { matchesSearch } from '#lib/domain/tags.ts';
  import type { TagItem } from '#lib/server/db/tags.ts';
  import type { PageProps } from './$types';

  let { data }: PageProps = $props();
  const page = $derived(data.page);
  const duplicate = $derived(page.duplicate);
  const everyNote = $derived(page.families.flatMap((f) => f.tags));

  /** The tag sheet: null closed, 'new' to add, or the id of the note being changed. */
  let sheet: 'new' | string | null = $state(null);
  const editing = $derived(everyNote.find((t) => t.id === sheet));

  /** The "Same tag twice?" card's merge, waiting for its confirmation (D-180). */
  let merging = $state(false);
  let search = $state('');
  const shown = $derived(
    page.families
      .map((f) => ({
        ...f,
        tags: f.tags.filter((t) => matchesSearch(t.name, search))
      }))
      .filter((f) => f.tags.length > 0)
  );

  const shots = (n: number) => `${n} ${n === 1 ? 'shot' : 'shots'}`;
  const chipLabel = (t: TagItem) => `${t.name}, ${shots(t.count)}${t.custom ? ', custom' : ''}`;
</script>

<svelte:head><title>Tags · Coffee Nerd</title></svelte:head>

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
  <h1>Tags</h1>
  <button type="button" class="cn-btn-add cn-tap-strong" onclick={() => (sheet = 'new')}>
    <svg
      width="16"
      height="16"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      stroke-width="2.6"
      stroke-linecap="round"
      aria-hidden="true"><path d="M12 5v14M5 12h14" /></svg
    >Add tag
  </button>
</header>

<main>
  <div class="search">
    <svg
      width="18"
      height="18"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      stroke-width="2"
      stroke-linecap="round"
      aria-hidden="true"><circle cx="11" cy="11" r="7" /><path d="M20 20l-4-4" /></svg
    >
    <label for="tag-search" class="sr">Search tags</label>
    <input
      id="tag-search"
      type="search"
      autocomplete="off"
      placeholder="Search {page.total} tags"
      bind:value={search}
    />
  </div>

  {#if duplicate}
    <section class="cn-card--cream duplicate" aria-label="Possible duplicate">
      <div class="text">
        <span class="title">Same tag twice?</span>
        <span class="line"
          >"{duplicate.merge.name}" ({shots(duplicate.merge.count)}) looks like "{duplicate.keep
            .name}" ({duplicate.keep.count})</span
        >
        <form method="POST" action="?/keepBoth" use:enhance>
          <input type="hidden" name="id" value={duplicate.merge.id} />
          <input type="hidden" name="other" value={duplicate.keep.id} />
          <button type="submit" class="keep cn-tap">Keep both</button>
        </form>
      </div>
      <button
        type="button"
        class="merge cn-tap"
        aria-label="Merge {duplicate.merge.name} into {duplicate.keep.name}"
        onclick={() => (merging = true)}>Merge</button
      >
    </section>
  {/if}

  <div class="families">
    {#each shown as f (f.family)}
      <section class="family" aria-label={f.label}>
        <h2>{f.label} · {f.tags.length}</h2>
        <div class="chips">
          {#each f.tags as t (t.id)}
            <button
              type="button"
              class="cn-chip chip cn-tap"
              aria-label={chipLabel(t)}
              onclick={() => (sheet = t.id)}
            >
              {t.name}<span class="cn-chip__count">{t.count}</span>
              {#if t.custom}<span class="custom">custom</span>{/if}
            </button>
          {/each}
        </div>
      </section>
    {:else}
      <p class="empty">{page.total === 0 ? 'No tags yet.' : 'No tags match.'}</p>
    {/each}
  </div>
</main>

<TabBar current="library" />

{#if merging && duplicate}
  <!-- D-180: the card's Merge asks first, as the sheet does. -->
  {#key duplicate.merge.id}
    <TagSheet tag={duplicate.merge} into={duplicate.keep} onclose={() => (merging = false)} />
  {/key}
{:else if sheet === 'new'}
  <TagSheet onclose={() => (sheet = null)} />
{:else if editing}
  {#key editing.id}
    <TagSheet
      tag={editing}
      others={everyNote
        .filter((t) => t.id !== editing.id)
        .toSorted((a, b) => a.name.localeCompare(b.name))}
      onclose={() => (sheet = null)}
    />
  {/key}
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
    gap: 14px;
    padding: var(--space-1) var(--space-5) var(--space-4);
  }

  .search {
    flex: none;
    display: flex;
    align-items: center;
    gap: 10px;
    min-height: 48px;
    padding: 0 14px;
    border-radius: var(--radius-sheet);
    background: var(--surface);
    color: var(--ink-muted);
  }

  .search:focus-within {
    box-shadow: 0 0 0 2px var(--amber);
  }

  .search input {
    flex: 1;
    min-width: 0;
    border: none;
    padding: 0;
    background: transparent;
    color: var(--ink);
    font: inherit;
    font-size: 16px;
  }

  .search input::placeholder {
    color: var(--ink-muted);
  }

  .search input:focus-visible {
    outline: none;
  }

  .search input::-webkit-search-cancel-button {
    display: none;
  }

  .sr {
    position: absolute;
    width: 1px;
    height: 1px;
    overflow: hidden;
    clip-path: inset(50%);
  }

  .duplicate {
    flex: none;
    display: flex;
    align-items: center;
    gap: var(--space-3);
    padding: 14px 14px 14px var(--space-4);
    border-radius: var(--radius-lg);
  }

  .text {
    flex: 1;
    min-width: 0;
    display: flex;
    flex-direction: column;
    gap: 2px;
  }

  .title {
    font-size: 14px;
    font-weight: 700;
  }

  .line {
    font-size: 13px;
    color: var(--on-cream-muted);
  }

  .keep {
    align-self: flex-start;
    height: var(--touch-min);
    margin: -6px 0 -14px -8px;
    padding: 0 8px;
    border: none;
    background: none;
    color: var(--on-cream-muted);
    font-size: 13px;
    font-weight: 600;
    text-decoration: underline;
  }

  .merge {
    height: var(--touch-min);
    padding: 0 var(--space-4);
    border-radius: var(--radius-pill);
    border: none;
    background: var(--bg);
    color: var(--ink);
    font-size: 14px;
    font-weight: 600;
  }

  .families {
    flex: 1;
    min-height: 0;
    display: flex;
    flex-direction: column;
    gap: var(--space-4);
    overflow-y: auto;
    scrollbar-width: none;
  }

  .families::-webkit-scrollbar {
    display: none;
  }

  .family {
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

  .chips {
    display: flex;
    flex-wrap: wrap;
    gap: var(--space-2);
  }

  .chip {
    flex: none;
    padding: 0 12px;
  }

  .custom {
    padding: 1px 5px;
    border: 1px solid var(--line);
    border-radius: 6px;
    font-size: 11px;
    font-weight: 600;
    color: var(--ink-muted);
  }

  .empty {
    margin: 0;
    font-size: 13px;
    color: var(--ink-muted);
  }
</style>
