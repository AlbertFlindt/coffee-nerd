<script lang="ts">
  // A confirmation in the middle of the screen, over all of it, Save included, so only its two choices
  // show (D-241). Tapping the dimmed screen or Escape closes it, as for a bottom sheet (D-21).
  import type { Snippet } from 'svelte';
  import { cubicOut } from 'svelte/easing';
  import { fade, scale } from 'svelte/transition';

  let {
    label,
    closeLabel,
    onclose,
    children
  }: {
    label: string;
    closeLabel: string;
    onclose: () => void;
    children: Snippet;
  } = $props();

  const reducedMotion =
    typeof matchMedia === 'function' && matchMedia('(prefers-reduced-motion: reduce)').matches;
  const duration = reducedMotion ? 0 : 200;
</script>

<svelte:window onkeydown={(e) => e.key === 'Escape' && onclose()} />

<div class="layer">
  <button
    type="button"
    class="cn-scrim scrim"
    aria-label={closeLabel}
    onclick={onclose}
    transition:fade={{ duration }}
  ></button>
  <div
    class="cn-dialog dialog"
    role="dialog"
    aria-modal="true"
    aria-label={label}
    transition:scale={{ start: 0.95, duration, easing: cubicOut }}
  >
    {@render children()}
  </div>
</div>

<style>
  .layer {
    position: fixed;
    inset: 0;
    z-index: 10;
    display: flex;
    align-items: center;
    justify-content: center;
    padding: 0 var(--space-4);
  }

  .scrim {
    position: absolute;
    inset: 0;
    width: 100%;
    border: none;
    padding: 0;
  }

  .dialog {
    position: relative;
    width: 100%;
  }
</style>
