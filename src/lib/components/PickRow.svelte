<script lang="ts">
  // One choice in a sheet's list (screens 27, 28, 31, 32): its name, an optional line under it, and for
  // the chosen one bold text with an amber check. Rows sit 2 px apart in a rounded group (a `.pick-list`
  // in the parent), never with dividers (D-18). Without `chosen` it is a plain action, not a toggle.
  import type { HTMLButtonAttributes } from 'svelte/elements';

  let {
    label,
    sub,
    chosen,
    ...button
  }: { label: string; sub?: string; chosen?: boolean } & HTMLButtonAttributes = $props();
</script>

<button type="button" class="pick cn-tap" aria-pressed={chosen} {...button}>
  <span class="text">
    <span class="name">{label}</span>
    {#if sub}<span class="sub">{sub}</span>{/if}
  </span>
  {#if chosen}
    <svg
      width="20"
      height="20"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      stroke-width="2.4"
      stroke-linecap="round"
      stroke-linejoin="round"
      aria-hidden="true"><path d="M5 12.5l4.5 4.5L19 7.5" /></svg
    >
  {/if}
</button>

<style>
  .pick {
    display: flex;
    align-items: center;
    gap: var(--space-3);
    width: 100%;
    min-height: 56px;
    flex: none;
    padding: 0 14px;
    border: none;
    background: var(--surface-sheet-field);
    color: var(--ink);
    text-align: left;
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
    font-weight: 500;
  }

  .pick[aria-pressed='true'] .name {
    font-weight: 700;
  }

  .sub {
    font-size: 13px;
    color: var(--ink-muted);
  }

  svg {
    flex: none;
    color: var(--amber);
  }
</style>
