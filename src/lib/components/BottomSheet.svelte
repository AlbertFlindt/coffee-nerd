<script lang="ts">
  // A bottom sheet over a dimmed screen; tapping the dimmed part closes it (D-21). Placed inside the area
  // above the Save button, so the sheet stops above it and Save stays usable.
  import type { Snippet } from 'svelte';

  let {
    label,
    closeLabel,
    onclose,
    children
  }: { label: string; closeLabel: string; onclose: () => void; children: Snippet } = $props();
</script>

<svelte:window onkeydown={(e) => e.key === 'Escape' && onclose()} />

<div class="layer">
  <button type="button" class="cn-scrim scrim" aria-label={closeLabel} onclick={onclose}></button>
  <section class="cn-sheet sheet" aria-label={label}>
    <div class="cn-sheet__handle"></div>
    {@render children()}
  </section>
</div>

<style>
  .layer {
    position: absolute;
    inset: 0;
    z-index: 10;
  }

  .scrim {
    position: absolute;
    inset: 0;
    width: 100%;
    border: none;
    padding: 0;
  }

  .sheet {
    position: absolute;
    left: 0;
    right: 0;
    top: 96px;
    bottom: 0;
    overflow: hidden;
  }
</style>
