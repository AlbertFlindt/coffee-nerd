<script lang="ts">
  // Time vs. yield on Home (built without a design; screen 6 draws only its chip): the bean's last
  // 30 shots with a time and a yield, time across and yield up. Shots scored 8 or more are amber
  // (your scores), the rest secondary, the last shot the larger point as on Dial-in. The graph fills
  // the height Home leaves it. Tapping a point shows its numbers; tapping it again opens that shot,
  // whose Back returns to Home.
  import { goto } from '$app/navigation';
  import { resolve } from '$app/paths';
  import { decimalText } from '../domain/insights';
  import type { TimeYieldGraph } from '../domain/home';

  let { graph }: { graph: TimeYieldGraph } = $props();

  let width = $state(0);
  let height = $state(0);
  let chosen: number | null = $state(null);
  const choose = (i: number) => {
    if (chosen === i) goto(resolve('/journal/[id]?from=home', { id: graph.points[i].shotId }));
    else chosen = i;
  };

  // Room for the yield labels on the left and the time labels under the plot.
  const LEFT = 34;
  const RIGHT = 10;
  const TOP = 8;
  const BOTTOM = 22;

  const x = (time: number) =>
    LEFT + ((time - graph.time.from) / (graph.time.to - graph.time.from)) * (width - RIGHT - LEFT);
  const y = (grams: number) =>
    TOP +
    ((graph.yield.to - grams) / (graph.yield.to - graph.yield.from)) * (height - BOTTOM - TOP);
  const last = $derived(graph.points.length - 1);
  const describe = (p: TimeYieldGraph['points'][number]) =>
    `${decimalText(p.time)} s, ${decimalText(p.yield)} g, ` +
    (p.score === null ? 'not rated' : `score ${p.score}`);
  const label = $derived(
    `Yield against time for the last ${graph.points.length} shots, oldest first: ` +
      graph.points.map(describe).join('; ')
  );
</script>

<div class="plot" bind:clientWidth={width} bind:clientHeight={height}>
  {#if width > 0 && height > 0}
    <svg {width} {height} viewBox="0 0 {width} {height}" role="img" aria-label={label}>
      {#each graph.yield.ticks as tick (tick)}
        <line class="grid" x1={LEFT} y1={y(tick)} x2={width - RIGHT} y2={y(tick)} />
        <text class="caption" x="0" y={y(tick) + 4}>{tick} g</text>
      {/each}
      {#each graph.time.ticks as tick (tick)}
        <line class="grid" x1={x(tick)} y1={TOP} x2={x(tick)} y2={height - BOTTOM} />
        <text class="caption" x={x(tick)} y={height - 4} text-anchor="middle">{tick} s</text>
      {/each}
      {#each graph.points as p, i (p.shotId)}
        <circle
          class:liked={p.liked}
          class:last={i === last}
          class="dot"
          cx={x(p.time)}
          cy={y(p.yield)}
          r={i === last ? 6 : 4.5}
        />
      {/each}
      {#each graph.points as p, i (p.shotId)}
        <circle
          class="hit"
          cx={x(p.time)}
          cy={y(p.yield)}
          r="14"
          role="button"
          tabindex="0"
          aria-label="{describe(p)}{chosen === i ? ', tap again to open it' : ''}"
          aria-pressed={chosen === i}
          onclick={() => choose(i)}
          onkeydown={(e) => {
            if (e.key === 'Enter' || e.key === ' ') {
              e.preventDefault();
              choose(i);
            }
          }}
        />
      {/each}
      {#if chosen !== null}
        {@const p = graph.points[chosen]}
        {@const text = `${decimalText(p.time)} s · ${decimalText(p.yield)} g${p.score === null ? '' : ` · Score ${p.score}`}`}
        {@const tipWidth = text.length * 6.4 + 30}
        {@const tipX = Math.min(
          Math.max(x(p.time), LEFT + tipWidth / 2),
          width - RIGHT - tipWidth / 2
        )}
        {@const below = y(p.yield) - 30 < 0}
        {@const tipY = below ? y(p.yield) + 12 : y(p.yield) - 30}
        <!-- The chevron says a second tap opens the shot. -->
        <g class="tip" aria-hidden="true">
          <rect x={tipX - tipWidth / 2} y={tipY - 2} width={tipWidth} height="22" rx="6" />
          <text x={tipX - 6} y={tipY + 13} text-anchor="middle">{text}</text>
          <path class="chevron" d="M{tipX + tipWidth / 2 - 13} {tipY + 5}l4 4-4 4" />
        </g>
      {/if}
    </svg>
  {/if}
</div>
<div class="legend">
  <span class="key"><span class="swatch liked"></span>Score 8 or more</span>
  <span class="key"><span class="swatch"></span>Other shots</span>
</div>

<style>
  .plot {
    flex: 1;
    min-height: 0;
  }

  svg {
    display: block;
  }

  .grid {
    stroke: var(--chart-grid);
    stroke-width: 1;
  }

  .caption {
    fill: var(--ink-muted);
    font-size: 11px;
  }

  .dot {
    fill: var(--chart-secondary);
  }

  .dot.liked {
    fill: var(--amber);
  }

  .dot.last {
    stroke: var(--surface);
    stroke-width: 2;
  }

  .hit {
    fill: transparent;
    outline: none;
    cursor: pointer;
  }

  .hit:focus-visible {
    stroke: var(--ink-muted);
    stroke-width: 1.5;
  }

  .tip rect {
    fill: var(--control);
  }

  .tip .chevron {
    fill: none;
    stroke: var(--ink-muted);
    stroke-width: 2;
    stroke-linecap: round;
    stroke-linejoin: round;
  }

  .tip text {
    fill: var(--ink);
    font-size: 12px;
    font-weight: 600;
  }

  .legend {
    display: flex;
    gap: var(--space-4);
    font-size: 12px;
    color: var(--ink-muted);
  }

  .key {
    display: inline-flex;
    align-items: center;
    gap: 6px;
  }

  .swatch {
    width: 10px;
    height: 10px;
    border-radius: 5px;
    background: var(--chart-secondary);
  }

  .swatch.liked {
    background: var(--amber);
  }
</style>
