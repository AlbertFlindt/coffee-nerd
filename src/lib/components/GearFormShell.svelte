<script lang="ts">
  // The frame every gear page shares (screens 12, 15, 16; D-44, D-48, D-49): back to Gear, the kind as
  // title with the Default chip (D-38), the page's own fields, then Save. A quiet "Archive" with a
  // confirmation (D-148), or, for an item My setup uses, "Used in My setup · choose another default
  // first" (D-83). Adding (D-147) titles the page "Add machine" and its button the same. As a step of the
  // step-by-step start (D-157) it shows "Step 1 of 5" under the title and "Next"; the basket can be skipped.
  import type { Snippet } from 'svelte';
  import { enhance } from '$app/forms';
  import { resolve } from '$app/paths';
  import BottomSheet from '#lib/components/BottomSheet.svelte';
  import type { Guide } from '#lib/domain/guide.ts';

  let {
    kind,
    adding,
    isDefault = false,
    payload,
    guide = null,
    problems = [],
    children
  }: {
    kind: 'machine' | 'grinder' | 'basket';
    adding: boolean;
    isDefault?: boolean;
    /** The page's fields as JSON, posted to `?/save` (a GearInput). */
    payload: string;
    guide?: Guide | null;
    problems?: string[];
    children: Snippet;
  } = $props();

  const NOUN = { machine: 'Machine', grinder: 'Grinder', basket: 'Basket' };
  let confirm = $state(false);
  // Adding keeps ?kind= (and the guide) in the URL, so the page can show what to fix (D-147).
  const query = $derived(adding ? `?kind=${kind}${guide ? '&guide=1' : ''}&` : '?');
  let archiving = $state(false);
</script>

<!-- Screens 38, 39, 47, 48: adding is a task, with × and the title centred, like Add bean. -->
<header class:adding>
  <a
    class="icon cn-tap"
    href={guide ? resolve('/') : resolve('/library/gear')}
    aria-label={guide ? 'Leave for now' : adding ? 'Close without saving' : 'Back to Gear'}
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
      aria-hidden="true"
      >{#if adding}<path d="M6 6l12 12M18 6L6 18" />{:else}<path
          d="M19 12H5M11 6l-6 6 6 6"
        />{/if}</svg
    >
  </a>
  <div class="title">
    <h1>{adding ? `Add ${kind}` : NOUN[kind]}</h1>
    {#if guide}<span class="cn-caption">Step {guide.step} of {guide.of}</span>{/if}
  </div>
  {#if isDefault}<span class="chip">Default</span>{:else}<span></span>{/if}
</header>

<main>
  {@render children()}
</main>

<footer>
  {#each problems as problem (problem)}
    <p class="problem" role="alert">{problem}</p>
  {/each}
  <form method="POST" action="{query}/save" use:enhance>
    <input type="hidden" name="payload" value={payload} />
    <button class="cn-btn-primary cn-tap-strong"
      >{guide ? 'Next' : adding ? `Add ${kind}` : 'Save'}</button
    >
  </form>
  {#if guide && kind === 'basket'}
    <!-- D-157: the basket step can be skipped. -->
    <form method="POST" action="{query}/skip">
      <button class="cn-btn-quiet cn-tap skip">Skip</button>
    </form>
  {/if}
  {#if !adding}
    {#if isDefault}
      <p class="in-use">Used in My setup · choose another default first</p>
    {:else}
      <button class="cn-btn-quiet cn-tap" type="button" onclick={() => (confirm = true)}
        >Archive</button
      >
    {/if}
  {/if}
</footer>

{#if confirm}
  <!-- D-148: archiving asks first, like deleting a bean (D-145). -->
  <BottomSheet
    short
    label="Archive this {kind}"
    closeLabel="Keep the {kind}"
    onclose={() => (confirm = false)}
  >
    <h2 class="sheet-title">Archive this {kind}?</h2>
    <p class="note">It leaves the Gear page and the pickers. Past shots keep its name.</p>
    <form class="confirm" method="POST" action="?/archive" onsubmit={() => (archiving = true)}>
      <button class="cn-btn-primary cn-tap-strong" type="submit" disabled={archiving}
        >Archive</button
      >
      <button class="cn-btn-secondary cn-tap" type="button" onclick={() => (confirm = false)}
        >Keep it</button
      >
    </form>
  </BottomSheet>
{/if}

<style>
  header {
    display: grid;
    grid-template-columns: 48px 1fr auto;
    align-items: center;
    height: 60px;
    padding: 0 var(--space-4) 0 var(--space-2);
  }

  h1 {
    margin: 0;
    font-size: 20px;
    font-weight: 600;
  }

  .title {
    display: flex;
    flex-direction: column;
  }

  header.adding {
    grid-template-columns: 48px 1fr 48px;
    padding: 0 var(--space-2);
  }

  .adding .title {
    align-items: center;
    text-align: center;
  }

  .skip {
    width: 100%;
  }

  .icon {
    width: var(--touch-min);
    height: var(--touch-min);
    display: flex;
    align-items: center;
    justify-content: center;
    border-radius: var(--radius-sm);
    color: var(--ink);
  }

  .chip {
    padding: 3px 8px;
    border-radius: var(--radius-pill);
    background: var(--cream);
    color: var(--on-cream);
    font-size: 12px;
    font-weight: 700;
  }

  main {
    flex: 1;
    min-height: 0;
    display: flex;
    flex-direction: column;
    gap: var(--space-3);
    padding: var(--space-1) var(--space-5) var(--space-3);
    /* D-36: a long feature list scrolls inside the page; the header and Save stay. */
    overflow-y: auto;
  }

  footer {
    display: flex;
    flex-direction: column;
    gap: var(--space-2);
    padding: var(--space-2) var(--space-5) var(--space-6);
  }

  .problem,
  .in-use {
    margin: 0;
    text-align: center;
    font-size: 13px;
    line-height: 1.4;
    color: var(--ink-soft);
  }

  .in-use {
    color: var(--ink-muted);
  }

  .sheet-title {
    margin: 4px 0 0;
    font-size: 19px;
    line-height: 24px;
    font-weight: 700;
  }

  /* Screen 40: the line sits close under the question, the buttons a little further down. */
  .note {
    margin: -8px 0 8px;
    font-size: 14px;
    line-height: 1.45;
    color: var(--ink-soft);
  }

  .confirm {
    display: flex;
    flex-direction: column;
    gap: var(--space-2);
  }
</style>
