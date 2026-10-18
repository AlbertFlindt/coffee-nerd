<script lang="ts">
  // The shot form's bean card (D-14): bean, machine and grinder, the setup summary (D-100) and the recipe
  // tag (D-16). Tapping it switches the bean (D-94); tapping the gear line switches the machine or grinder
  // (D-153). Started from Brew next, it says so and offers "Use last shot recipe" (D-43).
  import type { Snippet } from 'svelte';

  let {
    title,
    gear,
    summary,
    tag,
    brewNext,
    onopen,
    ongear
  }: {
    title: string;
    gear: string;
    summary: string;
    tag: { reused: boolean; text: string; detail?: string };
    /** The "Use last shot recipe" control, shown when the shot started from Brew next. */
    brewNext?: Snippet;
    onopen: () => void;
    ongear: () => void;
  } = $props();
</script>

{#snippet tagLine()}
  <span class="cn-tag" class:cn-tag--new={!tag.reused}
    >{tag.text}{#if tag.detail}<span class="detail">{tag.detail}</span>{/if}</span
  >
{/snippet}

<div class="card" class:compact={!!brewNext}>
  <div class="main">
    <!-- The whole card opens the bean list; the gear line on top of it opens the gear list (D-153). -->
    <button
      type="button"
      class="pick cn-tap"
      aria-label="{title}, choose another bean"
      onclick={onopen}
    ></button>
    <span class="icon">
      <svg
        width="22"
        height="22"
        viewBox="0 0 24 24"
        fill="none"
        stroke="currentColor"
        stroke-width="2"
        stroke-linecap="round"
        aria-hidden="true"
        ><ellipse cx="12" cy="12" rx="6.5" ry="9" transform="rotate(30 12 12)"></ellipse><path
          d="M9 5.5c3 3 3 10 6 13"
        ></path></svg
      >
    </span>
    <span class="text">
      <span class="name" aria-hidden="true">{title}</span>
      <button
        type="button"
        class="line gear cn-tap"
        class:with-summary={!!summary}
        aria-label="{gear}, choose another machine or grinder"
        onclick={ongear}>{gear}</button
      >
      {#if summary}<span class="line">{summary}</span>{/if}
    </span>
    <svg
      class="chevron"
      width="18"
      height="18"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      stroke-width="2"
      stroke-linecap="round"
      aria-hidden="true"><path d="M9 6l6 6-6 6"></path></svg
    >
  </div>
  {#if brewNext}
    <div class="bottom">
      <span class="status">
        {@render tagLine()}
        <span class="chosen">
          <svg
            width="14"
            height="14"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            stroke-width="2.2"
            stroke-linecap="round"
            stroke-linejoin="round"
            aria-hidden="true"
            ><path d="M5 9h11v5a5 5 0 0 1-5 5h-1a5 5 0 0 1-5-5z"></path><path
              d="M16 11h1.5a2.5 2.5 0 0 1 0 5H16"
            ></path></svg
          >Recipe chosen from Library
        </span>
      </span>
      {@render brewNext()}
    </div>
  {:else}
    <div class="bottom">{@render tagLine()}</div>
  {/if}
</div>

<style>
  .card {
    display: flex;
    flex-direction: column;
    gap: var(--space-3);
    padding: var(--space-4);
    border-radius: var(--radius-lg);
    background: var(--surface);
  }

  .card.compact {
    gap: 10px;
    padding: 14px 14px 10px var(--space-4);
  }

  .main {
    position: relative;
    display: flex;
    align-items: center;
    gap: var(--space-3);
    width: 100%;
    color: var(--ink);
    text-align: left;
  }

  /* The bean button lies under the card's content and takes every tap the gear line does not. */
  .pick {
    position: absolute;
    inset: 0;
    padding: 0;
    border: none;
    border-radius: var(--radius-md);
    background: transparent;
  }

  .main > :not(.pick) {
    position: relative;
    pointer-events: none;
  }

  .pick:active ~ :not(.icon),
  .pick:active ~ .text .line {
    color: var(--on-amber);
  }

  .gear {
    position: relative;
    align-self: flex-start;
    padding: 0;
    border: none;
    background: transparent;
    text-align: left;
    pointer-events: auto;
  }

  /*
   * A 44 px tap area that stops short of the bean name: with a summary line it reaches down over it (the
   * summary is the gear's setup), otherwise it grows evenly.
   */
  .gear {
    border-radius: var(--radius-sm);
  }

  .gear::before {
    content: '';
    position: absolute;
    inset: -13px -8px;
  }

  .gear.with-summary::before {
    inset: -6px -8px -21px;
  }

  .icon {
    width: 44px;
    height: 44px;
    flex: none;
    border-radius: var(--radius-block);
    background: var(--cream);
    color: var(--on-cream-muted);
    display: flex;
    align-items: center;
    justify-content: center;
  }

  .text {
    display: flex;
    flex-direction: column;
    gap: 2px;
    flex: 1;
    min-width: 0;
  }

  .name {
    font-size: 16px;
    font-weight: 600;
  }

  .line {
    font-size: 13px;
    color: var(--ink-muted);
  }

  .chevron {
    flex: none;
    color: var(--ink-muted);
  }

  .bottom {
    display: flex;
    align-items: center;
    gap: var(--space-2);
    font-size: 13px;
  }

  .compact .bottom {
    min-height: 44px;
  }

  .status {
    flex: 1;
    min-width: 0;
    display: flex;
    flex-direction: column;
    gap: 2px;
  }

  .detail {
    color: var(--ink-muted);
    font-weight: 400;
  }

  .chosen {
    display: inline-flex;
    align-items: center;
    gap: 6px;
    color: var(--amber);
    font-weight: 600;
  }

  /* D-36: tighter on shorter screens, as the rest of the shot form. */
  @media (max-height: 880px) {
    .card,
    .card.compact {
      gap: var(--space-2);
      padding: var(--space-3) var(--space-3) var(--space-3) var(--space-4);
    }

    .compact .bottom {
      min-height: 0;
    }
  }
</style>
