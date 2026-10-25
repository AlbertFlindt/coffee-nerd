<script lang="ts">
  // Insights (screens 23–25, D-55): the data basis, the topic chips and the cards of the chosen topic.
  // It opens on What I like each time (D-208); only the card list scrolls (D-36).
  import InsightCard from '#lib/components/InsightCard.svelte';
  import TabBar from '#lib/components/TabBar.svelte';
  import { count, TOPICS, type Topic } from '#lib/domain/insights.ts';
  import type { PageProps } from './$types';

  let { data }: PageProps = $props();

  const insights = $derived(data.insights);
  let topic: Topic = $state('like');
  const cards = $derived(insights.cards.filter((c) => c.topic === topic));
</script>

<header>
  <h1 class="cn-type-display">Insights</h1>
  <!-- D-207: with no shots the header says so; built without a design. -->
  <span class="basis"
    >{insights.shots === 0
      ? 'No shots yet'
      : `From ${count(insights.shots, 'shot')} · ${count(insights.beans, 'bean')}`}</span
  >
</header>

<div class="cn-tabs topics" role="tablist" aria-label="Insight topics">
  {#each TOPICS as t (t.id)}
    <button
      type="button"
      role="tab"
      class="cn-chip topic"
      aria-selected={topic === t.id}
      aria-controls="insight-cards"
      onclick={() => (topic = t.id)}>{t.label}</button
    >
  {/each}
</div>

<main>
  <div id="insight-cards" class="panel" role="tabpanel">
    {#each cards as card (card.id)}
      <InsightCard {card} />
    {/each}
  </div>
</main>

<TabBar current="insights" />

<style>
  header {
    display: flex;
    flex-direction: column;
    gap: 2px;
    padding: var(--space-5) var(--space-5) 10px;
  }

  h1 {
    margin: 0;
  }

  .basis {
    font-size: 14px;
    color: var(--ink-muted);
  }

  .topics {
    display: flex;
    gap: 6px;
    padding: var(--space-1) var(--space-5) var(--space-3);
    /* On a narrow phone the chips slide sideways rather than leave the screen. */
    overflow-x: auto;
  }

  /* As drawn on screens 23–25: a little narrower and lighter than a filter chip. */
  .topic {
    flex: none;
    padding: 0 13px;
    font-weight: 500;
    white-space: nowrap;
  }

  main {
    flex: 1;
    min-height: 0;
    padding: 0 var(--space-5) var(--space-4);
    /* D-36: the card list is the scrolling region. */
    overflow-y: auto;
  }

  .panel {
    display: flex;
    flex-direction: column;
    gap: var(--space-3);
  }
</style>
