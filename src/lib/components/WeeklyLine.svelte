<script lang="ts">
  // The weekly line (screen 24, D-56): the average score per week with a ± 1 σ band, so the line rising
  // reads as better and the band narrowing as steadier. Score is amber (D-19). A week with too few rated
  // shots is a gap, never 0 (D-11, D-212). Tapping a week shows its numbers (D-56, built plainly, D-207).
  import { roastDateText } from '../domain/bean';
  import { statText, type Chart, type WeekPoint, type WeekStats } from '../domain/insights';

  let { chart }: { chart: Extract<Chart, { kind: 'weekly' }> } = $props();

  // Screen 24: score labels left of a plot from 24 px, 10 px of room at the right for the last dot.
  const LEFT = 24;
  const RIGHT = 10;
  const TOP = 10;
  const BOTTOM = 150;
  const HEIGHT = 176;
  let width = $state(0);
  let chosen: number | null = $state(null);

  const step = $derived((width - LEFT - RIGHT) / Math.max(1, chart.points.length - 1));
  const x = (i: number) => LEFT + step * i;
  const y = (score: number) =>
    BOTTOM - ((score - chart.axis.from) / (chart.axis.to - chart.axis.from)) * (BOTTOM - TOP);

  /** Runs of weeks with a point; a gap ends a run (D-212). */
  const runs = $derived.by(() => {
    const result: { i: number; p: WeekStats }[][] = [];
    let run: { i: number; p: WeekStats }[] = [];
    chart.points.forEach(({ stats }, i) => {
      if (stats === null) {
        if (run.length > 0) result.push(run);
        run = [];
      } else run.push({ i, p: stats });
    });
    if (run.length > 0) result.push(run);
    return result;
  });
  const latest = $derived(runs.at(-1)?.at(-1));

  const weekName = (week: string) => `Week of ${roastDateText(week, week).date}`;
  const describe = ({ week, stats }: WeekPoint) =>
    stats === null
      ? `${weekName(week)}: fewer than 2 rated shots`
      : `${weekName(week)}: average ${statText(stats.mean)}, standard deviation ${statText(stats.sigma)}, ${stats.n} shots`;
  const label = $derived(
    `Weekly average ${chart.measure.toLowerCase()} with one standard deviation, ${chart.first.toLowerCase()} to ${chart.last.toLowerCase()}. ` +
      chart.points.map(describe).join('; ')
  );
</script>

<div class="chart" bind:clientWidth={width}>
  {#if width > 0}
    <svg {width} height={HEIGHT} viewBox="0 0 {width} {HEIGHT}" role="img" aria-label={label}>
      {#each chart.axis.ticks as tick (tick)}
        <line class="grid" x1={LEFT} y1={y(tick)} x2={width - RIGHT} y2={y(tick)} />
        <text class="tick" x="0" y={y(tick) + 4}>{tick}</text>
      {/each}
      {#each runs as run (run[0].i)}
        {#if run.length > 1}
          <polygon
            class="band"
            points={[
              ...run.map(({ i, p }) => `${x(i)},${y(p.mean + p.sigma)}`),
              ...run.toReversed().map(({ i, p }) => `${x(i)},${y(p.mean - p.sigma)}`)
            ].join(' ')}
          />
          <polyline class="line" points={run.map(({ i, p }) => `${x(i)},${y(p.mean)}`).join(' ')} />
        {:else}
          <line
            class="band-alone"
            x1={x(run[0].i)}
            y1={y(run[0].p.mean + run[0].p.sigma)}
            x2={x(run[0].i)}
            y2={y(run[0].p.mean - run[0].p.sigma)}
          />
          <circle class="alone" cx={x(run[0].i)} cy={y(run[0].p.mean)} r="2.5" />
        {/if}
      {/each}
      {#if latest}
        <circle class="latest" cx={x(latest.i)} cy={y(latest.p.mean)} r="5" />
      {/if}
      <text class="tick" x={LEFT} y={HEIGHT - 4}>{chart.first}</text>
      <text class="tick" x={width - RIGHT} y={HEIGHT - 4} text-anchor="end">{chart.last}</text>
    </svg>
    {#each chart.points as p, i (p.week)}
      <button
        type="button"
        class="hit"
        style:left="{x(i) - step / 2}px"
        style:width="{step}px"
        aria-label={describe(p)}
        aria-pressed={chosen === i}
        onclick={() => (chosen = chosen === i ? null : i)}
      ></button>
    {/each}
    {#if chosen !== null}
      <div class="tip" style:top="{BOTTOM + 2}px" aria-hidden="true">
        {describe(chart.points[chosen])}
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

  .band {
    fill: var(--amber);
    fill-opacity: 0.16;
  }

  .band-alone {
    stroke: var(--amber);
    stroke-opacity: 0.3;
    stroke-width: 6;
  }

  .line {
    fill: none;
    stroke: var(--amber);
    stroke-width: 2;
    stroke-linejoin: round;
  }

  .alone {
    fill: var(--amber);
  }

  .latest {
    fill: var(--amber);
    stroke: var(--surface);
    stroke-width: 2;
  }

  .hit {
    position: absolute;
    top: 0;
    height: 160px;
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
