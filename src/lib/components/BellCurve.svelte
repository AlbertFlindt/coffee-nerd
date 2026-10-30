<script lang="ts">
  // The bell curve (screen 24, under Dial-in): a histogram of shot time on one recipe with the
  // fitted normal curve, the average (μ) as a dashed line and the ± 1 σ zone behind it. Time is
  // cream, bars secondary. Tapping a bar shows its count (built plainly).
  import { decimalText, type Chart, type HistogramBin } from '../domain/insights';
  import { normalCurve } from '../domain/statistics';

  let { chart }: { chart: Extract<Chart, { kind: 'bell' }> } = $props();

  // Screen 24: 10 px either side, the baseline at 140 and room above for μ.
  const SIDE = 10;
  const TOP = 14;
  const BASE = 140;
  const HEIGHT = 166;
  let width = $state(0);
  let chosen: number | null = $state(null);

  const x = (value: number) =>
    SIDE + ((value - chart.axis.from) / (chart.axis.to - chart.axis.from)) * (width - 2 * SIDE);
  // One-second bins, so the curve's height in shots is n · 1 · density.
  const curve = $derived(
    normalCurve(chart.mean, chart.sigma, {
      from: chart.axis.from,
      to: chart.axis.to,
      points: 161,
      scale: chart.n
    })
  );
  // The tallest bar or the curve's peak, with a little room above.
  const top = $derived(
    Math.max(...chart.bins.map((b) => b.count), ...curve.map((p) => p.y)) / 0.92
  );
  const y = (count: number) => BASE - (count / top) * (BASE - TOP);

  const describe = (b: HistogramBin) =>
    `${decimalText(b.from)} to ${decimalText(b.to)} ${chart.unit}: ${b.count} ${b.count === 1 ? 'shot' : 'shots'}`;
  const label = $derived(
    `Distribution of ${chart.measure.toLowerCase()} on this recipe: ${chart.n} shots, average ` +
      `${decimalText(chart.mean)} ${chart.unit}, standard deviation ${decimalText(chart.sigma)} ${chart.unit}`
  );
</script>

<div class="chart" bind:clientWidth={width}>
  {#if width > 0}
    <svg {width} height={HEIGHT} viewBox="0 0 {width} {HEIGHT}" role="img" aria-label={label}>
      <rect
        class="zone"
        x={x(chart.mean - chart.sigma)}
        y={TOP}
        width={x(chart.mean + chart.sigma) - x(chart.mean - chart.sigma)}
        height={BASE - TOP}
      />
      {#each chart.bins as bin (bin.from)}
        {#if bin.count > 0}
          <rect
            class="bar"
            x={x(bin.from) + 1}
            y={y(bin.count)}
            width={x(bin.to) - x(bin.from) - 2}
            height={BASE - y(bin.count)}
            rx="3"
          />
        {/if}
      {/each}
      <polyline class="curve" points={curve.map((p) => `${x(p.x)},${y(p.y)}`).join(' ')} />
      <line class="mu" x1={x(chart.mean)} y1={TOP} x2={x(chart.mean)} y2={BASE} />
      <text class="mu-label" x={x(chart.mean) + 6} y={TOP + 10}>μ</text>
      <line class="grid" x1={SIDE} y1={BASE} x2={width - SIDE} y2={BASE} />
      {#each chart.axis.ticks as tick (tick)}
        <text class="tick" x={x(tick)} y={BASE + 16} text-anchor="middle">{tick} {chart.unit}</text>
      {/each}
    </svg>
    {#each chart.bins as bin, i (bin.from)}
      <button
        type="button"
        class="hit"
        style:left="{x(bin.from)}px"
        style:width="{x(bin.to) - x(bin.from)}px"
        aria-label={describe(bin)}
        aria-pressed={chosen === i}
        onclick={() => (chosen = chosen === i ? null : i)}
      ></button>
    {/each}
    {#if chosen !== null}
      <div class="tip" style:top="{BASE + 2}px" aria-hidden="true">
        {describe(chart.bins[chosen])}
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

  .zone {
    fill: var(--cream);
    fill-opacity: 0.07;
  }

  .bar {
    fill: var(--chart-secondary);
  }

  .curve {
    fill: none;
    stroke: var(--cream);
    stroke-width: 2;
  }

  .mu {
    stroke: var(--cream);
    stroke-width: 1.5;
    stroke-dasharray: 4 3;
  }

  .mu-label {
    fill: var(--cream);
    font-size: 12px;
    font-weight: 700;
  }

  .grid {
    stroke: var(--chart-grid);
    stroke-width: 1;
  }

  .tick {
    fill: var(--ink-muted);
    font-size: 11px;
  }

  .hit {
    position: absolute;
    top: 0;
    height: 150px;
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
