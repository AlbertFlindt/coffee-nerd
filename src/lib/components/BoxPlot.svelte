<script lang="ts">
  // Box plot (screen 23, D-56): per group the middle half as a box, the median as an amber line (score
  // data, D-19), the full range as whiskers, and how many shots ("n 38") on the right.
  import { statText, type BoxRow, type Chart } from '../domain/insights';
  import RowChart from './RowChart.svelte';

  let { chart }: { chart: Extract<Chart, { kind: 'box' }> } = $props();

  const describe = (r: BoxRow) =>
    `${r.label}: median ${statText(r.median)}, middle half ${statText(r.q1)} to ${statText(r.q3)}, ` +
    `range ${statText(r.min)} to ${statText(r.max)}, ${r.n} ${r.n === 1 ? 'shot' : 'shots'}`;
  const rows = $derived(chart.rows.map((r) => ({ ...r, right: `n ${r.n}`, tip: describe(r) })));
  const label = $derived(
    `Box plot of ${chart.measure.toLowerCase()}. ${chart.rows.map(describe).join('; ')}`
  );
</script>

<RowChart {rows} axis={chart.axis} {label} spacing={40} gridTop={8} plotRight={40} rightSize={11}>
  {#snippet mark(r, x, y)}
    <line class="whisker" x1={x(r.min)} y1={y} x2={x(r.q1)} y2={y} />
    <line class="whisker" x1={x(r.q3)} y1={y} x2={x(r.max)} y2={y} />
    <line class="whisker" x1={x(r.min)} y1={y - 6} x2={x(r.min)} y2={y + 6} />
    <line class="whisker" x1={x(r.max)} y1={y - 6} x2={x(r.max)} y2={y + 6} />
    <rect class="box" x={x(r.q1)} y={y - 11} width={x(r.q3) - x(r.q1)} height="22" rx="4" />
    <line class="median" x1={x(r.median)} y1={y - 11} x2={x(r.median)} y2={y + 11} />
  {/snippet}
</RowChart>

<style>
  .whisker {
    stroke: var(--ink-muted);
    stroke-width: 2;
  }

  .box {
    fill: var(--bg);
    stroke: var(--cream);
    stroke-width: 1.5;
  }

  .median {
    stroke: var(--amber);
    stroke-width: 3;
  }
</style>
