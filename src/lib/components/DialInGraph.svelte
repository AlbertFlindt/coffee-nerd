<script lang="ts">
  // Dial-in progress on Home (screen 6, D-196): the score of the bean's last 12 rated shots, oldest on the
  // left, the last shot as the larger point, and a cherry dashed line where a new recipe starts (D-19:
  // cherry is recipe history, amber your scores). The graph fills the height Home leaves it (D-32, D-36).
  // Tapping a point shows its exact score (D-56: every chart gets a tap tooltip).
  import type { DialInGraph } from '../domain/home';

  let { graph }: { graph: DialInGraph } = $props();

  let width = $state(0);
  let chosen: number | null = $state(null);
  const choose = (i: number) => (chosen = chosen === i ? null : i);
  let height = $state(0);

  // Room for the score labels on the left and the two captions under the plot, as on screen 6.
  const LEFT = 24;
  const RIGHT = 8;
  const TOP = 12;
  const BOTTOM = 22;
  const LAST_INSET = 11;

  const [low, , high] = $derived(graph.ticks);
  const step = $derived((high - low) / 2);
  const range = $derived({ from: low - 0.7 * step, to: high + 0.2 * step });
  const plotBottom = $derived(height - BOTTOM);
  const y = (score: number) =>
    TOP + ((range.to - score) / (range.to - range.from)) * (plotBottom - TOP);
  const x = (i: number) =>
    LEFT + (i * (width - RIGHT - LAST_INSET - LEFT)) / (graph.points.length - 1);
  const line = $derived(graph.points.map((p, i) => `${x(i)},${y(p.score)}`).join(' '));
  const label = $derived(
    `Score per shot, oldest first: ${graph.points.map((p) => p.score).join(', ')}` +
      (graph.points.some((p) => p.newRecipe)
        ? `; a new recipe at shot ${graph.points
            .flatMap((p, i) => (p.newRecipe ? [i + 1] : []))
            .join(' and ')}`
        : '')
  );
</script>

<div class="plot" bind:clientWidth={width} bind:clientHeight={height}>
  {#if width > 0 && height > 0}
    <svg {width} {height} viewBox="0 0 {width} {height}" role="img" aria-label={label}>
      {#each graph.ticks as tick (tick)}
        <line class="grid" x1={LEFT} y1={y(tick)} x2={width - RIGHT} y2={y(tick)} />
        <text class="caption" x="4" y={y(tick) + 4}>{tick}</text>
      {/each}
      {#each graph.points as p, i (i)}
        {#if p.newRecipe}
          <line class="recipe" x1={x(i)} y1={TOP} x2={x(i)} y2={plotBottom} />
        {/if}
      {/each}
      <polyline class="score" points={line} />
      {#each graph.points as p, i (i)}
        {#if i === graph.points.length - 1}
          <circle class="last" cx={x(i)} cy={y(p.score)} r="6" />
        {:else}
          <circle class="dot" cx={x(i)} cy={y(p.score)} r="3.5" />
        {/if}
      {/each}
      {#each graph.points as p, i (i)}
        <circle
          class="hit"
          cx={x(i)}
          cy={y(p.score)}
          r="16"
          role="button"
          tabindex="0"
          aria-label="Shot {i + 1} of {graph.points.length}, score {p.score}"
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
        {@const tipX = Math.min(Math.max(x(chosen), LEFT + 30), width - RIGHT - 30)}
        {@const tipY = Math.max(y(p.score) - 30, 2)}
        <g class="tip" aria-hidden="true">
          <rect x={tipX - 30} y={tipY - 2} width="60" height="22" rx="6" />
          <text x={tipX} y={tipY + 13} text-anchor="middle">Score {p.score}</text>
        </g>
      {/if}
      <text class="caption" x={LEFT} y={height - 4}>{graph.points.length} rated shots ago</text>
      <text class="caption" x={width - RIGHT} y={height - 4} text-anchor="end">Last shot</text>
    </svg>
  {/if}
</div>
<div class="legend">
  <span class="key"><span class="swatch"></span>Score</span>
  <span class="key"><span class="dash"></span>New recipe</span>
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

  .recipe {
    stroke: var(--cherry);
    stroke-width: 1.5;
    stroke-dasharray: 3 3;
  }

  .score {
    fill: none;
    stroke: var(--amber);
    stroke-width: 2;
    stroke-linejoin: round;
  }

  .dot {
    fill: var(--amber);
  }

  .last {
    fill: var(--amber);
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
    background: var(--amber);
  }

  .dash {
    width: 0;
    height: 12px;
    border-left: 2px dashed var(--cherry);
  }
</style>
