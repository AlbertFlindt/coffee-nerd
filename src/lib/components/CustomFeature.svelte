<script lang="ts">
  // "Add your own feature" (screen 14, D-46): a bottom sheet on the machine page. Name, what kind of value,
  // the fields that kind needs, a preview of the row as More › Setup shows it, then the button. Opened on a
  // feature of your own it edits that one (D-151): rename and re-step always, delete only while no shot
  // has used it. The machine page saves the machine; this sheet only hands back the feature.
  import { untrack } from 'svelte';
  import BottomSheet from '#lib/components/BottomSheet.svelte';
  import SetupRow from '#lib/components/SetupRow.svelte';
  import TextField from '#lib/components/TextField.svelte';
  import { readQuantity, readRange } from '#lib/domain/gear.ts';
  import { randomId } from '#lib/domain/id.ts';
  import type { FeatureDefinition } from '#lib/domain/schemas.ts';
  import { decimalsFor, formatNumber } from '#lib/domain/units.ts';

  type Kind = 'number' | 'seconds' | 'toggle' | 'choice';

  let {
    feature,
    used = false,
    onsave,
    ondelete,
    onclose
  }: {
    /** The feature being edited; without one the sheet adds a feature. */
    feature?: FeatureDefinition;
    /** A shot has used it: it cannot be deleted (D-151), nor lose an option. */
    used?: boolean;
    onsave: (feature: FeatureDefinition) => void;
    ondelete: () => void;
    onclose: () => void;
  } = $props();

  const KINDS: [Kind, string][] = [
    ['number', 'Number with unit'],
    ['seconds', 'Seconds'],
    ['toggle', 'On / off'],
    ['choice', 'Pick from a list']
  ];

  const editing = untrack(() => feature !== undefined);
  const start = untrack(() => feature?.value);
  const startKind: Kind =
    start?.kind === 'number' ||
    start?.kind === 'seconds' ||
    start?.kind === 'toggle' ||
    start?.kind === 'choice'
      ? start.kind
      : 'seconds';

  const option = (label = '') => ({ id: `option-${randomId()}`, label });
  const text = (v: number, step: number) => formatNumber(v, decimalsFor(v, step));

  let name = $state(untrack(() => feature?.label ?? ''));
  let kind: Kind = $state(startKind);
  let unit = $state(start?.kind === 'number' ? start.unit : '');
  let stepText = $state(
    start && 'step' in start
      ? text(start.step, start.step) + (start.kind === 'seconds' ? ' s' : '')
      : '1 s'
  );
  let rangeText = $state(
    start && (start.kind === 'number' || start.kind === 'seconds') && start.max !== undefined
      ? `${text(start.min ?? 0, start.step)}–${text(start.max, start.step)}`
      : ''
  );
  let options = $state(
    start?.kind === 'choice' ? start.options.map((o) => ({ ...o })) : [option(), option()]
  );
  // Options that existed when a used feature was opened keep their place: shots point to them.
  const kept = new Set(
    start?.kind === 'choice' && untrack(() => used) ? start.options.map((o) => o.id) : []
  );

  function pickKind(next: Kind) {
    // An untouched step follows the kind: "1 s" for seconds, "1" for a number.
    if (stepText === '1 s' && next === 'number') stepText = '1';
    else if (stepText === '1' && next === 'seconds') stepText = '1 s';
    kind = next;
  }

  const unitLabel = $derived(kind === 'seconds' ? 's' : unit.trim());
  const step = $derived(readQuantity(stepText));
  const range = $derived(readRange(rangeText));
  const labels = $derived(options.map((o) => o.label.trim()));

  const problem = $derived.by(() => {
    if (name.trim() === '') return 'Name is required';
    if (kind === 'number' && unit.trim() === '') return 'Unit is required';
    if ((kind === 'number' || kind === 'seconds') && (step === null || step <= 0))
      return 'The step must be more than 0';
    if ((kind === 'number' || kind === 'seconds') && range === null)
      return 'The range must run from low to high, like 0–30';
    if (kind === 'choice' && (options.length < 2 || labels.some((l) => l === '')))
      return 'Give at least two options a name';
    return null;
  });

  function definition(): FeatureDefinition {
    const base = {
      // Stable forever; the label can be renamed freely (D-65).
      key: feature?.key ?? `custom-${randomId()}`,
      label: name.trim(),
      builtIn: false,
      enabled: feature?.enabled ?? true,
      switchable: true
    } as const;
    const { min, max } = range ?? {};
    const limits = { ...(min !== undefined && { min }), ...(max !== undefined && { max }) };
    switch (kind) {
      case 'number':
        return { ...base, value: { kind, unit: unit.trim(), step: step!, ...limits } };
      case 'seconds':
        return { ...base, value: { kind, step: step!, ...limits } };
      case 'toggle':
        return { ...base, value: { kind } };
      case 'choice':
        return {
          ...base,
          value: { kind, options: options.map((o) => ({ id: o.id, label: o.label.trim() })) }
        };
    }
  }

  function save() {
    if (!problem) onsave(definition());
  }

  // The preview row: a sample value a few steps in, held inside the range.
  const sample = $derived.by(() => {
    const s = step && step > 0 ? step : 1000;
    const { min, max } = range ?? {};
    return Math.min(max ?? Infinity, Math.max(min ?? 0, s * 6));
  });
  const previewName = $derived(name.trim() || 'Your feature');
  // D-160, D-162: what a used feature can still change, by its kind.
  const usedNote = $derived(
    kind === 'number'
      ? 'its unit stays; you can rename it, switch it off or change its step and range.'
      : kind === 'seconds'
        ? 'you can rename it, switch it off or change its step and range.'
        : kind === 'choice'
          ? 'you can rename it, switch it off or add options.'
          : 'you can rename it or switch it off.'
  );
  const previewOption = $derived(labels.find((l) => l !== '') ?? '—');
</script>

<BottomSheet
  short
  label={editing ? `Edit ${feature?.label}` : 'Add your own feature'}
  closeLabel={editing ? 'Close without saving' : 'Close without adding'}
  {onclose}
>
  <div class="body">
    <div class="heading">
      <h2>{editing ? feature?.label : 'Add your own feature'}</h2>
      {#if editing && used}
        <!-- D-160, D-162, screen 42: a used feature keeps its kind, unit and options. -->
        <p class="in-use">Used by shots · {usedNote}</p>
      {/if}
    </div>

    <TextField label="Name" id="feature-name" autocomplete="off" bind:value={name} />

    <!-- Screen 42: editing shows the kind, which cannot change. -->
    <fieldset disabled={editing}>
      <legend>What kind of value?</legend>
      <div class="kinds" role="radiogroup" aria-label="Kind of value">
        {#each KINDS as [key, label] (key)}
          <button
            type="button"
            role="radio"
            aria-checked={kind === key}
            onclick={() => pickKind(key)}>{label}</button
          >
        {/each}
      </div>
    </fieldset>

    {#if kind === 'number' || kind === 'seconds'}
      <div class="pair">
        <TextField
          label="Step"
          id="feature-step"
          plain
          inputmode="decimal"
          autocomplete="off"
          bind:value={stepText}
        />
        {#if kind === 'number'}
          <TextField
            label="Unit"
            id="feature-unit"
            plain
            autocomplete="off"
            placeholder="e.g. ml"
            readonly={used}
            bind:value={unit}
          />
        {:else}
          <TextField
            label="Range"
            id="feature-range"
            inputmode="decimal"
            plain
            autocomplete="off"
            placeholder="Optional · e.g. 0–30 s"
            bind:value={rangeText}
          />
        {/if}
      </div>
      {#if kind === 'number'}
        <TextField
          label="Range"
          id="feature-range"
          inputmode="decimal"
          plain
          autocomplete="off"
          placeholder="Optional · e.g. 0–30 {unitLabel || 'ml'}"
          bind:value={rangeText}
        />
      {/if}
    {:else if kind === 'choice'}
      <!-- D-152: one text row per option where Step and Range sit; at least two. -->
      <div class="options">
        {#each options as o, i (o.id)}
          <div class="option">
            <input
              class="option-input"
              aria-label="Option {i + 1}"
              placeholder="Option {i + 1}"
              autocomplete="off"
              bind:value={o.label}
            />
            {#if options.length > 2 && !kept.has(o.id)}
              <button
                type="button"
                class="remove cn-tap"
                aria-label="Remove option {o.label.trim() || i + 1}"
                onclick={() => (options = options.filter((x) => x.id !== o.id))}
              >
                <svg
                  width="18"
                  height="18"
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="currentColor"
                  stroke-width="2"
                  stroke-linecap="round"
                  aria-hidden="true"><path d="M6 6l12 12M18 6L6 18" /></svg
                >
              </button>
            {/if}
          </div>
        {/each}
        <button type="button" class="add cn-tap" onclick={() => (options = [...options, option()])}>
          <svg
            width="16"
            height="16"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            stroke-width="2.4"
            stroke-linecap="round"
            aria-hidden="true"><path d="M12 5v14M5 12h14" /></svg
          >Add option
        </button>
      </div>
    {/if}

    <section class="preview" aria-label="Preview">
      <div class="preview-head">
        <h3>Preview</h3>
        <span>Shot form › More › Setup</span>
      </div>
      <div class="cn-preview frame" aria-hidden="true" inert>
        {#if kind === 'number' || kind === 'seconds'}
          <div class="row">
            <SetupRow
              label={previewName}
              switchable
              value={sample}
              unit={unitLabel || ' '}
              step={step && step > 0 ? step : 1000}
              onvalue={() => {}}
            />
          </div>
        {:else}
          <div class="cn-row toggle-row">
            <button
              type="button"
              class="cn-switch"
              role="switch"
              aria-checked="true"
              aria-label="On"
              tabindex="-1"
            ></button>
            <span class="cn-row__label">{previewName}</span>
            <span class="soft">{kind === 'choice' ? previewOption : 'On'}</span>
          </div>
        {/if}
        <span class="cn-caption note">Part of the recipe: changing it starts a new recipe</span>
      </div>
    </section>

    {#if problem}<p class="problem" role="status">{problem}</p>{/if}
    <button type="button" class="cn-btn-primary cn-tap-strong" disabled={!!problem} onclick={save}
      >{editing ? 'Save feature' : 'Add feature'}</button
    >
    {#if editing && !used}
      <button type="button" class="cn-btn-quiet cn-tap" onclick={ondelete}>Delete feature</button>
    {/if}
  </div>
</BottomSheet>

<style>
  .body {
    --surface: var(--surface-sheet-field);
    display: flex;
    flex-direction: column;
    gap: var(--space-3);
    min-height: 0;
  }

  h2 {
    margin: 0;
    font-size: 19px;
    font-weight: 700;
  }

  .heading {
    display: flex;
    flex-direction: column;
    gap: 4px;
  }

  fieldset {
    margin: 0;
    padding: 0;
    border: none;
  }

  legend {
    padding: 0;
    margin-bottom: 6px;
    font-size: 13px;
    color: var(--ink-muted);
  }

  .kinds {
    display: grid;
    grid-template-columns: repeat(2, minmax(0, 1fr));
    gap: 6px;
  }

  .kinds button {
    height: var(--touch-min);
    border-radius: var(--radius-block);
    border: none;
    background: var(--surface-sheet-field);
    color: var(--ink);
    font-size: 14px;
    font-weight: 500;
  }

  .kinds button[aria-checked='true'] {
    background: var(--amber);
    color: var(--on-amber);
    font-weight: 700;
  }

  .pair {
    display: grid;
    grid-template-columns: repeat(2, minmax(0, 1fr));
    gap: 10px;
  }

  .options {
    display: flex;
    flex-direction: column;
    gap: 6px;
    max-height: 196px;
    overflow-y: auto;
    scrollbar-width: none;
  }

  .options::-webkit-scrollbar {
    display: none;
  }

  .option {
    flex: none;
    display: flex;
    align-items: center;
    min-height: 48px;
    padding: 0 4px 0 14px;
    border-radius: var(--radius-md);
    background: var(--surface);
  }

  .option:focus-within {
    box-shadow: 0 0 0 2px var(--amber);
  }

  .option-input {
    flex: 1;
    min-width: 0;
    border: none;
    padding: 0;
    background: transparent;
    color: var(--ink);
    font: inherit;
    font-size: 16px;
  }

  .option-input::placeholder {
    color: var(--ink-muted);
  }

  .option-input:focus-visible {
    outline: none;
  }

  .remove {
    flex: none;
    width: var(--touch-min);
    height: var(--touch-min);
    border: none;
    border-radius: var(--radius-sm);
    background: transparent;
    color: var(--ink-muted);
    display: flex;
    align-items: center;
    justify-content: center;
  }

  .add {
    flex: none;
    display: flex;
    align-items: center;
    gap: var(--space-2);
    min-height: var(--touch-min);
    padding: 0 14px;
    border: none;
    border-radius: var(--radius-md);
    background: transparent;
    color: var(--ink-muted);
    font-size: 14px;
    font-weight: 500;
    text-align: left;
  }

  .preview {
    display: flex;
    flex-direction: column;
    gap: var(--space-2);
    margin-top: var(--space-1);
  }

  .preview-head {
    display: flex;
    justify-content: space-between;
    align-items: baseline;
  }

  h3 {
    margin: 0;
    font-size: 15px;
    font-weight: 600;
  }

  .preview-head span {
    font-size: 12px;
    color: var(--ink-muted);
  }

  .frame {
    display: flex;
    flex-direction: column;
    gap: var(--space-2);
  }

  .row {
    border-radius: var(--radius-md);
    overflow: hidden;
  }

  .toggle-row {
    min-height: 64px;
  }

  .toggle-row .cn-switch {
    flex: none;
  }

  .soft {
    font-size: 14px;
    color: var(--ink-muted);
  }

  .note {
    padding: 0 4px;
  }

  .problem {
    margin: 0;
    text-align: center;
    font-size: 13px;
    line-height: 1.4;
    color: var(--ink-soft);
  }

  .in-use {
    margin: 0;
    font-size: 14px;
    line-height: 1.45;
    color: var(--ink-soft);
  }

  .kinds button:disabled:not([aria-checked='true']) {
    color: var(--ink-muted);
  }

  button:disabled {
    opacity: 0.5;
  }

  .kinds button:disabled {
    opacity: 1;
    cursor: default;
  }
</style>
