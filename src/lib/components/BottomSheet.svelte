<script lang="ts">
  // A bottom sheet over a dimmed screen; tapping the dimmed part closes it. Placed inside the area
  // above the Save button, so the sheet stops above it and Save stays usable. It slides in and out.
  // Dragging its handle down closes it, so does swiping down anywhere on it while its content is
  // scrolled to the top, and so does the phone's back gesture.
  import { onMount, type Snippet } from 'svelte';
  import { cubicOut } from 'svelte/easing';
  import { fade, fly } from 'svelte/transition';
  import { closeOnBack } from '#lib/back-closes.ts';

  let {
    label,
    closeLabel,
    onclose,
    short = false,
    children
  }: {
    label: string;
    closeLabel: string;
    onclose: () => void;
    /** As tall as its content, for a sheet with one control (the Rate sheet). */
    short?: boolean;
    children: Snippet;
  } = $props();

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

  onMount(() => closeOnBack(() => onclose()));

  /** Fingers moved less than this are still a tap. */
  const SLOP = 8;

  /** Whether a swipe down from `target` belongs to the sheet: not to a field, a slider or a list that can scroll up. */
  function swipesSheet(target: EventTarget | null): boolean {
    for (let el = target as HTMLElement | null; el && el !== sheet; el = el.parentElement) {
      if (el.matches('input, textarea, select, [contenteditable]')) return false;
      const style = getComputedStyle(el);
      if (style.touchAction === 'none') return false;
      if (el.scrollTop > 0 && /auto|scroll/.test(style.overflowY)) return false;
    }
    return true;
  }

  // Swiping the content down: touch events, which keep coming while the browser scrolls, and
  // which can stop the browser once the swipe is the sheet's. The handle's strip has its own above.
  function swipeDown(node: HTMLElement) {
    let from: { x: number; y: number } | null = null;
    let ours = false;
    const start = (e: TouchEvent) => {
      const grip = (e.target as HTMLElement).closest('.cn-sheet__grip');
      from =
        e.touches.length === 1 && !grip
          ? { x: e.touches[0].clientX, y: e.touches[0].clientY }
          : null;
      ours = false;
    };
    const move = (e: TouchEvent) => {
      if (!from) return;
      const dx = e.touches[0].clientX - from.x;
      const dy = e.touches[0].clientY - from.y;
      if (!ours) {
        if (Math.abs(dx) < SLOP && Math.abs(dy) < SLOP) return;
        // Sideways, up, or on something that scrolls or slides: not the sheet's.
        if (dy <= Math.abs(dx) || !swipesSheet(e.target)) {
          from = null;
          return;
        }
        ours = true;
        dragFrom = from.y;
      }
      if (e.cancelable) e.preventDefault();
      dragged = Math.max(0, dy);
    };
    const end = () => {
      if (ours) onpointerup();
      from = null;
      ours = false;
    };
    node.addEventListener('touchstart', start, { passive: true });
    node.addEventListener('touchmove', move, { passive: false });
    node.addEventListener('touchend', end);
    node.addEventListener('touchcancel', end);
    return {
      destroy() {
        node.removeEventListener('touchstart', start);
        node.removeEventListener('touchmove', move);
        node.removeEventListener('touchend', end);
        node.removeEventListener('touchcancel', end);
      }
    };
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
    class:short
    aria-label={label}
    style:transform={dragged > 0 ? `translateY(${dragged}px)` : undefined}
    transition:fly={{ y: sheet?.offsetHeight ?? 600, duration, easing: cubicOut }}
    use:swipeDown
  >
    <!-- The handle and the strip around it can be dragged down to close; Escape and tapping
         outside do the same for keyboards and screen readers. -->
    <div
      class="cn-sheet__grip"
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

  /* As tall as its content, but never above where a full sheet starts: a long list scrolls. */
  .sheet.short {
    top: auto;
    max-height: calc(100% - 96px);
  }

  .sheet.dragging {
    transition: none;
  }

  @media (prefers-reduced-motion: reduce) {
    .sheet {
      transition: none;
    }
  }

  /* On a short screen the sheet starts higher, so its content keeps room. */
  @media (max-height: 760px) {
    .sheet {
      top: 48px;
    }
  }
</style>
