<script lang="ts">
  // A core value (grind, dose, yield, time) with −/+ that show their step (D-07, D-14). Changed since the
  // last shot: sage value and a delta pill (D-15). Empty: a muted dash with the unit (D-99). Tap the value
  // to type it (D-06).
  import { tick } from 'svelte';
  import {
    applyStep,
    decimalsForStep,
    formatDelta,
    formatNumber,
    formatQuantity,
    toThousandths,
    type Thousandths
  } from '../domain/units';
  import type { Change } from '../domain/shot-form';

  let {
    label,
    value,
    unit,
    unitName,
    step,
    decimals,
    min,
    max,
    change = null,
    onchange
  }: {
    label: string;
    value: Thousandths | null;
    unit?: string;
    /** Spoken unit for the buttons, e.g. "gram". */
    unitName?: string;
    step: Thousandths;
    decimals: number;
    min?: Thousandths;
    max?: Thousandths;
    change?: Change;
    onchange: (value: Thousandths | null) => void;
  } = $props();

  let editing = $state(false);
  let draft = $state('');
  let input: HTMLInputElement | undefined = $state();

  const stepText = $derived(formatQuantity(step, { decimals: decimalsForStep(step), unit }));
  const spokenStep = $derived(
    `${formatNumber(step, decimalsForStep(step))}${unitName ? ` ${unitName}` : ''}`
  );

  async function startTyping() {
    draft = value === null ? '' : formatNumber(value, decimals);
    editing = true;
    await tick();
    input?.select();
  }

  function finishTyping() {
    if (!editing) return;
    editing = false;
    if (draft.trim() === '') return;
    try {
      let typed = toThousandths(draft);
      if (min !== undefined && typed < min) typed = min;
      if (max !== undefined && typed > max) typed = max;
      onchange(typed);
    } catch {
      // Not a number: keep the value as it was.
    }
  }
</script>

<div class="cn-value-card" class:cn-value-card--changed={change !== null}>
  <div class="top">
    <span class="cn-label">{label}</span>
    {#if change?.delta !== null && change?.delta !== undefined}
      <span class="cn-delta" aria-label="Changed by {formatDelta(change.delta, decimals)}">
        {formatDelta(change.delta, decimals)}
      </span>
    {/if}
  </div>
  {#if editing}
    <input
      bind:this={input}
      bind:value={draft}
      class="cn-value-card__value typed"
      inputmode="decimal"
      aria-label={label}
      onblur={finishTyping}
      onkeydown={(e) => {
        if (e.key === 'Enter') {
          e.preventDefault();
          finishTyping();
        }
        if (e.key === 'Escape') editing = false;
      }}
    />
  {:else}
    <button
      type="button"
      class="cn-value-card__value value"
      aria-label="{label}, {value === null
        ? 'not set'
        : formatQuantity(value, { decimals, unit })}, tap to type"
      onclick={startTyping}
    >
      {#if value === null}<span class="empty">—</span>{:else}{formatNumber(
          value,
          decimals
        )}{/if}{#if unit}<span class="cn-value-card__unit">{` ${unit}`}</span>{/if}
    </button>
  {/if}
  <div class="cn-steppers">
    <button
      type="button"
      class="cn-step tap"
      aria-label="{label} minus {spokenStep}"
      onclick={() => onchange(applyStep(value, step, '-', { min, max }))}
    >
      <span class="cn-step__sym">−</span><span class="cn-step__amt">{stepText}</span>
    </button>
    <button
      type="button"
      class="cn-step tap"
      aria-label="{label} plus {spokenStep}"
      onclick={() => onchange(applyStep(value, step, '+', { min, max }))}
    >
      <span class="cn-step__sym">+</span><span class="cn-step__amt">{stepText}</span>
    </button>
  </div>
</div>

<style>
  .top {
    display: flex;
    justify-content: space-between;
    align-items: center;
  }

  .cn-delta {
    margin: -2px 0;
  }

  .value,
  .typed {
    display: block;
    width: 100%;
    padding: 0;
    border: none;
    background: transparent;
    color: var(--ink);
    font-family: inherit;
    text-align: left;
    line-height: 1.15;
  }

  /* D-15: a changed value turns sage, as .cn-value-card--changed does for the design system's value. */
  .cn-value-card--changed .value {
    color: var(--sage);
  }

  .typed {
    border-radius: var(--radius-sm);
    background: var(--control);
    color: var(--ink);
    padding: 0 var(--space-2);
    outline: none;
    min-width: 0;
  }

  .empty {
    color: var(--ink-muted);
  }
</style>
