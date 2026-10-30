<script lang="ts">
  // What happened to the shot just saved, as a short bar just above the tab bar: "Shot saved"
  // fades after 4 seconds; when the shot finished the bean the bar offers Undo and stays 10 seconds,
  // and "… is open again" after Undo shows the same way. Built without a design.
  // The page passes the message once; a later load without one leaves the bar to finish on its own.
  import { onDestroy } from 'svelte';
  import type { Origin } from '../domain/origin';
  import type { Flash } from '../server/flash';

  let { flash, from }: { flash: Flash | null; from: Origin } = $props();

  const STAY = 4000;
  const STAY_WITH_UNDO = 10000;
  const FADE = 300;

  let shown: Flash | null = $state(null);
  let leaving = $state(false);
  let timers: ReturnType<typeof setTimeout>[] = [];
  const clear = () => timers.forEach(clearTimeout);

  $effect(() => {
    if (!flash) return;
    clear();
    shown = flash;
    leaving = false;
    const stay = flash.kind === 'finished' ? STAY_WITH_UNDO : STAY;
    timers = [
      setTimeout(() => (leaving = true), stay),
      setTimeout(() => (shown = null), stay + FADE)
    ];
  });
  onDestroy(clear);
</script>

<div class="anchor" role="status">
  {#if shown}
    <div class="bar" class:leaving>
      {#if shown.kind === 'saved'}
        <span>Shot saved</span>
      {:else if shown.kind === 'finished'}
        <span>Shot saved. {shown.beanName} is finished: its bag is used up.</span>
        <form method="POST" action="/?/undoFinish">
          <input type="hidden" name="beanId" value={shown.beanId} />
          <input type="hidden" name="from" value={from} />
          <button type="submit" class="undo cn-tap">Undo</button>
        </form>
      {:else}
        <span>{shown.beanName} is open again</span>
      {/if}
    </div>
  {/if}
</div>

<style>
  /* Cream like the design system's highlighted card, so it stands out from the cards under it. Above the
     tab bar, over the page: the screen keeps its layout and the bar covers neither the
     bean pill nor the Journal filters. */
  .anchor {
    position: fixed;
    left: var(--space-5);
    right: var(--space-5);
    bottom: calc(var(--tabbar-h) + var(--space-2));
    z-index: 2;
    pointer-events: none;
  }

  .bar {
    display: flex;
    align-items: center;
    gap: var(--space-3);
    min-height: var(--touch-min);
    padding: var(--space-2) var(--space-2) var(--space-2) var(--space-4);
    border-radius: var(--radius-md);
    background: var(--cream);
    color: var(--on-cream);
    font-size: 15px;
    font-weight: 600;
    pointer-events: auto;
    transition: opacity 300ms ease-out;
  }

  .bar.leaving {
    opacity: 0;
  }

  .bar span {
    flex: 1;
  }

  .undo {
    height: var(--touch-min);
    padding: 0 var(--space-4);
    border: none;
    border-radius: var(--radius-pill);
    background: transparent;
    color: var(--on-cream);
    font-size: 15px;
    font-weight: 700;
  }

  @media (prefers-reduced-motion: reduce) {
    .bar {
      transition: none;
    }
  }
</style>
