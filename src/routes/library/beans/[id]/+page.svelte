<script lang="ts">
  // Bean detail (screen 10, D-42): the about card with roast age, the numbers, and the recipes best first
  // (D-135). The recipe list is the part that scrolls (D-36). A recipe opens the Journal filtered to it
  // (D-125); its round button marks it Brew next (D-43). "Mark as finished" offers Undo (D-127).
  import { enhance } from '$app/forms';
  import { resolve } from '$app/paths';
  import TabBar from '#lib/components/TabBar.svelte';
  import type { PageProps } from './$types';

  let { data, form }: PageProps = $props();
  const bean = $derived(data.bean);
</script>

<svelte:head><title>{bean.name} · Coffee Nerd</title></svelte:head>

{#snippet cup()}
  <svg
    width="20"
    height="20"
    viewBox="0 0 24 24"
    fill="none"
    stroke="currentColor"
    stroke-width="2"
    stroke-linecap="round"
    stroke-linejoin="round"
    aria-hidden="true"
    ><path d="M5 9h11v5a5 5 0 0 1-5 5h-1a5 5 0 0 1-5-5z" /><path
      d="M16 11h1.5a2.5 2.5 0 0 1 0 5H16"
    /><path d="M8 3v3M11 3v3M14 3v3" /></svg
  >
{/snippet}

<header>
  <a class="icon cn-tap" href={resolve('/library/beans')} aria-label="Back to Beans">
    <svg
      width="22"
      height="22"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      stroke-width="2"
      stroke-linecap="round"
      stroke-linejoin="round"
      aria-hidden="true"><path d="M19 12H5M11 6l-6 6 6 6" /></svg
    >
  </a>
  <h1>{bean.name}</h1>
  <a class="edit cn-tap" href={resolve('/library/beans/[id]/edit', { id: bean.id })}>Edit</a>
</header>

<main>
  <section class="cn-card about" aria-label="About this bean">
    <div class="age">
      <span class="age-days">{bean.roastAgeDays}</span>
      <span class="age-unit">{bean.roastAgeDays === 1 ? 'day' : 'days'}</span>
      <span class="age-since">since roast</span>
    </div>
    <div class="lines">
      {#each bean.about as line, i (i)}
        <span class:first={i === 0 && bean.roaster}>{line}</span>
      {/each}
    </div>
  </section>

  <section class="numbers" aria-label="Numbers">
    <div class="number">
      <span class="cn-caption">Best score</span>
      {#if bean.best}<span class="value">{bean.best}</span>{:else}<span class="none"
          >Not rated yet</span
        >{/if}
    </div>
    <div class="number">
      <span class="cn-caption">Recipes</span>
      <span class="value">{bean.recipeCount}</span>
    </div>
    <div class="number">
      <span class="cn-caption">Shots</span>
      <span class="value">{bean.shotCount}</span>
    </div>
  </section>

  <div class="list-head">
    <h2>Recipes</h2>
    <span class="soft">Best first</span>
  </div>

  <div class="recipes">
    {#each bean.recipes as r (r.id)}
      <div class="recipe" class:marked={r.marked}>
        <!-- D-125: a recipe opens the Journal filtered to this bean and recipe. -->
        <form class="recipe-link" method="GET" action={resolve('/journal')}>
          <input type="hidden" name="bean" value={bean.id} />
          <button class="recipe-open cn-tap" name="recipe" value={r.id}>
            <span class="recipe-text">
              <span class="title">{r.title}</span>
              {#if r.detail}<span class="soft detail">{r.detail}</span>{/if}
              <span class="history" class:new={r.history.text === 'New recipe'}>
                {#if r.history.text !== 'New recipe'}<span
                    class="dot"
                    class:hollow={!r.history.reused}
                  ></span>{/if}{r.history.text}
              </span>
              {#if r.marked}<span class="next">Next shot starts here</span>{/if}
            </span>
            {#if r.best !== null}
              <span class="best"
                ><span class="best-value">{r.best}</span><span class="soft">best</span></span
              >
            {/if}
          </button>
        </form>
        <form method="POST" action="?/brewNext" use:enhance>
          <input type="hidden" name="recipeId" value={r.id} />
          <button
            class="brew cn-tap"
            aria-pressed={r.marked}
            aria-label={r.marked ? 'Brewing next. Tap to undo' : 'Brew this recipe next'}
            >{@render cup()}</button
          >
        </form>
      </div>
    {:else}
      <p class="soft empty">No shots yet</p>
    {/each}
  </div>

  <footer>
    {#if form?.finished}
      <!-- D-127: the message is not designed yet; it reuses Home's (docs/open-items.md). -->
      <div class="cn-card message" role="status">
        <span>{bean.name} is finished</span>
        <form method="POST" action="?/reopen" use:enhance>
          <button class="undo cn-tap">Undo</button>
        </form>
      </div>
    {:else if form?.brewNext === 'reopened'}
      <div class="cn-card message" role="status">
        <span>{bean.name} is open again</span>
      </div>
    {/if}
    {#if bean.status === 'open'}
      <form method="POST" action="?/finish" use:enhance>
        <button class="cn-btn-secondary cn-tap">Mark as finished</button>
      </form>
    {:else}
      <form method="POST" action="?/reopen" use:enhance>
        <button class="cn-btn-secondary cn-tap">Reopen</button>
      </form>
    {/if}
  </footer>
</main>

<TabBar current="library" />

<style>
  header {
    display: grid;
    grid-template-columns: 48px 1fr auto;
    align-items: center;
    height: 60px;
    padding: 0 var(--space-3) 0 var(--space-2);
  }

  h1 {
    margin: 0;
    font-size: 20px;
    font-weight: 600;
    white-space: nowrap;
    overflow: hidden;
    text-overflow: ellipsis;
  }

  .icon {
    width: var(--touch-min);
    height: var(--touch-min);
    display: flex;
    align-items: center;
    justify-content: center;
    color: var(--ink);
  }

  .edit {
    display: flex;
    align-items: center;
    height: var(--touch-min);
    padding: 0 14px;
    color: var(--amber);
    font-size: 15px;
    font-weight: 600;
    text-decoration: none;
  }

  main {
    flex: 1;
    min-height: 0;
    display: flex;
    flex-direction: column;
    gap: var(--space-3);
    padding: var(--space-1) var(--space-5) 0;
    overflow: hidden;
  }

  .about {
    display: flex;
    flex: none;
    gap: 14px;
  }

  .age {
    display: flex;
    flex-direction: column;
    align-items: center;
    justify-content: center;
    width: 84px;
    flex: none;
    padding: 10px 0;
    border-radius: var(--radius-md);
    background: var(--cream);
    color: var(--on-cream);
  }

  .age-days {
    font-size: 32px;
    font-weight: 700;
    line-height: 1;
  }

  .age-unit {
    font-size: 12px;
    font-weight: 600;
  }

  .age-since {
    font-size: 11px;
    color: var(--on-cream-muted);
  }

  .lines {
    flex: 1;
    min-width: 0;
    display: flex;
    flex-direction: column;
    gap: var(--space-1);
    font-size: 14px;
    color: var(--ink-muted);
  }

  .lines .first {
    color: var(--ink);
    font-weight: 600;
  }

  .numbers {
    display: grid;
    flex: none;
    grid-template-columns: repeat(3, minmax(0, 1fr));
    gap: 10px;
  }

  .number {
    display: flex;
    flex-direction: column;
    gap: 2px;
    padding: var(--space-3) 14px;
    border-radius: var(--radius-md);
    background: var(--surface);
  }

  .value {
    font-size: 24px;
    font-weight: 700;
  }

  .none {
    font-size: 14px;
    line-height: 32px;
    color: var(--ink-muted);
  }

  .list-head {
    display: flex;
    justify-content: space-between;
    align-items: baseline;
    margin-top: var(--space-1);
  }

  h2 {
    margin: 0;
    font-size: 16px;
    font-weight: 600;
  }

  .soft {
    color: var(--ink-muted);
    font-size: 13px;
  }

  /* D-36: the recipes are the list that scrolls. */
  .recipes {
    flex: 1;
    min-height: 0;
    display: flex;
    flex-direction: column;
    gap: var(--space-2);
    overflow-y: auto;
  }

  .empty {
    margin: 0;
  }

  .recipe {
    display: flex;
    flex: none;
    align-items: center;
    gap: 10px;
    padding: 14px var(--space-3) 14px var(--space-4);
    border-radius: var(--radius-lg);
    background: var(--surface);
  }

  /* D-43: the marked recipe gets an amber outline. */
  .recipe.marked {
    box-shadow: inset 0 0 0 2px var(--amber);
  }

  .recipe-link {
    flex: 1;
    min-width: 0;
    display: flex;
  }

  .recipe-open {
    flex: 1;
    min-width: 0;
    display: flex;
    align-items: center;
    gap: var(--space-3);
    padding: 0;
    border: none;
    background: transparent;
    color: var(--ink);
    text-align: left;
  }

  .recipe-text {
    flex: 1;
    min-width: 0;
    display: flex;
    flex-direction: column;
    gap: var(--space-1);
  }

  .title {
    font-size: 15px;
    font-weight: 600;
  }

  .history {
    display: inline-flex;
    align-items: center;
    gap: 6px;
    font-size: 13px;
    font-weight: 600;
    color: var(--cherry);
  }

  .history.new {
    color: var(--ink-muted);
  }

  .dot {
    width: 8px;
    height: 8px;
    border-radius: 4px;
    background: var(--cherry);
  }

  .dot.hollow {
    box-sizing: border-box;
    border: 1.5px solid var(--cherry);
    background: transparent;
  }

  .next {
    font-size: 13px;
    font-weight: 700;
    color: var(--amber);
  }

  .best {
    display: flex;
    flex-direction: column;
    align-items: center;
    justify-content: center;
    width: 52px;
    height: 52px;
    flex: none;
    border-radius: var(--radius-block);
    background: var(--bg);
  }

  .best-value {
    font-size: 20px;
    font-weight: 700;
    line-height: 1;
  }

  .best .soft {
    font-size: 11px;
  }

  .brew {
    width: var(--touch-min);
    height: var(--touch-min);
    flex: none;
    border-radius: var(--radius-pill);
    border: none;
    background: var(--control);
    color: var(--ink);
    display: flex;
    align-items: center;
    justify-content: center;
  }

  .brew[aria-pressed='true'] {
    background: var(--amber);
    color: var(--on-amber);
  }

  footer {
    display: flex;
    flex-direction: column;
    gap: var(--space-2);
    padding: var(--space-3) 0 var(--space-4);
  }

  .message {
    display: flex;
    align-items: center;
    justify-content: space-between;
    gap: var(--space-3);
    padding: var(--space-2) var(--space-2) var(--space-2) var(--space-4);
    font-size: 14px;
  }

  .undo {
    height: var(--touch-min);
    padding: 0 var(--space-3);
    border: none;
    background: transparent;
    color: var(--amber);
    font-size: 15px;
    font-weight: 700;
  }
</style>
