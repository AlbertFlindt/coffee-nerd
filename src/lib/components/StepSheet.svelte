<script lang="ts">
  // The step sheet (screen 20, D-52): a bottom sheet on the Puck prep page. Adds a step, or edits one
  // (D-168): once a shot used it the kind and unit stay and listed options cannot be removed. A step that
  // a routine contains cannot be deleted or archived (D-169). It posts to the page's form actions.
  import { enhance } from '$app/forms';
  import { untrack } from 'svelte';
  import BottomSheet from '#lib/components/BottomSheet.svelte';
  import TextField from '#lib/components/TextField.svelte';
  import { readQuantity, readRange } from '#lib/domain/gear.ts';
  import type { PrepStepSetting } from '#lib/domain/schemas.ts';
  import { decimalsFor, formatNumber } from '#lib/domain/units.ts';
  import type { StepItem } from '#lib/server/db/puck-prep.ts';

  type Kind = PrepStepSetting['kind'];

  let {
    step,
    problems = [],
    onclose
  }: {
    /** The step being edited; without one the sheet adds a step. */
    step?: StepItem;
    /** What the server refused, in words. */
    problems?: string[];
    onclose: () => void;
  } = $props();

  const KINDS: [Kind, string][] = [
    ['none', 'No setting'],
    ['number', 'Number with unit'],
    ['seconds', 'Seconds'],
    ['choice', 'Pick from a list']
  ];

  const editing = untrack(() => step !== undefined);
  const used = untrack(() => step?.used ?? false);
  const routines = untrack(() => step?.routines ?? []);
  const start = untrack(() => step?.setting);

  const option = (label = '') => ({ id: `option-${crypto.randomUUID()}`, label });
  const text = (v: number, s: number) => formatNumber(v, decimalsFor(v, s));

  let name = $state(untrack(() => step?.name ?? ''));
  let kind: Kind = $state(start?.kind ?? 'number');
  let unit = $state(start?.kind === 'number' ? start.unit : '');
  let stepText = $state(
    start && 'step' in start
      ? text(start.step, start.step) + (start.kind === 'seconds' ? ' s' : '')
      : '1'
  );
  let startsText = $state(
    start && (start.kind === 'number' || start.kind === 'seconds')
      ? text(start.startsAt, start.step) + (start.kind === 'seconds' ? ' s' : ` ${start.unit}`)
      : ''
  );
  let rangeText = $state(
    start && (start.kind === 'number' || start.kind === 'seconds') && start.max !== undefined
      ? `${text(start.min ?? 0, start.step)}–${text(start.max, start.step)}`
      : ''
  );
  let options = $state(
    start?.kind === 'choice' ? start.options.map((o) => ({ ...o })) : [option(), option()]
  );
  let chosen = $state(start?.kind === 'choice' ? start.startsAt : '');
  // Options of a used step keep their place: shots point to them.
  const kept = new Set(start?.kind === 'choice' && used ? start.options.map((o) => o.id) : []);

  function pickKind(next: Kind) {
    // An untouched step follows the kind: "1 s" for seconds, "1" for a number.
    if (stepText === '1' && next === 'seconds') stepText = '1 s';
    else if (stepText === '1 s' && next === 'number') stepText = '1';
    kind = next;
  }

  const unitLabel = $derived(kind === 'seconds' ? 's' : unit.trim());
  const stepValue = $derived(readQuantity(stepText));
  const range = $derived(readRange(rangeText));
  const starts = $derived(readQuantity(startsText));
  const labels = $derived(options.map((o) => o.label.trim()));
  const startId = $derived(options.some((o) => o.id === chosen) ? chosen : (options[0]?.id ?? ''));

  const problem = $derived.by(() => {
    if (name.trim() === '') return 'Name is required';
    const numeric = kind === 'number' || kind === 'seconds';
    if (kind === 'number' && unit.trim() === '') return 'Unit is required';
    if (numeric && (stepValue === null || stepValue <= 0)) return 'The step must be more than 0';
    if (numeric && range === null) return 'The range must run from low to high, like 0–5';
    if (numeric && starts === null) return 'Starts at is required';
    if (numeric && starts !== null) {
      const { min, max } = range ?? {};
      if ((min !== undefined && starts < min) || (max !== undefined && starts > max))
        return 'Starts at must be within the range';
    }
    if (kind === 'choice' && (options.length < 2 || labels.some((l) => l === '')))
      return 'Give at least two options a name';
    return null;
  });

  function setting(): PrepStepSetting {
    const { min, max } = range ?? {};
    const limits = { ...(min !== undefined && { min }), ...(max !== undefined && { max }) };
    switch (kind) {
      case 'none':
        return { kind };
      case 'number':
        return {
          kind,
          unit: unit.trim(),
          step: stepValue ?? 0,
          ...limits,
          startsAt: starts ?? 0
        };
      case 'seconds':
        return { kind, step: stepValue ?? 0, ...limits, startsAt: starts ?? 0 };
      case 'choice':
        return {
          kind,
          options: options.map((o) => ({ id: o.id, label: o.label.trim() })),
          startsAt: startId
        };
    }
  }

  const payload = $derived(
    problem ? '' : JSON.stringify({ name: name.trim(), setting: setting() })
  );

  // The preview row: what the routine builder shows for this step.
  const previewName = $derived(name.trim() || 'Your step');
  const pill = $derived.by(() => {
    if (kind === 'none') return null;
    if (kind === 'choice') return options.find((o) => o.id === startId)?.label.trim() || '—';
    const s = stepValue && stepValue > 0 ? stepValue : 1000;
    const value = starts ?? 0;
    return `${text(value, s)}${unitLabel ? ` ${unitLabel}` : ''}`;
  });

  let pending = $state(false);
  let serverProblems: string[] = $state(untrack(() => problems));
  const submit = () => {
    pending = true;
    serverProblems = [];
    return async ({
      result,
      update
    }: {
      result: { type: string; data?: Record<string, unknown> };
      update: (options?: { reset?: boolean }) => Promise<void>;
    }) => {
      pending = false;
      if (result.type === 'success' || result.type === 'redirect') {
        onclose();
        await update();
        return;
      }
      // What the server refused belongs to this sheet only, not to the next one opened.
      const refused = result.type === 'failure' ? result.data?.problems : undefined;
      serverProblems = Array.isArray(refused)
        ? refused.map(String)
        : ['Something on this page is not right'];
    };
  };
</script>

<BottomSheet
  short
  label={editing ? `Edit ${step?.name}` : 'New step'}
  closeLabel={editing ? 'Close without saving' : 'Close without adding'}
  {onclose}
>
  <div class="card-scope">
    <div class="body">
      <h2>{editing ? step?.name : 'New step'}</h2>

      <TextField label="Name" id="step-name" autocomplete="off" bind:value={name} />

      {#if used}
        <!-- Screen 53, D-168: once a shot used the step, its kind of setting (and unit) only shows. -->
        <div class="fixed">
          <span class="cn-caption">Setting</span>
          <span class="fixed-value"
            >{KINDS.find(([key]) => key === kind)?.[1]}{kind === 'number' && unit
              ? ` · ${unit}`
              : ''}</span
          >
        </div>
      {:else}
        <fieldset>
          <legend>Setting</legend>
          <div class="kinds" role="radiogroup" aria-label="Setting">
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
      {/if}

      {#if kind === 'number' || kind === 'seconds'}
        {#if kind === 'number' && !used}
          <div class="pair">
            <TextField label="Unit" id="step-unit" autocomplete="off" bind:value={unit} />
            <TextField
              label="Step"
              id="step-step"
              inputmode="decimal"
              autocomplete="off"
              bind:value={stepText}
            />
          </div>
        {/if}
        <div class="pair">
          {#if kind === 'seconds' || used}
            <TextField
              label="Step"
              id="step-step"
              inputmode="decimal"
              autocomplete="off"
              bind:value={stepText}
            />
          {/if}
          <TextField
            label="Starts at"
            id="step-default"
            inputmode="decimal"
            autocomplete="off"
            bind:value={startsText}
          />
          <TextField
            label="Range"
            id="step-range"
            autocomplete="off"
            placeholder="Optional · e.g. 0–5"
            bind:value={rangeText}
          />
        </div>
      {:else if kind === 'choice'}
        <!-- D-152: one text row per option; at least two. The radio picks the option it starts on;
             screen 52 puts the hint above the options. -->
        <p class="hint">Tap the circle of the option it starts on</p>
        <div class="options" role="radiogroup" aria-label="Starts at">
          {#each options as o, i (o.id)}
            <div class="option">
              <button
                type="button"
                class="start"
                role="radio"
                aria-checked={startId === o.id}
                aria-label="Starts at {o.label.trim() || `option ${i + 1}`}"
                onclick={() => (chosen = o.id)}><span class="dot"></span></button
              >
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
          <button
            type="button"
            class="add cn-tap"
            onclick={() => (options = [...options, option()])}
          >
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
          <span>Routine builder</span>
        </div>
        <div class="cn-preview" aria-hidden="true">
          <div class="prow">
            <span class="grip">
              <svg width="18" height="18" viewBox="0 0 24 24" fill="currentColor"
                ><circle cx="9" cy="6" r="1.6" /><circle cx="15" cy="6" r="1.6" /><circle
                  cx="9"
                  cy="12"
                  r="1.6"
                /><circle cx="15" cy="12" r="1.6" /><circle cx="9" cy="18" r="1.6" /><circle
                  cx="15"
                  cy="18"
                  r="1.6"
                /></svg
              >
            </span>
            <span class="pname">{previewName}</span>
            {#if pill}
              <span class="pill">{pill}</span>
            {:else}
              <span class="none">No settings</span>
            {/if}
            <span class="pdel">
              <svg
                width="16"
                height="16"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                stroke-width="2.2"
                stroke-linecap="round"><path d="M6 6l12 12M18 6L6 18" /></svg
              >
            </span>
          </div>
        </div>
      </section>

      <!-- As drawn (screen 20): space between the preview and the button. -->
      <div class="push"></div>
      {#each [problem ? [problem] : serverProblems] as lines (lines)}
        {#each lines as line (line)}<p class="problem" role="status">{line}</p>{/each}
      {/each}

      <form method="POST" action={editing ? '?/saveStep' : '?/addStep'} use:enhance={submit}>
        {#if editing}<input type="hidden" name="id" value={step?.id} />{/if}
        <input type="hidden" name="payload" value={payload} />
        <button type="submit" class="cn-btn-primary cn-tap-strong" disabled={!!problem || pending}
          >{editing ? 'Save step' : 'Add step'}</button
        >
      </form>

      {#if editing && routines.length > 0}
        <!-- D-169 -->
        <p class="in-use">Used in {routines.join(', ')}</p>
      {:else if editing}
        <form method="POST" action="?/removeStep" use:enhance={submit}>
          <input type="hidden" name="id" value={step?.id} />
          <button type="submit" class="cn-btn-quiet cn-tap" disabled={pending}
            >{used ? 'Archive step' : 'Delete step'}</button
          >
        </form>
      {/if}
    </div>
  </div>
</BottomSheet>

<style>
  .card-scope {
    --card: var(--surface);
    display: contents;
  }

  .body {
    --surface: var(--surface-sheet-field);
    display: flex;
    flex-direction: column;
    gap: var(--space-3);
    min-height: 0;
  }

  .push {
    flex: none;
    height: 96px;
  }

  form {
    display: contents;
  }

  h2 {
    margin: 0;
    font-size: 19px;
    font-weight: 700;
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
    background: var(--surface);
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

  /* Screen 53: a third field in the pair (Range) takes the full width. */
  .pair > :global(:nth-child(3)) {
    grid-column: 1 / -1;
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
    padding: 0 4px 0 0;
    border-radius: var(--radius-md);
    background: var(--surface);
  }

  .option:focus-within {
    box-shadow: 0 0 0 2px var(--amber);
  }

  .start {
    flex: none;
    width: var(--touch-min);
    height: var(--touch-min);
    border: none;
    background: transparent;
    display: flex;
    align-items: center;
    justify-content: center;
  }

  .dot {
    width: 18px;
    height: 18px;
    box-sizing: border-box;
    border-radius: 50%;
    border: 2px solid var(--ink-muted);
  }

  .start[aria-checked='true'] .dot {
    border-color: var(--amber);
    background: radial-gradient(var(--amber) 0 4px, transparent 5px);
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

  .prow {
    display: flex;
    align-items: center;
    gap: 4px;
    min-height: 60px;
    padding: 0 4px 0 2px;
    border-radius: var(--radius-md);
    background: var(--card);
  }

  .grip,
  .pdel {
    flex: none;
    display: flex;
    align-items: center;
    justify-content: center;
    color: var(--ink-muted);
  }

  .grip {
    width: 40px;
    height: var(--touch-min);
  }

  .pdel {
    width: var(--touch-min);
    height: var(--touch-min);
  }

  .pname {
    flex: 1;
    min-width: 0;
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
    font-size: 15px;
    font-weight: 600;
  }

  .pill {
    display: flex;
    align-items: center;
    height: 36px;
    padding: 0 10px;
    border-radius: var(--radius-xl);
    background: var(--bg);
    color: var(--amber);
    font-size: 14px;
    font-weight: 700;
  }

  .none {
    font-size: 14px;
    color: var(--ink-muted);
  }

  .problem,
  .in-use,
  .hint {
    margin: 0 0 -6px;
    font-size: 13px;
    color: var(--ink-soft);
  }

  .fixed {
    display: flex;
    flex-direction: column;
    justify-content: center;
    gap: 2px;
    min-height: 56px;
    padding: 0 14px;
    border-radius: var(--radius-md);
    background: var(--surface);
  }

  .fixed-value {
    font-size: 16px;
    font-weight: 600;
  }

  .hint,
  .in-use {
    color: var(--ink-muted);
  }

  .in-use {
    text-align: center;
  }

  button:disabled {
    opacity: 0.5;
  }
</style>
