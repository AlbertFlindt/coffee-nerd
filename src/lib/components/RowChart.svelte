<script lang="ts" generics="Row extends { label: string; right: string; tip: string }">
  // The frame of Insights' row charts (screens 23 and 25): a label per row on the left, the value
  // axis with its faint grid, a figure at the right of each row, and the mark each chart draws. Tapping
  // a row shows its exact numbers (the tooltip is built without a design).
  import type { Snippet } from 'svelte';
  import type { Axis } from '../domain/insights';

  let {
    rows,
    axis,
    label,
    spacing,
    gridTop,
    plotLeft = 53,
    plotRight,
    rightSize,
    mark
  }: {
    rows: Row[];
    axis: Axis;
    /** What the chart shows, for screen readers. */
    label: string;
    /** Row centres are this far apart; the first sits `spacing / 2 + gridTop` down (screens 23, 25). */
    spacing: number;
    gridTop: number;
    /** Where the plot starts, after the labels: further in for longer labels (screen 25). */
    plotLeft?: number;
    /** Room left of the right edge for the figures (n 38, ±0.7). */
    plotRight: number;
    rightSize: number;
    mark: Snippet<[Row, (value: number) => number, number]>;
  } = $props();

  let width = $state(0);
  let chosen: number | null = $state(null);

  const gridBottom = $derived(gridTop + spacing * rows.length);
  const height = $derived(gridBottom + 26);
  const x = (value: number) =>
    plotLeft + ((value - axis.from) / (axis.to - axis.from)) * (width - plotRight - plotLeft);
  const centre = (i: number) => gridTop + spacing / 2 + spacing * i;
  const choose = (i: number) => (chosen = chosen === i ? null : i);
</script>

<div class="chart" bind:clientWidth={width}>
  {#if width > 0}
    <svg {width} {height} viewBox="0 0 {width} {height}" role="img" aria-label={label}>
      {#each axis.ticks as tick (tick)}
        <line class="grid" x1={x(tick)} y1={gridTop} x2={x(tick)} y2={gridBottom} />
        <text class="tick" x={x(tick)} y={gridBottom + 16} text-anchor="middle"
          >{tick}{axis.unit ? ` ${axis.unit}` : ''}</text
        >
      {/each}
      {#each rows as row, i (row.label)}
        <text class="name" x="0" y={centre(i) + 4}>{row.label}</text>
        {@render mark(row, x, centre(i))}
        <text class="figure" x={width} y={centre(i) + 4} text-anchor="end" font-size={rightSize}
          >{row.right}</text
        >
      {/each}
    </svg>
    {#each rows as row, i (row.label)}
      <button
        type="button"
        class="hit"
        style:top="{centre(i) - spacing / 2}px"
        style:height="{spacing}px"
        aria-label={row.tip}
        aria-pressed={chosen === i}
        onclick={() => choose(i)}
      ></button>
    {/each}
    {#if chosen !== null}
      <div class="tip" style:top="{centre(chosen) + 14}px" aria-hidden="true">
        {rows[chosen].tip}
      </div>
    {/if}
  {/if}
</div>

<style>
  .chart {
    position: relative;
  }

  svg {
    display: block;
  }

  .grid {
    stroke: var(--chart-grid);
    stroke-width: 1;
  }

  .tick {
    fill: var(--ink-muted);
    font-size: 11px;
  }

  .name {
    fill: var(--cream);
    font-size: 13px;
    font-weight: 600;
  }

  .figure {
    fill: var(--ink-muted);
  }

  /* A row is a 34–40 px band across the whole chart; the card around it adds to the 44 px target. */
  .hit {
    position: absolute;
    left: 0;
    right: 0;
    padding: 0;
    border: none;
    border-radius: var(--radius-sm);
    background: transparent;
  }

  .hit:focus-visible {
    outline: 1.5px solid var(--ink-muted);
  }

  .tip {
    position: absolute;
    left: 0;
    right: 0;
    z-index: 1;
    padding: 6px 10px;
    border-radius: var(--radius-sm);
    background: var(--control);
    color: var(--ink);
    font-size: 12px;
    font-weight: 600;
    line-height: 1.4;
    pointer-events: none;
  }
</style>
