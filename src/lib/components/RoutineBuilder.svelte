<script lang="ts">
  // The routine builder (screen 19; D-51, D-164, D-165, D-167): a name, then a straight line of steps between
  // "Dose in basket" and "Lock in and brew". A small + between two items inserts a step from your steps
  // (D-164), the amber value opens a small sheet to set it (D-165), the handle drags (or ArrowUp/ArrowDown
  // moves) a step, × removes it. Only the flow scrolls (D-36). Archive or delete sits under Save (D-167).
  import { untrack } from 'svelte';
  import { enhance } from '$app/forms';
  import { resolve } from '$app/paths';
  import BottomSheet from '#lib/components/BottomSheet.svelte';
  import ConfirmDialog from '#lib/components/ConfirmDialog.svelte';
  import PickRow from '#lib/components/PickRow.svelte';
  import TextField from '#lib/components/TextField.svelte';
  import ValueCard from '#lib/components/ValueCard.svelte';
  import { trimmed } from '#lib/domain/gear.ts';
  import { decimalsForStep } from '#lib/domain/units.ts';
  import type { RoutineItem, StepItem } from '#lib/server/db/puck-prep.ts';

  let {
    routine,
    steps,
    problems = [],
    onnewstep,
    added = null
  }: {
    routine?: RoutineItem;
    steps: StepItem[];
    problems?: string[];
    onnewstep: (position: number) => void;
    /** A step the page just created after onnewstep: insert it at that position. */
    added?: { stepId: string; position: number } | null;
  } = $props();

  type Entry = { key: number; stepId: string; value: number | string | null };

  let nextKey = 0;
  // svelte-ignore state_referenced_locally
  let name = $state(routine?.name ?? '');
  // svelte-ignore state_referenced_locally
  let items = $state<Entry[]>((routine?.steps ?? []).map((s) => ({ key: nextKey++, ...s })));
  let sheet = $state<
    | { kind: 'insert'; position: number }
    | { kind: 'value'; key: number }
    | 'archive'
    | 'delete'
    | null
  >(null);
  let saving = $state(false);
  let confirming = $state(false);

  const byId = $derived(new Map(steps.map((s) => [s.id, s])));
  const payload = $derived(
    JSON.stringify({ name, steps: items.map(({ stepId, value }) => ({ stepId, value })) })
  );
  const editKey = $derived(
    sheet !== null && typeof sheet === 'object' && sheet.kind === 'value' ? sheet.key : null
  );
  const editing = $derived(items.find((i) => i.key === editKey) ?? null);

  function stepOf(entry: Entry) {
    return byId.get(entry.stepId);
  }
  function nameOf(entry: Entry) {
    return stepOf(entry)?.name ?? 'Removed step';
  }
  function startValue(step: StepItem): number | string | null {
    return step.setting.kind === 'none' ? null : step.setting.startsAt;
  }

  /** The pill text: "20 s", "15 kg" or the option's label; null when the step has no setting. */
  function pillText(entry: Entry): string | null {
    const step = stepOf(entry);
    if (!step) return entry.value === null ? null : String(entry.value);
    const setting = step.setting;
    if (setting.kind === 'none') return null;
    const value = entry.value ?? setting.startsAt;
    if (setting.kind === 'choice')
      return setting.options.find((o) => o.id === value)?.label ?? String(value);
    return trimmed(Number(value), setting.kind === 'seconds' ? 's' : setting.unit);
  }

  function insertAt(position: number, stepId: string) {
    const step = byId.get(stepId);
    const entry: Entry = { key: nextKey++, stepId, value: step ? startValue(step) : null };
    items.splice(Math.min(Math.max(position, 0), items.length), 0, entry);
  }

  // The page reports a step it just made: insert it once per new object.
  let lastAdded: object | null = null;
  $effect(() => {
    if (added && added !== lastAdded) {
      lastAdded = added;
      const { stepId, position } = added;
      untrack(() => insertAt(position, stepId));
    }
  });

  function move(from: number, to: number) {
    if (to < 0 || to >= items.length || from === to) return;
    const [entry] = items.splice(from, 1);
    items.splice(to, 0, entry);
  }

  // Dragging: capture on the list (it never moves, the handle does when rows swap).
  let dragKey: number | null = $state(null);
  let list: HTMLOListElement | undefined = $state();

  function rowRect(key: number) {
    return list?.querySelector(`[data-key="${key}"]`)?.getBoundingClientRect();
  }
  function dragstart(e: PointerEvent, key: number) {
    list?.setPointerCapture(e.pointerId);
    dragKey = key;
    e.preventDefault();
  }
  function dragmove(e: PointerEvent) {
    if (dragKey === null) return;
    const at = items.findIndex((i) => i.key === dragKey);
    const above = at > 0 ? rowRect(items[at - 1].key) : undefined;
    const below = at < items.length - 1 ? rowRect(items[at + 1].key) : undefined;
    if (above && e.clientY < above.top + above.height / 2) move(at, at - 1);
    else if (below && e.clientY > below.top + below.height / 2) move(at, at + 1);
  }
  function dragend() {
    dragKey = null;
  }
  async function handlekey(e: KeyboardEvent, key: number) {
    const delta = e.key === 'ArrowUp' ? -1 : e.key === 'ArrowDown' ? 1 : 0;
    if (!delta) return;
    e.preventDefault();
    move(
      items.findIndex((i) => i.key === key),
      items.findIndex((i) => i.key === key) + delta
    );
    // The row is re-created in place by the keyed list; keep the focus on its handle.
    await Promise.resolve();
    (list?.querySelector(`[data-key="${key}"] .handle`) as HTMLElement | null)?.focus();
  }
</script>

{#snippet plus(size: number, width: number)}
  <svg
    width={size}
    height={size}
    viewBox="0 0 24 24"
    fill="none"
    stroke="currentColor"
    stroke-width={width}
    stroke-linecap="round"
    aria-hidden="true"><path d="M12 5v14M5 12h14" /></svg
  >
{/snippet}

{#snippet connector(position: number, after: string)}
  <li class="connector">
    <span class="line"></span>
    <button
      type="button"
      class="add cn-tap"
      aria-label="Insert a step after {after}"
      onclick={() => (sheet = { kind: 'insert', position })}>{@render plus(14, 2.6)}</button
    >
  </li>
{/snippet}

<header>
  <a class="icon cn-tap" href={resolve('/library/puck-prep')} aria-label="Close without saving">
    <svg
      width="22"
      height="22"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      stroke-width="2"
      stroke-linecap="round"
      aria-hidden="true"><path d="M6 6l12 12M18 6L6 18" /></svg
    >
  </a>
  <h1>Routine</h1>
  <span></span>
</header>

<main>
  <TextField label="Name" id="routine-name" bind:value={name} autocomplete="off" />

  <div class="flow">
    <ol
      aria-label="Steps, top to bottom"
      bind:this={list}
      onpointermove={dragmove}
      onpointerup={dragend}
      onpointercancel={dragend}
    >
      <li class="cap">Dose in basket</li>
      {@render connector(0, 'Dose in basket')}
      {#each items as entry, i (entry.key)}
        {@const label = nameOf(entry)}
        {@const pill = pillText(entry)}
        <li class="step" class:dragging={dragKey === entry.key} data-key={entry.key}>
          <button
            type="button"
            class="handle"
            aria-label="Drag to move {label}"
            onpointerdown={(e) => dragstart(e, entry.key)}
            onkeydown={(e) => handlekey(e, entry.key)}
          >
            <svg width="18" height="18" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true"
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
          </button>
          <span class="step-name">{label}</span>
          {#if pill !== null && stepOf(entry)}
            <button
              type="button"
              class="pill cn-tap"
              aria-label="{label} setting, {pill}. Tap to change"
              onclick={() => (sheet = { kind: 'value', key: entry.key })}>{pill}</button
            >
          {:else if pill !== null}
            <span class="none">{pill}</span>
          {:else}
            <span class="none">No settings</span>
          {/if}
          <button
            type="button"
            class="remove cn-tap"
            aria-label="Remove {label}"
            onclick={() => items.splice(i, 1)}
          >
            <svg
              width="16"
              height="16"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              stroke-width="2.2"
              stroke-linecap="round"
              aria-hidden="true"><path d="M6 6l12 12M18 6L6 18" /></svg
            >
          </button>
        </li>
        {@render connector(i + 1, label)}
      {/each}
      <li class="cap">Lock in and brew</li>
    </ol>
    <p class="hint">Drag ⠿ to reorder · tap + to insert a step</p>
  </div>
</main>

<footer>
  {#each problems as problem (problem)}
    <p class="problem" role="alert">{problem}</p>
  {/each}
  <form
    method="POST"
    action="?/save"
    use:enhance={() => {
      saving = true;
      return async ({ update }) => {
        await update();
        saving = false;
      };
    }}
  >
    <input type="hidden" name="payload" value={payload} />
    <button class="cn-btn-primary cn-tap-strong" disabled={saving}>Save routine</button>
  </form>
  {#if routine}
    {#if routine.inMySetup}
      <p class="in-use">Used in My setup · choose another default first</p>
    {:else if routine.used}
      <button class="cn-btn-quiet cn-tap" type="button" onclick={() => (sheet = 'archive')}
        >Archive</button
      >
    {:else}
      <button class="cn-btn-quiet cn-tap" type="button" onclick={() => (sheet = 'delete')}
        >Delete routine</button
      >
    {/if}
  {/if}
</footer>

{#if sheet === 'archive' || sheet === 'delete'}
  <!-- D-167, D-148, D-145: the confirmation sheet. -->
  <ConfirmDialog
    label={sheet === 'archive' ? 'Archive this routine' : 'Delete this routine'}
    closeLabel="Keep the routine"
    onclose={() => (sheet = null)}
  >
    {#if sheet === 'archive'}
      <h2 class="sheet-title">Archive this routine?</h2>
      <p class="note">It leaves the Puck prep page and the pickers. Past shots keep its name.</p>
    {:else}
      <h2 class="sheet-title">Delete this routine?</h2>
      <p class="note">No shot has used it. This cannot be undone.</p>
    {/if}
    <form
      class="confirm"
      method="POST"
      action={sheet === 'archive' ? '?/archive' : '?/delete'}
      onsubmit={() => (confirming = true)}
    >
      <button class="cn-btn-danger cn-tap-strong" type="submit" disabled={confirming}
        >{sheet === 'archive' ? 'Archive' : 'Delete routine'}</button
      >
      <button class="cn-btn-primary cn-tap-strong" type="button" onclick={() => (sheet = null)}
        >Keep it</button
      >
    </form>
  </ConfirmDialog>
{:else if sheet !== null && sheet.kind === 'insert'}
  <!-- Read safely: closing the sheet clears it while this block is still being torn down. -->
  {@const position = sheet?.kind === 'insert' ? sheet.position : 0}
  <BottomSheet
    short
    label="Insert a step"
    closeLabel="Close step list"
    onclose={() => (sheet = null)}
  >
    <h2 class="sheet-title">Insert a step</h2>
    <div class="list">
      {#each steps as step (step.id)}
        <!-- Screen 54: the shared list rows; the unit stays as the line under the name. -->
        <PickRow
          label={step.name}
          sub={step.unit || undefined}
          onclick={() => {
            insertAt(position, step.id);
            sheet = null;
          }}
        />
      {/each}
    </div>
    <button
      type="button"
      class="new cn-tap"
      onclick={() => {
        const at = position;
        sheet = null;
        onnewstep(at);
      }}
    >
      <span class="new-plus">{@render plus(16, 2.4)}</span>New step
    </button>
  </BottomSheet>
{:else if editing}
  {@const step = stepOf(editing)}
  {#if step && step.setting.kind !== 'none'}
    {@const setting = step.setting}
    {@const key = editing.key}
    <BottomSheet
      short
      label="{step.name} setting"
      closeLabel="Close"
      onclose={() => (sheet = null)}
    >
      <h2 class="sheet-title">{step.name}</h2>
      {#if setting.kind === 'choice'}
        <div class="list">
          {#each setting.options as option (option.id)}
            <PickRow
              label={option.label}
              chosen={(editing.value ?? setting.startsAt) === option.id}
              onclick={() => {
                const entry = items.find((i) => i.key === key);
                if (entry) entry.value = option.id;
                sheet = null;
              }}
            />
          {/each}
        </div>
      {:else}
        <ValueCard
          label={step.name}
          value={Number(editing.value ?? setting.startsAt)}
          unit={setting.kind === 'seconds' ? 's' : setting.unit}
          unitName={setting.kind === 'seconds' ? 'second' : setting.unit}
          step={setting.step}
          decimals={decimalsForStep(setting.step)}
          min={setting.min}
          max={setting.max}
          onchange={(v) => {
            const entry = items.find((i) => i.key === key);
            if (entry && v !== null) entry.value = v;
          }}
        />
        <!-- Screen 55: Done is the sheet's one action. -->
        <button class="cn-btn-primary cn-tap-strong" type="button" onclick={() => (sheet = null)}
          >Done</button
        >
      {/if}
    </BottomSheet>
  {/if}
{/if}

<style>
  header {
    display: grid;
    grid-template-columns: 48px 1fr 48px;
    align-items: center;
    height: 60px;
    padding: 0 var(--space-2);
  }

  h1 {
    margin: 0;
    text-align: center;
    font-size: 20px;
    font-weight: 600;
  }

  .icon {
    width: var(--touch-min);
    height: var(--touch-min);
    display: flex;
    align-items: center;
    justify-content: center;
    border-radius: var(--radius-sm);
    color: var(--ink);
  }

  main {
    flex: 1;
    min-height: 0;
    display: flex;
    flex-direction: column;
    gap: 14px;
    padding: var(--space-1) var(--space-5) var(--space-3);
    overflow: hidden;
  }

  /* D-36: only the flow scrolls; no visible scrollbar. */
  .flow {
    flex: 1;
    min-height: 0;
    overflow-y: auto;
    scrollbar-width: none;
    display: flex;
    flex-direction: column;
    gap: 14px;
  }

  .flow::-webkit-scrollbar {
    display: none;
  }

  ol {
    list-style: none;
    margin: 0;
    padding: 0;
    display: flex;
    flex-direction: column;
  }

  .cap {
    align-self: center;
    padding: 8px 16px;
    border-radius: var(--radius-xl);
    border: 1.5px solid var(--line);
    font-size: 13px;
    font-weight: 600;
    color: var(--ink-muted);
  }

  .connector {
    position: relative;
    height: 34px;
    display: flex;
    justify-content: center;
    align-items: center;
  }

  .line {
    position: absolute;
    top: 0;
    bottom: 0;
    left: 50%;
    width: 2px;
    margin-left: -1px;
    background: var(--line);
  }

  .add {
    position: relative;
    width: 30px;
    height: 30px;
    padding: 0;
    border-radius: var(--radius-pill);
    border: 1.5px solid var(--line);
    background: var(--bg);
    color: var(--ink-muted);
    display: flex;
    align-items: center;
    justify-content: center;
  }

  /* Touch target of 44 px or more around the 30 px drawn circle. */
  .add::before {
    content: '';
    position: absolute;
    inset: -7px;
  }

  .step {
    display: flex;
    align-items: center;
    gap: 4px;
    min-height: 60px;
    padding: 0 4px 0 2px;
    border-radius: var(--radius-md);
    background: var(--surface);
  }

  .step.dragging {
    outline: 2px solid var(--line);
  }

  .handle {
    width: 40px;
    height: 44px;
    flex: none;
    padding: 0;
    border: none;
    background: transparent;
    color: var(--ink-muted);
    display: flex;
    align-items: center;
    justify-content: center;
    cursor: grab;
    touch-action: none;
    border-radius: var(--radius-sm);
  }

  .step-name {
    flex: 1;
    min-width: 0;
    font-size: 15px;
    font-weight: 600;
  }

  .pill {
    height: 36px;
    padding: 0 10px;
    border-radius: var(--radius-pill);
    border: none;
    background: var(--bg);
    color: var(--amber);
    font: inherit;
    font-size: 14px;
    font-weight: 700;
    position: relative;
  }

  .pill::before {
    content: '';
    position: absolute;
    inset: -4px 0;
  }

  .none {
    font-size: 13px;
    color: var(--ink-muted);
    padding: 0 6px;
  }

  .remove {
    width: var(--touch-min);
    height: var(--touch-min);
    flex: none;
    padding: 0;
    border: none;
    background: transparent;
    color: var(--ink-muted);
    display: flex;
    align-items: center;
    justify-content: center;
    border-radius: var(--radius-sm);
  }

  .hint {
    margin: 0;
    text-align: center;
    font-size: 12px;
    color: var(--ink-muted);
  }

  footer {
    display: flex;
    flex-direction: column;
    gap: var(--space-2);
    padding: var(--space-2) var(--space-5) var(--space-6);
  }

  .problem,
  .in-use {
    margin: 0;
    font-size: 13px;
    color: var(--ink-soft);
  }

  .in-use {
    text-align: center;
    color: var(--ink-muted);
  }

  .sheet-title {
    margin: 4px 0 0;
    font-size: 19px;
    line-height: 24px;
    font-weight: 700;
  }

  /* Screen 56: the line sits close under the question, the buttons a little further down. */
  .note {
    margin: -8px 0 8px;
    font-size: 14px;
    line-height: 1.45;
    color: var(--ink-soft);
  }

  .confirm {
    display: flex;
    flex-direction: column;
    gap: var(--space-2);
  }

  .list {
    display: flex;
    flex-direction: column;
    flex: 0 1 auto;
    min-height: 0;
    gap: 2px;
    border-radius: var(--radius-md);
    overflow-y: auto;
    scrollbar-width: none;
  }

  .list::-webkit-scrollbar {
    display: none;
  }

  /* Screen 54: "New step" is a dashed row under the list, its + in amber. */
  .new {
    display: flex;
    align-items: center;
    gap: 10px;
    min-height: 52px;
    flex: none;
    padding: 0 14px;
    border-radius: var(--radius-md);
    border: 1.5px dashed var(--line);
    background: transparent;
    color: var(--ink);
    font-size: 15px;
    font-weight: 600;
    text-align: left;
  }

  .new-plus {
    display: flex;
    color: var(--amber);
  }
</style>
