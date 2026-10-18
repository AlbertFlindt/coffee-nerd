<script lang="ts">
  // Beans overview (screen 7, D-37): open beans as cards with their roast age, finished beans as rows below;
  // below the header everything scrolls as one list (D-36, D-136). The Library tab opens it directly, so there is no back arrow
  // until the Library page exists (D-124). A bean opens its page (D-42).
  import { resolve } from '$app/paths';
  import TabBar from '#lib/components/TabBar.svelte';
  import type { PageData } from './$types';

  let { data }: { data: PageData } = $props();
  const { open, finished } = $derived(data.beans);
</script>

<svelte:head><title>Beans · Coffee Nerd</title></svelte:head>

<header>
  <h1>Beans</h1>
  <a class="cn-btn-add add" href={resolve('/library/beans/new')}>
    <svg
      width="16"
      height="16"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      stroke-width="2.6"
      stroke-linecap="round"
      aria-hidden="true"><path d="M12 5v14M5 12h14" /></svg
    >Add bean</a
  >
</header>

<main>
  {#if open.length === 0 && finished.length === 0}
    <p class="empty">No beans yet</p>
  {/if}
  {#if open.length > 0}
    <h2>Open · {open.length}</h2>
    {#each open as bean (bean.id)}
      <a class="cn-card card" href={resolve('/library/beans/[id]', { id: bean.id })}>
        <div class="age">
          <span class="age-days">{bean.roastAgeDays}</span>
          <span class="age-unit">{bean.roastAgeDays === 1 ? 'day' : 'days'}</span>
          <span class="age-since">since roast</span>
        </div>
        <div class="about">
          <span class="name">{bean.name}</span>
          {#if bean.origin}<span class="origin">{bean.origin}</span>{/if}
          <!-- D-132: the numbers are separated by dots; grams left only with a bag weight. -->
          <span class="numbers">
            {#if bean.best}<span><span class="soft">Best</span> <b>{bean.best}</b></span
              >{:else}<span class="soft">Not rated yet</span>{/if}
            <span
              ><span class="dot" aria-hidden="true">·</span> <span class="soft">Recipes</span>
              {bean.recipes}</span
            >
            <span
              ><span class="dot" aria-hidden="true">·</span> <span class="soft">Shots</span>
              {bean.shots}</span
            >
            {#if bean.gramsLeft}
              <span><span class="dot" aria-hidden="true">·</span> {bean.gramsLeft}</span>
            {/if}
          </span>
        </div>
      </a>
    {/each}
  {/if}
  {#if finished.length > 0}
    <h2 class="finished-title">Finished · {finished.length}</h2>
    <div class="finished">
      {#each finished as bean (bean.id)}
        <a class="row" href={resolve('/library/beans/[id]', { id: bean.id })}>
          <div class="about">
            <span class="row-name">{bean.name}</span>
            {#if bean.origin}<span class="origin">{bean.origin}</span>{/if}
          </div>
          <div class="row-numbers">
            {#if bean.best}<span><span class="soft">Best</span> <b>{bean.best}</b></span
              >{:else}<span class="soft">Not rated yet</span>{/if}
            <span class="soft"
              >{bean.recipes}
              {bean.recipes === 1 ? 'recipe' : 'recipes'} · {bean.shots}
              {bean.shots === 1 ? 'shot' : 'shots'}</span
            >
          </div>
        </a>
      {/each}
    </div>
  {/if}
</main>

<TabBar current="library" />

<style>
  header {
    display: flex;
    align-items: center;
    justify-content: space-between;
    height: 64px;
    padding: 0 var(--space-4) 0 var(--space-5);
  }

  h1 {
    margin: 0;
    font-size: 20px;
    font-weight: 600;
  }

  .add {
    text-decoration: none;
  }

  main {
    flex: 1;
    min-height: 0;
    display: flex;
    flex-direction: column;
    gap: var(--space-3);
    padding: var(--space-1) var(--space-5) var(--space-4);
    /* D-36, D-136: open cards and finished rows scroll together as one list. */
    overflow-y: auto;
  }

  h2 {
    margin: 0;
    font-size: 14px;
    font-weight: 600;
    color: var(--ink-muted);
  }

  .finished-title {
    margin-top: var(--space-2);
  }

  .empty {
    margin: 0;
    color: var(--ink-muted);
  }

  .card {
    display: flex;
    flex: none;
    gap: 14px;
    color: var(--ink);
    text-decoration: none;
  }

  .age {
    display: flex;
    flex-direction: column;
    align-items: center;
    justify-content: center;
    width: 76px;
    flex: none;
    border-radius: var(--radius-md);
    background: var(--cream);
    color: var(--on-cream);
  }

  .age-days {
    font-size: 30px;
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

  .about {
    flex: 1;
    min-width: 0;
    display: flex;
    flex-direction: column;
    gap: var(--space-1);
  }

  .name {
    font-size: 17px;
    font-weight: 700;
  }

  .dot {
    margin-right: var(--space-1);
  }

  .origin,
  .soft,
  .dot {
    color: var(--ink-muted);
  }

  .origin {
    font-size: 13px;
  }

  /* D-132: dots with room around them keep the numbers apart; a long line wraps. */
  .numbers {
    display: flex;
    flex-wrap: wrap;
    align-items: baseline;
    column-gap: var(--space-2);
    margin-top: 6px;
    white-space: nowrap;
    font-size: 13px;
  }

  b {
    font-weight: 700;
  }

  .finished {
    flex: none;
    display: flex;
    flex-direction: column;
    gap: 2px;
    border-radius: var(--radius-lg);
    overflow: hidden;
  }

  .row {
    display: flex;
    flex: none;
    align-items: center;
    gap: var(--space-3);
    min-height: 64px;
    padding: 0 var(--space-4);
    background: var(--surface);
    color: var(--ink);
    text-decoration: none;
  }

  .row .about {
    gap: 2px;
  }

  .row-name {
    font-size: 15px;
    font-weight: 600;
  }

  .row-numbers {
    display: flex;
    flex-direction: column;
    align-items: flex-end;
    gap: 2px;
    font-size: 13px;
  }
</style>
