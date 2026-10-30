<script lang="ts">
  // A taste slider: starts empty, tap or slide to set whole numbers, the value
  // as words next to the title, "Clear" to empty it again.
  import { tasteWords, type TasteScale } from '../domain/taste';

  let {
    scale,
    title,
    ariaLabel,
    ends,
    value,
    min,
    max,
    onchange,
    heading = 'h2'
  }: {
    scale: TasteScale;
    title: string;
    ariaLabel: string;
    /** Words under the track: two ends, or three with the middle and a centre mark. */
    ends: string[];
    value: number | null;
    min: number;
    max: number;
    onchange: (value: number | null) => void;
    /** h3 in the Tasting sheet, which also says "Not set" while empty (MoreTasting); h2 on a page. */
    heading?: 'h2' | 'h3';
  } = $props();

  let track: HTMLDivElement | undefined = $state();
  const words = $derived(tasteWords(scale, value));
  const percent = (v: number) => ((v - min) / (max - min)) * 100;

  function valueAt(clientX: number): number {
    const box = track!.getBoundingClientRect();
    const share = Math.min(1, Math.max(0, (clientX - box.left) / box.width));
    return Math.round(min + share * (max - min));
  }

  function onpointerdown(e: PointerEvent) {
    track!.setPointerCapture(e.pointerId);
    onchange(valueAt(e.clientX));
  }

  function onpointermove(e: PointerEvent) {
    if (track!.hasPointerCapture(e.pointerId)) {
      const next = valueAt(e.clientX);
      if (next !== value) onchange(next);
    }
  }

  function onkeydown(e: KeyboardEvent) {
    const start = value ?? Math.round((min + max) / 2);
    const moves: Record<string, number> = {
      ArrowLeft: -1,
      ArrowDown: -1,
      ArrowRight: 1,
      ArrowUp: 1
    };
    if (e.key in moves) {
      e.preventDefault();
      onchange(Math.min(max, Math.max(min, value === null ? start : start + moves[e.key])));
    }
  }
</script>

<div class="taste" class:in-sheet={heading === 'h3'}>
  <div class="head">
    <svelte:element this={heading} class="title" class:small={heading === 'h3'}
      >{title}</svelte:element
    >
    {#if value !== null || heading === 'h3'}
      <span class="words" class:small={heading === 'h3'}>{words}</span>
    {/if}
    {#if value !== null}
      <button type="button" class="clear cn-tap" onclick={() => onchange(null)}>
        Clear<span class="hidden"> {title.toLowerCase()}</span>
      </button>
    {/if}
  </div>
  <div
    bind:this={track}
    class="track"
    role="slider"
    tabindex="0"
    aria-label={ariaLabel}
    aria-valuemin={min}
    aria-valuemax={max}
    aria-valuenow={value ?? undefined}
    aria-valuetext={words}
    {onpointerdown}
    {onpointermove}
    {onkeydown}
  >
    <div class="rail"></div>
    {#if ends.length === 3}
      <div class="middle"></div>
    {/if}
    {#if value !== null}
      <div class="handle" style:left="{percent(value)}%"></div>
    {:else}
      <!-- Nothing set yet; a hollow dashed handle in the middle shows where to tap or drag. -->
      <div class="handle cn-slider-handle--empty" style:left="50%"></div>
    {/if}
  </div>
  <div class="ends cn-label" class:three={ends.length === 3}>
    {#each ends as end (end)}<span>{end}</span>{/each}
  </div>
</div>

<style>
  .taste {
    display: flex;
    flex-direction: column;
    gap: var(--space-2);
    /* The rail sits one step darker than what is behind it: the page or the sheet. */
    --rail: var(--taste-rail, var(--surface));
    --behind: var(--taste-behind, var(--bg));
  }

  .in-sheet {
    gap: var(--space-1);
  }

  .head {
    display: flex;
    align-items: baseline;
    gap: var(--space-2);
    min-height: 22px;
  }

  .title {
    flex: 1;
    margin: 0;
    font-size: 16px;
    font-weight: 600;
  }

  .title.small {
    font-size: 15px;
  }

  .words {
    font-size: 14px;
    color: var(--ink-muted);
  }

  .words.small {
    font-size: 13px;
  }

  .clear {
    height: 22px;
    padding: 0 var(--space-2);
    margin-right: calc(-1 * var(--space-2));
    border: none;
    border-radius: var(--radius-pill);
    background: transparent;
    color: var(--ink-soft);
    font-size: 13px;
    font-weight: 600;
    position: relative;
  }

  /* A 44 px touch target around the small text (CLAUDE.md). */
  .clear::after {
    content: '';
    position: absolute;
    inset: -11px -4px;
  }

  .hidden {
    position: absolute;
    width: 1px;
    height: 1px;
    overflow: hidden;
    clip-path: inset(50%);
  }

  /* The track is the whole touch target, so it is never shorter than 44 px. */
  .track {
    position: relative;
    height: var(--touch-min);
    display: flex;
    align-items: center;
    touch-action: none;
    cursor: pointer;
  }

  .track:focus-visible {
    outline: 2px solid var(--amber);
    outline-offset: 2px;
    border-radius: var(--radius-sm);
  }

  .rail {
    position: absolute;
    left: 0;
    right: 0;
    height: 8px;
    border-radius: 4px;
    background: var(--rail);
  }

  .middle {
    position: absolute;
    left: 50%;
    width: 4px;
    height: 16px;
    margin-left: -2px;
    border-radius: 2px;
    background: var(--line);
  }

  .handle {
    position: absolute;
    width: 28px;
    height: 28px;
    margin-left: -14px;
    border-radius: 14px;
    background: var(--amber);
    border: 4px solid var(--behind);
  }

  /* The empty look comes from the design system (cn-slider-handle--empty); this wins over .handle. */
  .handle.cn-slider-handle--empty {
    background: transparent;
    border: 1.5px dashed var(--ink-muted);
    width: 24px;
    height: 24px;
    margin-left: -12px;
  }

  .ends {
    display: flex;
    justify-content: space-between;
    margin-top: -8px;
  }

  /* The middle word sits under the centre mark, whatever the width of the end words. */
  .ends.three {
    display: grid;
    grid-template-columns: 1fr auto 1fr;
  }

  .ends.three > :last-child {
    text-align: right;
  }

  /* Tighter around the track on shorter screens; the track keeps its 44 px. */
  @media (max-height: 880px) {
    .taste {
      gap: 0;
    }

    .ends {
      margin-top: -10px;
    }
  }
</style>
