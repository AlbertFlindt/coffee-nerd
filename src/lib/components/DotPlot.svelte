<script lang="ts">
  // Average ± 1 σ (screens 23 and 25): per group a dot at the average with whiskers one standard
  // deviation each way, and the σ on the right ("±0.7"). The clear winner is amber on any measure, as screens 23 and 25
  // draw it; the rest are cream.
  import { decimalText, statText, type Chart, type DotRow } from '../domain/insights';
  import RowChart from './RowChart.svelte';

  let { chart }: { chart: Extract<Chart, { kind: 'mean-sigma' }> } = $props();

  const unit = $derived(chart.unit ? ` ${chart.unit}` : '');
  const describe = (r: DotRow) =>
    `${r.label}: average ${statText(r.mean)}${unit}, standard deviation ${statText(r.sigma)}${unit}, ` +
    `${r.n} ${r.n === 1 ? 'shot' : 'shots'}`;
  const rows = $derived(
    chart.rows.map((r) => ({ ...r, right: `±${decimalText(r.sigma)}`, tip: describe(r) }))
  );
  const label = $derived(
    `Average ${chart.measure.toLowerCase()} with one standard deviation. ${chart.rows.map(describe).join('; ')}`
  );
</script>

<!-- Routine names are longer than countries: the plot starts further in (screen 25). -->
<RowChart
  {rows}
  axis={chart.axis}
  {label}
  spacing={34}
  gridTop={6}
  plotLeft={chart.unit ? 86 : 53}
  plotRight={50}
  rightSize={12}
>
  {#snippet mark(r, x, y)}
    <g class:top={r.top}>
      <line class="sigma" x1={x(r.mean - r.sigma)} y1={y} x2={x(r.mean + r.sigma)} y2={y} />
      <circle class="dot" cx={x(r.mean)} cy={y} r="5" />
    </g>
  {/snippet}
</RowChart>

<style>
  .sigma {
    stroke: var(--cream);
    stroke-width: 2;
    stroke-linecap: round;
  }

  .dot {
    fill: var(--cream);
    stroke: var(--surface);
    stroke-width: 2;
  }

  .top .sigma {
    stroke: var(--amber);
  }

  .top .dot {
    fill: var(--amber);
  }
</style>
