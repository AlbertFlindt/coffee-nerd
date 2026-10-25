<script lang="ts">
  // Home (screen 6, D-32): the app banner with the gear (D-34, D-199), the bean pill (D-195), then the
  // last shot, quick numbers and best recipe for that bean. Everything follows the bean on the pill.
  import { enhance } from '$app/forms';
  import { resolve } from '$app/paths';
  import BottomSheet from '#lib/components/BottomSheet.svelte';
  import RateSheet from '#lib/components/RateSheet.svelte';
  import TabBar from '#lib/components/TabBar.svelte';
  import { recipeTagText } from '#lib/domain/fingerprint.ts';
  import { freshnessDetail, thisWeekText } from '#lib/domain/home.ts';
  import { clockTime, dayLabel } from '#lib/domain/journal.ts';
  import logo from '../../design-system/logo/coffee-nerd-mark.svg';
  import type { PageProps } from './$types';

  let { data }: PageProps = $props();

  const home = $derived(data.home);
  let beanSheet = $state(false);
  let rating = $state(false);
  const now = Date.now();
</script>

<header class="banner">
  <img src={logo} width="40" height="40" alt="" />
  <h1>Coffee Nerd</h1>
  <a class="gear cn-tap" href={resolve('/settings')} aria-label="Settings">
    <svg
      width="22"
      height="22"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      stroke-width="1.8"
      stroke-linecap="round"
      stroke-linejoin="round"
      aria-hidden="true"
      ><circle cx="12" cy="12" r="3" /><path
        d="M19.4 15a1.6 1.6 0 0 0 .3 1.8l.1.1a2 2 0 1 1-2.8 2.8l-.1-.1a1.6 1.6 0 0 0-1.8-.3 1.6 1.6 0 0 0-1 1.5V21a2 2 0 1 1-4 0v-.1a1.6 1.6 0 0 0-1-1.5 1.6 1.6 0 0 0-1.8.3l-.1.1a2 2 0 1 1-2.8-2.8l.1-.1a1.6 1.6 0 0 0 .3-1.8 1.6 1.6 0 0 0-1.5-1H3a2 2 0 1 1 0-4h.1a1.6 1.6 0 0 0 1.5-1 1.6 1.6 0 0 0-.3-1.8l-.1-.1a2 2 0 1 1 2.8-2.8l.1.1a1.6 1.6 0 0 0 1.8.3H9a1.6 1.6 0 0 0 1-1.5V3a2 2 0 1 1 4 0v.1a1.6 1.6 0 0 0 1 1.5 1.6 1.6 0 0 0 1.8-.3l.1-.1a2 2 0 1 1 2.8 2.8l-.1.1a1.6 1.6 0 0 0-.3 1.8V9a1.6 1.6 0 0 0 1.5 1H21a2 2 0 1 1 0 4h-.1a1.6 1.6 0 0 0-1.5 1z"
      /></svg
    >
  </a>
</header>

{#if data.flash}
  <!-- D-95: what happened to the shot just saved. The message itself is not designed yet. -->
  <div class="cn-card message" role="status">
    {#if data.flash.kind === 'saved'}
      <span>Shot saved.</span>
    {:else if data.flash.kind === 'finished'}
      <span>Shot saved. {data.flash.beanName} is finished: its bag is used up.</span>
      <form method="POST" action="?/undoFinish">
        <input type="hidden" name="beanId" value={data.flash.beanId} />
        <button type="submit" class="undo cn-tap">Undo</button>
      </form>
    {:else}
      <span>{data.flash.beanName} is open again.</span>
    {/if}
  </div>
{/if}

{#if home.state === 'no-bean'}
  <main>
    <!-- D-198: not designed yet (docs/open-items.md). -->
    <section class="cn-card empty-card" aria-label="No open beans">
      <h2>No open beans</h2>
      <a class="cn-btn-secondary cn-tap add" href={resolve('/library/beans/new')}>Add bean</a>
    </section>
  </main>
{:else}
  {@const last = home.lastShot}
  {@const week = thisWeekText(home.week)}
  <div class="scope">
    <button
      type="button"
      class="pill cn-tap"
      aria-haspopup="dialog"
      aria-label="{home.bean.label}, choose another bean"
      onclick={() => (beanSheet = true)}
    >
      <span class="pill-label">{home.bean.label}</span>
      <svg
        width="16"
        height="16"
        viewBox="0 0 24 24"
        fill="none"
        stroke="currentColor"
        stroke-width="2"
        stroke-linecap="round"
        aria-hidden="true"><path d="M6 9l6 6 6-6" /></svg
      >
    </button>
    <span class="open">{home.openBeans.length} open</span>
  </div>

  <main>
    <section class="last" aria-label="Last shot">
      {#if last}
        <!-- D-197: the card opens the shot, and its Back returns here. -->
        <a class="card cn-tap" href={resolve('/journal/[id]?from=home', { id: last.id })}>
          <div class="card-top">
            <h2>Last shot</h2>
            <span class="muted"
              >{`${dayLabel(last.brewedAt, now, home.timeZone)} ${clockTime(last.brewedAt, home.timeZone)}`}</span
            >
          </div>
          <div class="shot">
            {#if last.score === null}
              <!-- Room for the Rate button, which sits on top of the card (a button cannot be inside a link). -->
              <span class="block-space"></span>
            {:else}
              <span class="score"
                ><span class="number">{last.score}</span><span class="word">score</span></span
              >
            {/if}
            <div class="values">
              {#each last.values as v (v.label)}
                <span><span class="muted">{v.label}</span> {v.value}</span>
              {/each}
            </div>
          </div>
          <span class="cn-tag" class:cn-tag--new={last.recipeTag.kind === 'new'}
            >{recipeTagText(last.recipeTag)}</span
          >
        </a>
        {#if last.score === null}
          <!-- D-197, D-111: the Rate block opens the score sheet; the rest of the card opens the shot. -->
          <button
            type="button"
            class="rate cn-tap"
            aria-label="Rate the shot at {clockTime(last.brewedAt, home.timeZone)}"
            onclick={() => (rating = true)}>Rate</button
          >
        {/if}
      {:else}
        <div class="card">
          <h2>Last shot</h2>
          <!-- D-198: not designed yet (docs/open-items.md). -->
          <p class="muted">No shots yet</p>
        </div>
      {/if}
    </section>

    <section class="numbers" aria-label="Quick numbers">
      <div class="number-card">
        <span class="muted">Bean freshness</span>
        <span class="big"
          >{home.bean.roastAgeDays} {home.bean.roastAgeDays === 1 ? 'day' : 'days'}</span
        >
        <span class="muted">{freshnessDetail(home.bean.gramsLeft)}</span>
      </div>
      <div class="number-card">
        <span class="muted">This week</span>
        <span class="big">{week.value}</span>
        {#if last === null}
          <span class="muted">No shots yet</span>
        {:else if week.detail}
          <span class="muted">{week.detail}</span>
        {/if}
      </div>
    </section>

    <section class="best" aria-label="Best recipe for this bean">
      {#if home.best}
        <!-- D-197: the card opens the bean page, where Brew next lives. -->
        <a class="card cn-tap" href={resolve('/library/beans/[id]', { id: home.bean.id })}>
          <div class="card-top">
            <h2>Best recipe for this bean</h2>
            <span class="best-score">{home.best.score}</span>
          </div>
          <span class="best-title">{home.best.title}</span>
          <span class="muted small">{home.best.detail}</span>
        </a>
      {:else}
        <div class="card">
          <h2>Best recipe for this bean</h2>
          <!-- D-198: not designed yet (docs/open-items.md). -->
          <p class="muted">
            {last === null ? 'No shots yet' : 'Rate a shot to see your best recipe.'}
          </p>
        </div>
      {/if}
    </section>
  </main>

  {#if beanSheet}
    <BottomSheet
      label="Choose a bean"
      closeLabel="Close bean list"
      onclose={() => (beanSheet = false)}
    >
      <h2 class="cn-type-heading sheet-title">Open beans</h2>
      <!-- D-195: the bean chosen here is also the one "+" starts from. Built like the shot form's list. -->
      <form
        class="beans"
        method="POST"
        action="?/bean"
        use:enhance={() => {
          beanSheet = false;
        }}
      >
        {#each home.openBeans as b (b.id)}
          <button
            type="submit"
            name="beanId"
            value={b.id}
            class="bean cn-tap"
            aria-pressed={b.id === home.bean.id}
          >
            {b.name}<span class="soft">&nbsp;· {b.detail}</span>
          </button>
        {/each}
      </form>
    </BottomSheet>
  {/if}

  {#if rating && last}
    <RateSheet
      shot={{ ...last, beanName: home.bean.name }}
      timeZone={home.timeZone}
      onclose={() => (rating = false)}
    />
  {/if}
{/if}

<TabBar current="home" />

<style>
  .banner {
    display: flex;
    align-items: center;
    gap: 10px;
    height: 64px;
    flex: none;
    padding: 0 12px 0 var(--space-5);
  }

  h1 {
    flex: 1;
    margin: 0;
    font-size: 22px;
    font-weight: 700;
    letter-spacing: -0.01em;
  }

  .gear {
    display: flex;
    align-items: center;
    justify-content: center;
    width: var(--touch-min);
    height: var(--touch-min);
    border-radius: var(--radius-pill);
    color: var(--ink-muted);
  }

  .scope {
    display: flex;
    align-items: center;
    gap: var(--space-2);
    height: 56px;
    flex: none;
    padding: 0 var(--space-5);
  }

  .pill {
    display: inline-flex;
    align-items: center;
    gap: var(--space-2);
    min-width: 0;
    height: var(--touch-min);
    padding: 0 14px;
    border: none;
    border-radius: var(--radius-pill);
    background: var(--surface);
    color: var(--ink);
    font-size: 15px;
    font-weight: 600;
  }

  .pill svg {
    flex: none;
    color: var(--ink-muted);
  }

  .pill-label {
    min-width: 0;
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
  }

  .open {
    flex: none;
    font-size: 13px;
    color: var(--ink-muted);
  }

  main {
    flex: 1;
    min-height: 0;
    display: flex;
    flex-direction: column;
    gap: var(--space-3);
    padding: var(--space-1) var(--space-5) var(--space-3);
    overflow: hidden;
  }

  h2 {
    margin: 0;
    font-size: 16px;
    font-weight: 600;
  }

  p {
    margin: 0;
  }

  .muted {
    color: var(--ink-muted);
  }

  .small {
    font-size: 13px;
  }

  .last {
    position: relative;
  }

  .card {
    display: flex;
    flex-direction: column;
    gap: var(--space-3);
    padding: var(--space-4);
    border-radius: var(--radius-lg);
    background: var(--surface);
    color: var(--ink);
    text-decoration: none;
  }

  .card-top {
    display: flex;
    justify-content: space-between;
    align-items: baseline;
    gap: var(--space-2);
  }

  .card-top .muted {
    font-size: 13px;
  }

  .shot {
    display: flex;
    align-items: center;
    gap: var(--space-4);
  }

  .score,
  .rate,
  .block-space {
    display: flex;
    flex-direction: column;
    align-items: center;
    justify-content: center;
    width: 72px;
    height: 72px;
    flex: none;
    box-sizing: border-box;
    border-radius: var(--radius-md);
  }

  .score {
    background: var(--bg);
  }

  .number {
    font-size: 30px;
    font-weight: 700;
    line-height: 1;
  }

  .word {
    font-size: 12px;
    color: var(--ink-muted);
  }

  /* An unrated shot (D-11): amber, your input still to give. Placed over the card's score block. */
  .rate {
    position: absolute;
    left: var(--space-4);
    top: 58px;
    background: none;
    border: 1.5px dashed var(--amber);
    color: var(--amber);
    font-size: 15px;
    font-weight: 700;
  }

  .values {
    flex: 1;
    min-width: 0;
    display: grid;
    grid-template-columns: repeat(2, minmax(0, 1fr));
    gap: 6px var(--space-3);
    font-size: 14px;
  }

  .numbers {
    display: grid;
    grid-template-columns: repeat(2, minmax(0, 1fr));
    gap: var(--space-3);
  }

  .number-card {
    display: flex;
    flex-direction: column;
    gap: var(--space-1);
    padding: 14px;
    border-radius: var(--radius-lg);
    background: var(--surface);
  }

  .number-card .muted {
    font-size: 13px;
  }

  .big {
    font-size: 22px;
    font-weight: 600;
  }

  .best .card {
    gap: var(--space-2);
    padding: 14px var(--space-4);
  }

  .best h2 {
    font-size: 15px;
  }

  .best-score {
    flex: none;
    font-size: 14px;
    font-weight: 700;
  }

  .best-title {
    font-size: 14px;
  }

  .empty-card {
    display: flex;
    flex-direction: column;
    gap: var(--space-3);
  }

  .add {
    display: flex;
    align-items: center;
    justify-content: center;
    background: var(--control);
    text-decoration: none;
  }

  .sheet-title {
    margin: 4px 0 0;
  }

  .beans {
    display: flex;
    flex-direction: column;
    gap: 2px;
    border-radius: var(--radius-md);
    overflow-y: auto;
  }

  .bean {
    min-height: 56px;
    padding: 0 14px;
    border: none;
    background: var(--surface-sheet-field);
    color: var(--ink);
    font-size: 15px;
    font-weight: 600;
    text-align: left;
  }

  .bean[aria-pressed='true'] {
    color: var(--amber);
  }

  .soft {
    font-weight: 500;
    color: var(--ink-muted);
  }

  .message {
    position: absolute;
    top: var(--space-5);
    left: var(--space-5);
    right: var(--space-5);
    z-index: 1;
    display: flex;
    align-items: center;
    gap: var(--space-3);
    font-size: 15px;
  }

  .message span {
    flex: 1;
  }

  .undo {
    height: var(--touch-min);
    padding: 0 var(--space-4);
    border: none;
    border-radius: var(--radius-pill);
    background: var(--control);
    color: var(--ink);
    font-size: 15px;
    font-weight: 700;
  }
</style>
