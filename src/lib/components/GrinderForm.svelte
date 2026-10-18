<script lang="ts">
  // The grinder page (screen 15, D-48, D-79, D-147, D-158): name, type, burrs, burr size, and how the dial
  // works, with a preview of the shot form's Grind card so you see what the settings do.
  import { untrack } from 'svelte';
  import GearFormShell from '#lib/components/GearFormShell.svelte';
  import TextField from '#lib/components/TextField.svelte';
  import { NEW_GEAR, trimmed } from '#lib/domain/gear.ts';
  import type { GrinderSpec } from '#lib/domain/schemas.ts';
  import {
    decimalsFor,
    decimalsForStep,
    formatNumber,
    stepLabel,
    toThousandths,
    type Thousandths
  } from '#lib/domain/units.ts';

  let {
    name = '',
    spec,
    isDefault = false,
    problems = []
  }: {
    name?: string;
    spec?: GrinderSpec;
    isDefault?: boolean;
    problems?: string[];
  } = $props();

  const adding = untrack(() => spec === undefined);
  let nameValue = $state(untrack(() => name));
  let value: GrinderSpec = $state(untrack(() => structuredClone(spec ?? NEW_GEAR.grinder())));

  /** The steps a tap can move by (D-48), in thousandths. */
  const STEPS: Thousandths[] = [10, 50, 100, 250, 500, 1000];
  const BURR_STEP = 500;
  const BURR_START = 58000;
  const PREVIEW_VALUE = 1600;

  const TYPES = [
    ['electric', 'Electric'],
    ['hand', 'Hand']
  ] as const;
  const BURRS = [
    ['flat', 'Flat'],
    ['conical', 'Conical']
  ] as const;
  const DIALS = [
    ['stepped', 'Stepped', 'clicks or numbers'],
    ['stepless', 'Stepless', 'any point on the dial']
  ] as const;

  const dialDecimals = (v: Thousandths) => Math.max(1, decimalsFor(v, value.dial.step));

  function burr(direction: '+' | '-') {
    if (value.burrSizeMm === undefined) {
      if (direction === '+') value.burrSizeMm = BURR_START;
      return;
    }
    value.burrSizeMm = Math.max(
      BURR_STEP,
      value.burrSizeMm + (direction === '+' ? BURR_STEP : -BURR_STEP)
    );
  }

  const stepIndex = $derived(
    STEPS.reduce(
      (best, s, i) =>
        Math.abs(s - value.dial.step) < Math.abs(STEPS[best] - value.dial.step) ? i : best,
      0
    )
  );
  function moveStep(by: 1 | -1) {
    const next = STEPS[Math.min(STEPS.length - 1, Math.max(0, stepIndex + by))];
    value.dial.step = next;
  }

  let finest = $state(
    untrack(() => formatNumber(value.dial.finest, dialDecimals(value.dial.finest)))
  );
  let coarsest = $state(
    untrack(() => formatNumber(value.dial.coarsest, dialDecimals(value.dial.coarsest)))
  );

  function read(key: 'finest' | 'coarsest') {
    const text = key === 'finest' ? finest : coarsest;
    try {
      value.dial[key] = toThousandths(text);
    } catch {
      // Not a number: keep the previous value.
    }
    const shown = formatNumber(value.dial[key], dialDecimals(value.dial[key]));
    if (key === 'finest') finest = shown;
    else coarsest = shown;
  }

  const low = $derived(Math.min(value.dial.finest, value.dial.coarsest));
  const high = $derived(Math.max(value.dial.finest, value.dial.coarsest));
  const previewValue = $derived(
    PREVIEW_VALUE >= low && PREVIEW_VALUE <= high ? PREVIEW_VALUE : value.dial.finest
  );
  const previewDecimals = $derived(Math.max(decimalsFor(previewValue, value.dial.step), 1));
  const rangeDecimals = $derived(
    Math.max(
      decimalsFor(value.dial.finest, value.dial.step),
      decimalsFor(value.dial.coarsest, value.dial.step),
      1
    )
  );

  const payload = $derived(JSON.stringify({ kind: 'grinder', name: nameValue, spec: value }));
</script>

<GearFormShell kind="grinder" {adding} {isDefault} {payload} {problems}>
  <TextField label="Name" id="grinder-name" autocomplete="off" bind:value={nameValue} />

  <div class="pair">
    <fieldset>
      <legend>Type</legend>
      <div class="cn-seg" role="radiogroup" aria-label="Grinder type">
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
      <legend>Burrs</legend>
      <div class="cn-seg" role="radiogroup" aria-label="Burr shape">
        {#each BURRS as [key, label] (key)}
          <button
            type="button"
            role="radio"
            aria-checked={value.burrs === key}
            onclick={() => (value.burrs = key)}>{label}</button
          >
        {/each}
      </div>
    </fieldset>
  </div>

  <div class="cn-row row">
    <span class="cn-row__label">Burr size</span>
    <button
      type="button"
      class="cn-row__btn cn-tap"
      aria-label="Burr size smaller"
      onclick={() => burr('-')}>−</button
    >
    <span class="cn-row__value val">
      {#if value.burrSizeMm === undefined}<span class="muted small">Not set</span>{:else}{trimmed(
          value.burrSizeMm
        )}<span class="unit">&nbsp;mm</span>{/if}
    </span>
    <button
      type="button"
      class="cn-row__btn cn-tap"
      aria-label="Burr size larger"
      onclick={() => burr('+')}>+</button
    >
  </div>

  <div class="heading">
    <h2>How the dial works</h2>
    <span class="cn-caption">Sets the grind control on the shot form</span>
  </div>

  <fieldset>
    <legend class="sr">Dial</legend>
    <div class="cn-seg" role="radiogroup" aria-label="Dial">
      {#each DIALS as [key, label, sub] (key)}
        <button
          type="button"
          role="radio"
          class="dial"
          aria-checked={value.dial.mode === key}
          onclick={() => (value.dial.mode = key)}
        >
          <span class="dial-title">{label}</span>
          <span class="dial-sub">{sub}</span>
        </button>
      {/each}
    </div>
  </fieldset>

  <div class="group">
    <div class="cn-row row steprow">
      <div class="label">
        <span class="cn-row__label">Step per tap</span>
        <span class="cn-caption">How much − or + moves</span>
      </div>
      <button
        type="button"
        class="cn-row__btn cn-tap"
        aria-label="Smaller step"
        disabled={stepIndex === 0}
        onclick={() => moveStep(-1)}>−</button
      >
      <span class="cn-row__value stepval"
        >{formatNumber(value.dial.step, decimalsForStep(value.dial.step))}</span
      >
      <button
        type="button"
        class="cn-row__btn cn-tap"
        aria-label="Larger step"
        disabled={stepIndex === STEPS.length - 1}
        onclick={() => moveStep(1)}>+</button
      >
    </div>
    <div class="range">
      <TextField
        label="Finest"
        id="grinder-min"
        inputmode="decimal"
        autocomplete="off"
        bind:value={finest}
        onchange={() => read('finest')}
      />
      <TextField
        label="Coarsest"
        id="grinder-max"
        inputmode="decimal"
        autocomplete="off"
        bind:value={coarsest}
        onchange={() => read('coarsest')}
      />
    </div>
  </div>

  <section aria-label="Preview" class="preview-section">
    <div class="preview-head">
      <h3>Preview</h3>
      <span class="cn-caption">Shot form › Grind</span>
    </div>
    <div class="cn-preview preview" aria-hidden="true">
      <div class="cn-value-card card">
        <span class="cn-label">Grind</span>
        <span class="cn-value-card__value big">{formatNumber(previewValue, previewDecimals)}</span>
        <div class="cn-steppers">
          <span class="cn-step"
            ><span class="cn-step__sym">−</span><span class="cn-step__amt"
              >{stepLabel('-', value.dial.step).slice(2)}</span
            ></span
          >
          <span class="cn-step"
            ><span class="cn-step__sym">+</span><span class="cn-step__amt"
              >{stepLabel('+', value.dial.step).slice(2)}</span
            ></span
          >
        </div>
      </div>
      <span class="cn-caption range-text"
        >Range {formatNumber(value.dial.finest, rangeDecimals)}–{formatNumber(
          value.dial.coarsest,
          rangeDecimals
        )}</span
      >
    </div>
  </section>
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

  .sr {
    position: absolute;
    width: 1px;
    height: 1px;
    overflow: hidden;
    clip-path: inset(50%);
  }

  .row {
    background: var(--surface);
  }

  .steprow {
    border-radius: 0;
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

  .stepval {
    width: 60px;
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

  .cn-row__btn:disabled {
    opacity: 0.4;
  }

  .heading {
    display: flex;
    flex-direction: column;
    gap: 2px;
    margin-top: 4px;
  }

  h2,
  h3 {
    margin: 0;
    font-size: 15px;
    font-weight: 600;
  }

  .cn-seg .dial {
    display: flex;
    flex-direction: column;
    align-items: center;
    justify-content: center;
    gap: 1px;
    height: 52px;
  }

  .dial-title {
    font-size: 14px;
    font-weight: 600;
  }

  .dial[aria-checked='true'] .dial-title {
    font-weight: 700;
  }

  .dial-sub {
    font-size: 12px;
    font-weight: 400;
    color: var(--ink-muted);
  }

  .dial[aria-checked='true'] .dial-sub {
    color: inherit;
  }

  .group {
    display: flex;
    flex-direction: column;
    gap: 2px;
    border-radius: var(--radius-md);
    overflow: hidden;
  }

  .group :global(.field) {
    border-radius: 0;
  }

  .range {
    display: grid;
    grid-template-columns: repeat(2, minmax(0, 1fr));
    gap: 2px;
  }

  .preview-section {
    display: flex;
    flex-direction: column;
    gap: var(--space-2);
  }

  .preview-head {
    display: flex;
    justify-content: space-between;
    align-items: baseline;
  }

  .preview {
    display: flex;
  }

  .card {
    width: 180px;
    gap: 4px;
    padding: 12px;
    border-radius: var(--radius-md);
  }

  .big {
    font-size: 26px;
    line-height: 1.15;
  }

  .range-text {
    flex: 1;
    align-self: center;
    padding: 0 12px;
    line-height: 1.5;
  }
</style>
