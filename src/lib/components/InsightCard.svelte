<script lang="ts">
  // InsightCard (design-system/components.md, D-55, D-56): the finding as a title and a sentence, its
  // chart, and its basis. Without enough data the chart is left out and the sentence says what is
  // missing (D-203, built without a design, D-207).
  import type { InsightCard } from '../domain/insights';
  import BellCurve from './BellCurve.svelte';
  import BoxPlot from './BoxPlot.svelte';
  import DotPlot from './DotPlot.svelte';
  import SigmaBars from './SigmaBars.svelte';
  import WeeklyLine from './WeeklyLine.svelte';

  let { card }: { card: InsightCard } = $props();
</script>

<article class="cn-insight card" aria-labelledby="insight-{card.id}">
  <div class="words">
    <h2 id="insight-{card.id}">{card.title}</h2>
    <p>{card.sentence}</p>
  </div>
  {#if card.chart?.kind === 'box'}
    <BoxPlot chart={card.chart} />
  {:else if card.chart?.kind === 'mean-sigma'}
    <DotPlot chart={card.chart} />
  {:else if card.chart?.kind === 'weekly'}
    <WeeklyLine chart={card.chart} />
  {:else if card.chart?.kind === 'bell'}
    <BellCurve chart={card.chart} />
  {:else if card.chart?.kind === 'sigma-bars'}
    <SigmaBars chart={card.chart} />
  {/if}
  {#if card.basis}
    <span class="cn-caption basis">{card.basis}</span>
  {/if}
</article>

<style>
  .card {
    flex: none;
  }

  .words {
    display: flex;
    flex-direction: column;
    gap: var(--space-1);
  }

  /* As .cn-insight h3; a card's title is the page's second heading level. */
  h2 {
    margin: 0;
    font-size: 17px;
    line-height: 22px;
    font-weight: 700;
  }

  .basis {
    line-height: 1.4;
  }
</style>
