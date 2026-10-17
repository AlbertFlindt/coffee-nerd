<script lang="ts">
  // One standing-setup row in More › Setup (RowStepper, D-22, D-24): an optional switch, the label, −/+
  // and the value. A phase that is on shows its pressure as a small tappable amber value (D-24); a
  // switched-off row collapses to one quiet line. Changed since the last shot: sage value and a delta
  // pill, or an "On"/"Off" pill (D-90).
  import { tick } from 'svelte';
  import {
    applyStep,
    decimalsFor,
    formatDelta,
    formatNumber,
    toThousandths,
    type Thousandths
  } from '../domain/units';
  import type { FeatureChange } from '../domain/shot-form';

  let {
    label,
    sublabel,
    switchable = false,
    on = true,
    value,
    unit,
    step,
    min,
    max,
    pressure,
    change,
    ontoggle,
    onvalue,
    onpressure
  }: {
    label: string;
    sublabel?: string;
    switchable?: boolean;
    on?: boolean;
    value: Thousandths | undefined;
    unit: string;
    step: Thousandths;
    min?: Thousandths;
    max?: Thousandths;
    /** A phase's pressure in bar, when the phase has one (D-24). */
    pressure?: { value: Thousandths | undefined; step: Thousandths; min: number; max: number };
    change?: FeatureChange;
    ontoggle?: (on: boolean) => void;
    onvalue: (value: Thousandths) => void;
    onpressure?: (value: Thousandths) => void;
  } = $props();

  const decimals = (v: Thousandths | undefined, s: Thousandths) =>
    v === undefined ? 0 : decimalsFor(v, s);
  const valueChanged = $derived(!!change && change.switched === null && change.delta !== null);
  const pressureChanged = $derived(!!change && change.pressureDelta !== null);

  let typingPressure = $state(false);
  let draft = $state('');
  let input: HTMLInputElement | undefined = $state();

  async function typePressure() {
    draft =
      pressure?.value === undefined
        ? ''
        : formatNumber(pressure.value, decimals(pressure.value, pressure.step));
    typingPressure = true;
    await tick();
    input?.select();
  }

  function finishPressure() {
    if (!typingPressure || !pressure) return;
    typingPressure = false;
    try {
      const typed = toThousandths(draft);
      onpressure?.(Math.min(pressure.max, Math.max(pressure.min, typed)));
    } catch {
      // Not a number: keep the pressure as it was.
    }
  }
</script>

<div class="cn-row row" class:off={!on} class:tall={on && !!pressure}>
  {#if switchable}
    <button
      type="button"
      class="cn-switch"
      role="switch"
      aria-checked={on}
      aria-label={label}
      onclick={() => ontoggle?.(!on)}
    ></button>
  {/if}
  <div class="name">
    <span class="cn-row__label label">
      {label}
      {#if change?.switched}<span class="cn-delta">{change.switched}</span>{/if}
      {#if valueChanged && change?.delta != null}<span class="cn-delta"
          >{formatDelta(change.delta, decimals(value, step))}</span
        >{/if}
    </span>
    {#if sublabel}<span class="cn-caption">{sublabel}</span>{/if}
    {#if on && pressure}
      {#if typingPressure}
        <input
          bind:this={input}
          bind:value={draft}
          class="pressure-input"
          inputmode="decimal"
          aria-label="{label} pressure in bar"
          onblur={finishPressure}
          onkeydown={(e) => {
            if (e.key === 'Enter') {
              e.preventDefault();
              finishPressure();
            }
          }}
        />
      {:else}
        <button
          type="button"
          class="pressure"
          class:changed={pressureChanged}
          aria-label="{label} pressure, {pressure.value === undefined
            ? 'not set'
            : `${formatNumber(pressure.value, 1)} bar`}, tap to change"
          onclick={typePressure}
        >
          at {pressure.value === undefined
            ? '—'
            : formatNumber(pressure.value, Math.max(1, decimals(pressure.value, pressure.step)))} bar
          {#if pressureChanged && change?.pressureDelta != null}<span class="cn-delta"
              >{formatDelta(change.pressureDelta, 1)}</span
            >{/if}
        </button>
      {/if}
    {/if}
  </div>
  {#if on}
    <button
      type="button"
      class="cn-row__btn tap"
      aria-label="{label} minus {formatNumber(step, decimals(step, step))} {unit}"
      onclick={() => onvalue(applyStep(value ?? null, step, '-', { min, max }))}>−</button
    >
    <span class="cn-row__value" class:changed={valueChanged}>
      {#if value === undefined}<span class="muted">—</span>{:else}{formatNumber(
          value,
          decimals(value, step)
        )}{/if}<span class="unit">{` ${unit}`}</span>
    </span>
    <button
      type="button"
      class="cn-row__btn tap"
      aria-label="{label} plus {formatNumber(step, decimals(step, step))} {unit}"
      onclick={() => onvalue(applyStep(value ?? null, step, '+', { min, max }))}>+</button
    >
  {:else}
    <span class="off-text">Off</span>
  {/if}
</div>

<style>
  .row {
    border-radius: 0;
  }

  .row.tall {
    min-height: 72px;
  }

  .row.off {
    min-height: 56px;
    padding-right: 14px;
  }

  .cn-switch {
    flex: none;
  }

  .name {
    flex: 1;
    display: flex;
    flex-direction: column;
    gap: 2px;
    min-width: 0;
  }

  .label {
    display: inline-flex;
    align-items: center;
    gap: 6px;
  }

  .off .label {
    font-weight: 500;
    color: var(--ink-muted);
  }

  .unit {
    font-size: 13px;
    font-weight: 500;
    color: var(--ink-muted);
  }

  .muted {
    color: var(--ink-muted);
  }

  .changed {
    color: var(--sage);
  }

  .pressure {
    align-self: flex-start;
    display: inline-flex;
    align-items: center;
    gap: 6px;
    height: 24px;
    padding: 0 8px;
    margin-left: -8px;
    border: none;
    border-radius: 12px;
    background: transparent;
    color: var(--amber);
    font-size: 13px;
    font-weight: 600;
    position: relative;
  }

  /* A 44 px touch target around the small value (CLAUDE.md). */
  .pressure::after {
    content: '';
    position: absolute;
    inset: -10px 0;
  }

  .pressure.changed {
    color: var(--sage);
  }

  .pressure-input {
    width: 80px;
    height: 28px;
    border: none;
    border-radius: var(--radius-sm);
    background: var(--control-strong);
    color: var(--ink);
    font-family: inherit;
    font-size: 16px;
    padding: 0 8px;
  }

  .off-text {
    font-size: 14px;
    color: var(--ink-muted);
  }
</style>
