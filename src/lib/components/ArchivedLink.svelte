<script lang="ts">
  // The quiet "Archived" row at the end of Gear, Puck prep and Tags, shown while anything there is
  // archived.
  import { resolve } from '$app/paths';
  import type { ArchiveArea } from '#lib/server/db/archived.ts';

  let { area, count }: { area: ArchiveArea; count: number } = $props();
  const href = $derived(
    {
      gear: resolve('/library/gear/archived'),
      'puck-prep': resolve('/library/puck-prep/archived'),
      tags: resolve('/library/tags/archived')
    }[area]
  );
</script>

{#if count > 0}
  <a class="archived cn-btn-quiet cn-tap" {href}>
    Archived · {count}
    <svg
      width="16"
      height="16"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      stroke-width="2"
      stroke-linecap="round"
      aria-hidden="true"><path d="M9 6l6 6-6 6" /></svg
    >
  </a>
{/if}

<style>
  /* The quiet button pattern of "Delete bean", with a chevron. */
  .archived {
    flex: none;
    display: flex;
    align-items: center;
    justify-content: center;
    gap: var(--space-1);
    margin-top: var(--space-2);
    text-decoration: none;
  }
</style>
