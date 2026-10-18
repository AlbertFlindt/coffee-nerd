<script lang="ts">
  // Library (screen 17, D-50): Beans, Gear, Puck prep and Tags, each with two live lines. Puck prep and Tags
  // are dimmed and do nothing until their pages exist in M7 (D-156).
  import { resolve } from '$app/paths';
  import TabBar from '#lib/components/TabBar.svelte';
  import type { PageProps } from './$types';

  let { data }: PageProps = $props();
  const { library } = $derived(data);
</script>

<svelte:head><title>Library · Coffee Nerd</title></svelte:head>

{#snippet chevron()}
  <svg
    class="chevron"
    width="18"
    height="18"
    viewBox="0 0 24 24"
    fill="none"
    stroke="currentColor"
    stroke-width="2"
    stroke-linecap="round"
    aria-hidden="true"><path d="M9 6l6 6-6 6" /></svg
  >
{/snippet}

{#snippet text(name: string, lines: string[])}
  <span class="text">
    <span class="name">{name}</span>
    <span class="lines"
      >{#each lines as line, i (i)}<span>{line}</span>{/each}</span
    >
  </span>
{/snippet}

<header>
  <h1 class="cn-type-display">Library</h1>
  <span class="sub">The nerdy basement</span>
</header>

<main>
  <a class="door cn-tap" href={resolve('/library/beans')}>
    <span class="tile"
      ><svg
        width="24"
        height="24"
        viewBox="0 0 24 24"
        fill="none"
        stroke="currentColor"
        stroke-width="2"
        stroke-linecap="round"
        aria-hidden="true"
        ><ellipse cx="12" cy="12" rx="6.5" ry="9" transform="rotate(30 12 12)" /><path
          d="M9 5.5c3 3 3 10 6 13"
        /></svg
      ></span
    >
    {@render text('Beans', library.beans)}
    {@render chevron()}
  </a>
  <a class="door cn-tap" href={resolve('/library/gear')}>
    <span class="tile"
      ><svg
        width="24"
        height="24"
        viewBox="0 0 24 24"
        fill="none"
        stroke="currentColor"
        stroke-width="2"
        stroke-linecap="round"
        stroke-linejoin="round"
        aria-hidden="true"
        ><path d="M3 9h14v3a5 5 0 0 1-5 5H8a5 5 0 0 1-5-5z" /><path d="M17 11h4" /><path
          d="M8 17v3M12 17v3"
        /></svg
      ></span
    >
    {@render text('Gear', library.gear)}
    {@render chevron()}
  </a>
  <!-- D-156: Puck prep and Tags arrive in M7; until then their rows are dimmed and do nothing. -->
  <div class="door later" aria-disabled="true">
    <span class="tile"
      ><svg
        width="24"
        height="24"
        viewBox="0 0 24 24"
        fill="none"
        stroke="currentColor"
        stroke-width="2"
        stroke-linecap="round"
        stroke-linejoin="round"
        aria-hidden="true"
        ><rect x="3" y="3" width="6" height="6" rx="1.5" /><rect
          x="15"
          y="15"
          width="6"
          height="6"
          rx="1.5"
        /><path d="M9 6h4a2 2 0 0 1 2 2v7" /></svg
      ></span
    >
    {@render text('Puck prep', library.puckPrep)}
    {@render chevron()}
  </div>
  <div class="door later" aria-disabled="true">
    <span class="tile"
      ><svg
        width="24"
        height="24"
        viewBox="0 0 24 24"
        fill="none"
        stroke="currentColor"
        stroke-width="2"
        stroke-linecap="round"
        stroke-linejoin="round"
        aria-hidden="true"
        ><path d="M3 12V4a1 1 0 0 1 1-1h8l9 9-9 9z" /><circle cx="8" cy="8" r="1.5" /></svg
      ></span
    >
    {@render text('Tags', library.tags)}
    {@render chevron()}
  </div>
</main>

<TabBar current="library" />

<style>
  header {
    display: flex;
    flex-direction: column;
    gap: 2px;
    padding: var(--space-5) var(--space-5) var(--space-3);
  }

  h1 {
    margin: 0;
  }

  .sub {
    font-size: 14px;
    color: var(--ink-muted);
  }

  main {
    flex: 1;
    min-height: 0;
    display: flex;
    flex-direction: column;
    gap: var(--space-3);
    padding: var(--space-1) var(--space-5) var(--space-4);
    overflow-y: auto;
  }

  .door {
    display: flex;
    flex: none;
    align-items: center;
    gap: 14px;
    min-height: 96px;
    padding: var(--space-4);
    border-radius: var(--radius-xl);
    background: var(--surface);
    color: var(--ink);
    text-decoration: none;
  }

  .later {
    opacity: 0.4;
  }

  .tile {
    width: 52px;
    height: 52px;
    flex: none;
    display: flex;
    align-items: center;
    justify-content: center;
    border-radius: var(--radius-md);
    background: var(--cream);
    color: var(--on-cream-muted);
  }

  .text {
    flex: 1;
    min-width: 0;
    display: flex;
    flex-direction: column;
    gap: var(--space-1);
  }

  .name {
    font-size: 18px;
    font-weight: 700;
  }

  .lines {
    display: flex;
    flex-direction: column;
    gap: 1px;
    font-size: 13px;
    color: var(--ink-muted);
  }

  .chevron {
    flex: none;
    color: var(--ink-muted);
  }
</style>
