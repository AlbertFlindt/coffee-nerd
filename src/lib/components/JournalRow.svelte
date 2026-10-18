<script lang="ts">
  // One shot in the Journal (D-54): score block (or a dashed amber "Rate" block when unrated), bean and
  // time, core values, then taste and the recipe tag (cherry, D-16). The row opens the shot; the Rate
  // block is a button of its own that opens the score sheet (D-111).
  import { resolve } from '$app/paths';
  import { recipeTagText } from '../domain/fingerprint';
  import { clockTime, coreValuesText, journalTasteText } from '../domain/journal';
  import type { JournalShot } from '../server/db/journal';
  import type { Thousandths } from '../domain/units';

  let {
    shot,
    timeZone,
    steps,
    onrate
  }: {
    shot: JournalShot;
    timeZone: string;
    steps: { dose: Thousandths; yield: Thousandths; time: Thousandths };
    onrate: () => void;
  } = $props();

  const taste = $derived(journalTasteText(shot.score, shot.balance));
</script>

<div class="item">
  <a class="row cn-tap" href={resolve('/journal/[id]', { id: shot.id })}>
    {#if shot.score === null}
      <!-- Room for the Rate button, which sits on top of the row (a button cannot be inside a link). -->
      <span class="block-space"></span>
    {:else}
      <span class="score"
        ><span class="number">{shot.score}</span><span class="word">score</span></span
      >
    {/if}
    <span class="text">
      <span class="top"
        ><span class="bean">{shot.beanName}</span><span>{clockTime(shot.brewedAt, timeZone)}</span
        ></span
      >
      <span class="values">{coreValuesText(shot, { ...steps, grind: shot.grindStep })}</span>
      <span class="bottom">
        {#if taste}<span class="taste">{taste}</span>{/if}
        <span class="cn-tag" class:cn-tag--new={shot.recipeTag.kind === 'new'}
          >{recipeTagText(shot.recipeTag)}</span
        >
      </span>
    </span>
  </a>
  {#if shot.score === null}
    <button
      type="button"
      class="rate cn-tap"
      aria-label="Rate the shot at {clockTime(shot.brewedAt, timeZone)}"
      onclick={onrate}>Rate</button
    >
  {/if}
</div>

<style>
  .item {
    position: relative;
  }

  .row {
    display: flex;
    align-items: center;
    gap: var(--space-3);
    padding: var(--space-3) 14px var(--space-3) var(--space-3);
    border-radius: var(--radius-lg);
    background: var(--surface);
    color: var(--ink);
    text-decoration: none;
  }

  .score,
  .rate,
  .block-space {
    display: flex;
    flex-direction: column;
    align-items: center;
    justify-content: center;
    width: 52px;
    height: 52px;
    flex: none;
    box-sizing: border-box;
    border-radius: var(--radius-sm);
  }

  .score {
    background: var(--bg);
  }

  .number {
    font-size: 20px;
    font-weight: 700;
    line-height: 1;
  }

  .word {
    font-size: 11px;
    color: var(--ink-muted);
  }

  /* An unrated shot (D-11): amber, your input still to give. */
  .rate {
    position: absolute;
    left: var(--space-3);
    top: 50%;
    transform: translateY(-50%);
    background: none;
    border: 1.5px dashed var(--amber);
    color: var(--amber);
    font-size: 13px;
    font-weight: 700;
  }

  .text {
    flex: 1;
    min-width: 0;
    display: flex;
    flex-direction: column;
    gap: 3px;
  }

  .top {
    display: flex;
    justify-content: space-between;
    gap: var(--space-2);
    font-size: 13px;
    color: var(--ink-muted);
  }

  .bean {
    white-space: nowrap;
    overflow: hidden;
    text-overflow: ellipsis;
  }

  .values {
    font-size: 15px;
    font-weight: 600;
  }

  .bottom {
    display: flex;
    flex-wrap: wrap;
    gap: 0 10px;
    font-size: 13px;
  }

  .taste {
    color: var(--ink-muted);
  }
</style>
