<script lang="ts">
  // Average ± 1 σ (screens 23 and 25, D-56): per group a dot at the average with whiskers one standard
  // deviation each way, and the σ on the right ("±0.7"). The top group is amber when the measure is the
  // score, your data (D-19, D-55); the rest, and other measures, are cream (D-56).
  import { statText, type Chart, type DotRow } from '../domain/insights';
  import RowChart from './RowChart.svelte';

  let { chart }: { chart: Extract<Chart, { kind: 'mean-sigma' }> } = $props();

  const unit = $derived(chart.unit ? ` ${chart.unit}` : '');
  const describe = (r: DotRow) =>
    `${r.label}: average ${statText(r.mean)}${unit}, standard deviation ${statText(r.sigma)}${unit}, ` +
    `${r.n} ${r.n === 1 ? 'shot' : 'shots'}`;
  const rows = $derived(
    chart.rows.map((r) => ({ ...r, right: `±${statText(r.sigma)}`, tip: describe(r) }))
  );
  const label = $derived(
    `Average ${chart.measure.toLowerCase()} with one standard deviation. ${chart.rows.map(describe).join('; ')}`
  );
</script>

<RowChart {rows} axis={chart.axis} {label} spacing={34} gridTop={6} plotRight={50} rightSize={12}>
  {#snippet mark(r, x, y)}
    <g class:top={r.top && chart.measure === 'Score'}>
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
