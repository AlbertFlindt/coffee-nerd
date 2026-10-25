<script lang="ts">
  // σ bars (screen 25, D-56): per group a bar from zero to its standard deviation, lower is steadier,
  // and the σ on the right ("σ 0.6"). The clear winner is amber (D-55); the rest are secondary (D-56).
  import { decimalText, statText, type BarRow, type Chart } from '../domain/insights';
  import RowChart from './RowChart.svelte';

  let { chart }: { chart: Extract<Chart, { kind: 'sigma-bars' }> } = $props();

  const describe = (r: BarRow) =>
    `${r.label}: standard deviation ${statText(r.sigma)}, ${r.n} ${r.n === 1 ? 'shot' : 'shots'}`;
  const rows = $derived(
    chart.rows.map((r) => ({ ...r, right: `σ ${decimalText(r.sigma)}`, tip: describe(r) }))
  );
  const label = $derived(
    `Standard deviation of ${chart.measure.toLowerCase()} per bean, on reused recipes. ` +
      chart.rows.map(describe).join('; ')
  );
</script>

<!-- Bean names are long: the plot starts further in (screen 25). -->
<RowChart
  {rows}
  axis={chart.axis}
  {label}
  spacing={30}
  gridTop={4}
  plotLeft={110}
  plotRight={40}
  rightSize={12}
>
  {#snippet mark(r, x, y)}
    <rect
      class="bar"
      class:top={r.top}
      x={x(0)}
      y={y - 7}
      width={Math.max(0, x(r.sigma) - x(0))}
      height="14"
      rx="4"
    />
  {/snippet}
</RowChart>

<style>
  .bar {
    fill: var(--chart-secondary);
  }

  .bar.top {
    fill: var(--amber);
  }
</style>
