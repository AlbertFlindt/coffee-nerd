<script lang="ts">
  // Offline, pages open as the phone kept them, and a line at the top says so. A change tried
  // offline says that nothing was changed.
  import { network } from '#lib/offline-status.svelte.ts';
</script>

{#if network.offline || network.message}
  <p class="offline cn-caption" role="status">
    {network.message ?? 'Offline: showing what the phone kept. Changes need a connection.'}
  </p>
{/if}

<style>
  .offline {
    flex-shrink: 0;
    margin: 0;
    padding: var(--space-2) var(--space-4);
    background: var(--surface);
    text-align: center;
  }
</style>
