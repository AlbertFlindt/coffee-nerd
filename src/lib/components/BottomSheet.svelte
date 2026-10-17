<script lang="ts">
  // A bottom sheet over a dimmed screen; tapping the dimmed part closes it (D-21). Placed inside the area
  // above the Save button, so the sheet stops above it and Save stays usable. It slides in and out, and
  // dragging its handle down closes it (D-108).
  import type { Snippet } from 'svelte';
  import { cubicOut } from 'svelte/easing';
  import { fade, fly } from 'svelte/transition';

  let {
    label,
    closeLabel,
    onclose,
    children
  }: { label: string; closeLabel: string; onclose: () => void; children: Snippet } = $props();

  /** Pixels dragged down past which letting go closes the sheet; shorter drags spring back. */
  const CLOSE_AFTER = 80;
  const reducedMotion =
    typeof matchMedia === 'function' && matchMedia('(prefers-reduced-motion: reduce)').matches;
  const duration = reducedMotion ? 0 : 240;

  let sheet: HTMLElement | undefined = $state();
  let dragFrom: number | null = $state(null);
  let dragged = $state(0);

  function onpointerdown(e: PointerEvent) {
    (e.currentTarget as HTMLElement).setPointerCapture(e.pointerId);
    dragFrom = e.clientY;
    dragged = 0;
  }

  function onpointermove(e: PointerEvent) {
    if (dragFrom !== null) dragged = Math.max(0, e.clientY - dragFrom);
  }

  function onpointerup() {
    if (dragFrom === null) return;
    dragFrom = null;
    if (dragged > CLOSE_AFTER) onclose();
    else dragged = 0;
  }
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
  <section
    bind:this={sheet}
    class="cn-sheet sheet"
    class:dragging={dragFrom !== null}
    aria-label={label}
    style:transform={dragged > 0 ? `translateY(${dragged}px)` : undefined}
    transition:fly={{ y: sheet?.offsetHeight ?? 600, duration, easing: cubicOut }}
  >
    <!-- D-108: the handle and the strip around it can be dragged down to close; Escape and tapping
         outside do the same for keyboards and screen readers. -->
    <div
      class="grip"
      aria-hidden="true"
      {onpointerdown}
      {onpointermove}
      {onpointerup}
      onpointercancel={onpointerup}
    >
      <div class="cn-sheet__handle"></div>
    </div>
    {@render children()}
  </section>
</div>

<style>
  .layer {
    position: absolute;
    inset: 0;
    z-index: 10;
    /* The sheet slides in from below; nothing of it shows outside the area above Save. */
    overflow: hidden;
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
    transition: transform 200ms ease-out;
  }

  .sheet.dragging {
    transition: none;
  }

  /*
   * A 44 px strip at the top of the sheet with the handle in its middle, so the handle has room above
   * and below it (owner feedback) and the whole strip can be dragged (D-108).
   */
  .grip {
    flex: none;
    display: flex;
    justify-content: center;
    align-items: center;
    height: var(--touch-min);
    /* From the sheet's top edge (its 10px top padding) to the content, which follows after the gap. */
    margin: -10px calc(-1 * var(--space-5)) calc(-1 * var(--space-3));
    touch-action: none;
    cursor: grab;
  }

  @media (prefers-reduced-motion: reduce) {
    .sheet {
      transition: none;
    }
  }

  /* D-36: on a short screen the sheet starts higher, so its content keeps room. */
  @media (max-height: 760px) {
    .sheet {
      top: 48px;
    }
  }
</style>
