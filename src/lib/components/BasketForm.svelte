<script lang="ts">
  // The basket page (screen 16, D-49, D-150, D-79, D-147, D-158): brand and size (the name is built from
  // them by the server), type, shot size, diameter with the machines it fits, and the optional dose range.
  import { untrack } from 'svelte';
  import type { Guide } from '#lib/domain/guide.ts';
  import GearFormShell from '#lib/components/GearFormShell.svelte';
  import TextField from '#lib/components/TextField.svelte';
  import { fitsMachines, NEW_GEAR, trimmed } from '#lib/domain/gear.ts';
  import type { BasketSpec } from '#lib/domain/schemas.ts';
  import { formatNumber, toThousandths, type Thousandths } from '#lib/domain/units.ts';

  let {
    spec,
    isDefault = false,
    machines,
    guide = null,
    problems = []
  }: {
    spec?: BasketSpec;
    isDefault?: boolean;
    machines: { name: string; groupSizeMm?: number }[];
    /** A step of the step-by-step start (D-157). */
    guide?: Guide | null;
    problems?: string[];
  } = $props();

  const adding = untrack(() => spec === undefined);
  let value: BasketSpec = $state(untrack(() => structuredClone(spec ?? NEW_GEAR.basket())));

  const TYPES = [
    ['precision', 'Precision'],
    ['standard', 'Standard'],
    ['pressurized', 'Pressurized']
  ] as const;
  const SIZES = [
    ['single', 'Single'],
    ['double', 'Double'],
    ['triple', 'Triple']
  ] as const;
  const DIAMETER_STEP = 500;

  const trim = (v: Thousandths) => trimmed(v);
  const fits = $derived(fitsMachines(value.diameterMm, machines));

  function diameter(direction: '+' | '-') {
    // Not set yet: the first tap starts at the most common size (D-158).
    if (value.diameterMm === undefined) {
      value.diameterMm = 58000;
      return;
    }
    const current = value.diameterMm;
    value.diameterMm = Math.max(
      DIAMETER_STEP,
      current + (direction === '+' ? DIAMETER_STEP : -DIAMETER_STEP)
    );
  }

  // The fields keep what you typed; a value that cannot be read leaves the stored one as it was.
  let size = $state(untrack(() => (value.sizeG === undefined ? '' : trim(value.sizeG))));
  let from = $state(untrack(() => (value.doseRange ? formatNumber(value.doseRange.from, 1) : '')));
  let to = $state(untrack(() => (value.doseRange ? formatNumber(value.doseRange.to, 1) : '')));

  function readSize() {
    if (size.trim() === '') {
      value.sizeG = undefined;
      return;
    }
    try {
      // "18 g" and "18g" read as 18; zero or less is not a size.
      const typed = toThousandths(size.trim().replace(/\s*g$/i, ''));
      if (typed > 0) value.sizeG = typed;
    } catch {
      // Not a number: keep the previous size.
    }
    size = value.sizeG === undefined ? '' : trim(value.sizeG);
  }

  function readRange(which: 'from' | 'to') {
    const text = which === 'from' ? from : to;
    const other = which === 'from' ? to : from;
    const current = value.doseRange;
    if (text.trim() === '') {
      value.doseRange = undefined;
      if (which === 'from') from = '';
      else to = '';
      return;
    }
    let typed: Thousandths | undefined;
    try {
      typed = toThousandths(text);
    } catch {
      typed = current?.[which];
    }
    let otherValue: Thousandths | undefined;
    try {
      otherValue = other.trim() === '' ? undefined : toThousandths(other);
    } catch {
      otherValue = current?.[which === 'from' ? 'to' : 'from'];
    }
    if (typed === undefined) {
      if (which === 'from') from = '';
      else to = '';
    } else if (which === 'from') from = formatNumber(typed, 1);
    else to = formatNumber(typed, 1);
    if (typed !== undefined && otherValue !== undefined) {
      value.doseRange =
        which === 'from' ? { from: typed, to: otherValue } : { from: otherValue, to: typed };
    } else {
      value.doseRange = undefined;
    }
  }

  const payload = $derived(JSON.stringify({ kind: 'basket', spec: value }));
</script>

<GearFormShell kind="basket" {adding} {isDefault} {payload} {guide} {problems}>
  <div class="pair">
    <TextField
      label="Brand"
      id="basket-brand"
      placeholder="e.g. VST"
      autocomplete="off"
      bind:value={value.brand}
    />
    <TextField
      label="Size"
      id="basket-size"
      inputmode="decimal"
      placeholder="e.g. 18"
      autocomplete="off"
      bind:value={size}
      onchange={readSize}
    />
  </div>

  <fieldset>
    <legend>Type</legend>
    <div class="cn-seg" role="radiogroup" aria-label="Basket type">
      {#each TYPES as [key, label] (key)}
        <button
          type="button"
          role="radio"
          aria-checked={value.type === key}
          onclick={() => (value.type = key)}>{label}</button
        >
      {/each}
    </div>
  </fieldset>

  <fieldset>
    <legend>Shot size</legend>
    <div class="cn-seg" role="radiogroup" aria-label="Shot size">
      {#each SIZES as [key, label] (key)}
        <button
          type="button"
          role="radio"
          aria-checked={value.shotSize === key}
          onclick={() => (value.shotSize = key)}>{label}</button
        >
      {/each}
    </div>
  </fieldset>

  <div class="cn-row row">
    <div class="label">
      <span class="cn-row__label">Diameter</span>
      {#if fits}<span class="cn-caption">{fits}</span>{/if}
    </div>
    <button
      type="button"
      class="cn-row__btn cn-tap"
      aria-label="Diameter smaller"
      onclick={() => diameter('-')}>−</button
    >
    <span class="cn-row__value val">
      {#if value.diameterMm === undefined}<span class="muted small">Not set</span>{:else}{trim(
          value.diameterMm
        )}<span class="unit">&nbsp;mm</span>{/if}
    </span>
    <button
      type="button"
      class="cn-row__btn cn-tap"
      aria-label="Diameter larger"
      onclick={() => diameter('+')}>+</button
    >
  </div>

  <div class="range">
    <div class="range-head">
      <h2>Dose range</h2>
      <span class="cn-caption">Optional</span>
    </div>
    <div class="pair">
      <TextField
        label="From"
        id="basket-min"
        inputmode="decimal"
        autocomplete="off"
        placeholder="g"
        bind:value={from}
        onchange={() => readRange('from')}
      />
      <TextField
        label="To"
        id="basket-max"
        inputmode="decimal"
        autocomplete="off"
        placeholder="g"
        bind:value={to}
        onchange={() => readRange('to')}
      />
    </div>
    <p class="cn-caption note">
      The shot form gives a gentle hint when your dose falls outside this range.
    </p>
  </div>
</GearFormShell>

<style>
  .pair {
    display: grid;
    grid-template-columns: repeat(2, minmax(0, 1fr));
    gap: 10px;
  }

  fieldset {
    margin: 0;
    padding: 0;
    border: none;
    min-width: 0;
  }

  legend {
    padding: 0;
    margin-bottom: 6px;
    font-size: 13px;
    color: var(--ink-muted);
  }

  .row {
    background: var(--surface);
  }

  .label {
    flex: 1;
    display: flex;
    flex-direction: column;
    gap: 2px;
  }

  .val {
    font-size: 18px;
  }

  .unit {
    font-size: 13px;
    font-weight: 500;
    color: var(--ink-muted);
  }

  .muted {
    color: var(--ink-muted);
  }

  .small {
    font-size: 14px;
    font-weight: 500;
  }

  .range {
    display: flex;
    flex-direction: column;
    gap: 6px;
  }

  .range-head {
    display: flex;
    justify-content: space-between;
    align-items: baseline;
  }

  h2 {
    margin: 0;
    font-size: 15px;
    font-weight: 600;
  }

  .note {
    margin: 0 2px;
    line-height: 1.4;
  }
</style>
