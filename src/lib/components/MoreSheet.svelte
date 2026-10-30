<script lang="ts">
  // The Setup or the Tasting sheet, each opened by its own button on the shot form. Setup:
  // temperature, pressure profile, basket, puck prep, changes since the last shot in
  // sage. Tasting: balance, body, sweetness, aftertaste, flavor notes that fold away
  // and notes; all start empty. Tasting scrolls as a whole.
  import { untrack } from 'svelte';
  import { closeOnBack } from '#lib/back-closes.ts';
  import BottomSheet from './BottomSheet.svelte';
  import ChoiceRow from './ChoiceRow.svelte';
  import PickRow from './PickRow.svelte';
  import SetupRow from './SetupRow.svelte';
  import TasteSlider from './TasteSlider.svelte';
  import type { ShotState } from './shot-state';
  import type { FeatureDefinition, FeatureValue, PrepStepSetting } from '../domain/schemas';
  import type { RoutineNow } from '../domain/prefill';
  import type { SetupChanges } from '../domain/shot-form';

  let {
    shot = $bindable(),
    tab,
    features,
    baskets,
    routines,
    gearNames,
    stepSettings,
    tags,
    changes,
    onclose
  }: {
    shot: ShotState;
    tab: 'setup' | 'tasting';
    features: FeatureDefinition[];
    baskets: { id: string; name: string }[];
    routines: { id: string; name: string; routine: RoutineNow }[];
    gearNames: Record<string, string>;
    /** Each puck prep step's setting, for changing a step's value for this shot. */
    stepSettings: Record<string, PrepStepSetting>;
    tags: { id: string; name: string }[];
    changes: SetupChanges;
    onclose: () => void;
  } = $props();

  /** A view inside the Setup tab: a picker, or the routine's steps with their values. */
  let picking: 'basket' | 'routine' | 'prep' | null = $state(null);
  let adding = $state(false);
  // Back from a picker or the puck prep view goes back to Setup, not out of the sheet.
  const inView = $derived(picking !== null);
  $effect(() => {
    if (inView) return untrack(() => closeOnBack(() => (picking = null)));
  });
  let newName = $state('');

  // Whether Flavor notes is folded is remembered on this phone. Storage can be missing or blocked
  // (a private window): it then starts open and is simply not remembered.
  const FOLDED_KEY = 'coffee-nerd:flavor-notes-folded';
  // The sheet only opens after a tap in the browser, so storage is read at once and it never jumps.
  function readFolded(): boolean {
    try {
      return localStorage.getItem(FOLDED_KEY) === 'true';
    } catch {
      return false;
    }
  }
  let folded = $state(readFolded());
  function toggleFolded() {
    folded = !folded;
    try {
      localStorage.setItem(FOLDED_KEY, String(folded));
    } catch {
      // not remembered
    }
  }

  const PHASES = ['flat_pressure', 'preinfusion', 'low_bar_start', 'low_bar_end'];
  const present = $derived(features.filter((f) => shot.setup.features[f.key]));
  const temperature = $derived(present.find((f) => f.key === 'temperature'));
  const pressure = $derived(present.filter((f) => PHASES.includes(f.key)));
  const custom = $derived(present.filter((f) => !f.builtIn));

  function update(key: string, patch: Partial<FeatureValue>) {
    shot.setup.features[key] = { ...shot.setup.features[key], ...patch };
  }

  function rowProps(f: FeatureDefinition) {
    const v = shot.setup.features[f.key];
    const kind = f.value;
    const unit = kind.kind === 'number' ? kind.unit : 's';
    const step = 'step' in kind ? kind.step : 1000;
    const range = kind.kind === 'number' || kind.kind === 'seconds' ? kind : { min: 0 };
    return {
      on: v.on,
      value: v.value,
      unit,
      step,
      min: range.min ?? 0,
      max: 'max' in range ? range.max : undefined,
      change: changes.features[f.key],
      pressure:
        kind.kind === 'phase' && kind.pressure
          ? { value: v.pressure, ...kind.pressure }
          : undefined,
      ontoggle: (on: boolean) => update(f.key, { on }),
      onvalue: (value: number) => update(f.key, { value }),
      onpressure: (value: number) => update(f.key, { pressure: value })
    };
  }

  /** What the basket or puck prep picker offers; each starts with leaving it out. */
  const choices = $derived(
    picking === 'basket'
      ? [
          {
            id: 'none',
            name: 'No basket',
            chosen: shot.basketId === null,
            pick: () => (shot.basketId = null)
          },
          ...baskets.map((b) => ({
            id: b.id,
            name: b.name,
            chosen: shot.basketId === b.id,
            pick: () => (shot.basketId = b.id)
          }))
        ]
      : [
          {
            id: 'none',
            name: 'No puck prep',
            chosen: shot.routineId === null,
            pick: () => {
              shot.routineId = null;
              shot.setup.routine = null;
            }
          },
          ...routines.map((r) => ({
            id: r.id,
            name: r.name,
            chosen: shot.routineId === r.id,
            pick: () => {
              // A routine is used as it is now.
              shot.routineId = r.id;
              shot.setup.routine = structuredClone(r.routine);
            }
          }))
        ]
  );

  /** A step's value for this shot only; a change turns sage like any other. */
  function setStep(index: number, value: number | string) {
    const routine = shot.setup.routine;
    if (!routine) return;
    routine.steps[index] = { ...routine.steps[index], value };
  }
  const stepChange = (index: number) => {
    const change = changes.steps[index];
    return change ? { delta: change.delta, pressureDelta: null, switched: null } : undefined;
  };

  const routineName = $derived(shot.setup.routine?.name ?? 'No puck prep');

  function toggleTag(id: string) {
    shot.tagIds = shot.tagIds.includes(id)
      ? shot.tagIds.filter((t) => t !== id)
      : [...shot.tagIds, id];
  }

  function addOwn() {
    const name = newName.trim();
    adding = false;
    newName = '';
    if (!name) return;
    const existing = tags.find((t) => t.name.toLowerCase() === name.toLowerCase());
    if (existing) {
      if (!shot.tagIds.includes(existing.id)) shot.tagIds = [...shot.tagIds, existing.id];
    } else if (!shot.newTagNames.some((n) => n.toLowerCase() === name.toLowerCase())) {
      shot.newTagNames = [...shot.newTagNames, name];
    }
  }
</script>

{#snippet arrow()}
  <svg
    width="12"
    height="12"
    viewBox="0 0 24 24"
    fill="none"
    stroke="currentColor"
    stroke-width="2.4"
    stroke-linecap="round"
    aria-hidden="true"><path d="M5 12h14M13 6l6 6-6 6" /></svg
  >
{/snippet}
{#snippet chevron()}
  <svg
    width="16"
    height="16"
    viewBox="0 0 24 24"
    fill="none"
    stroke="currentColor"
    stroke-width="2"
    stroke-linecap="round"
    aria-hidden="true"><path d="M9 6l6 6-6 6" /></svg
  >
{/snippet}

<BottomSheet
  label={tab === 'setup' ? 'Setup' : 'Tasting'}
  closeLabel={tab === 'setup' ? 'Close Setup' : 'Close Tasting'}
  {onclose}
>
  {#if tab === 'setup'}
    <div class="panel setup">
      {#if picking === 'prep' && shot.setup.routine}
        <h3>Puck prep</h3>
        <button type="button" class="link-row cn-tap" onclick={() => (picking = 'routine')}>
          <span class="strong">Routine</span>
          <span class="end">{routineName}{@render chevron()}</span>
        </button>
        <div class="group">
          {#each shot.setup.routine.steps as step, i (i)}
            {@const setting = stepSettings[step.stepId]}
            {#if setting?.kind === 'number' || setting?.kind === 'seconds'}
              <SetupRow
                label={step.name}
                value={typeof step.value === 'number' ? step.value : undefined}
                unit={setting.kind === 'number' ? setting.unit : 's'}
                step={setting.step}
                min={setting.min ?? 0}
                max={setting.max}
                change={stepChange(i)}
                onvalue={(v) => setStep(i, v)}
              />
            {:else if setting?.kind === 'choice'}
              {@const options = setting.options}
              <div class="cn-row step-row">
                <span class="cn-row__label">{step.name}</span>
                <button
                  type="button"
                  class="choice"
                  class:changed={!!changes.steps[i]}
                  aria-label="{step.name}, tap for the next option"
                  onclick={() => {
                    const at = options.findIndex((o) => o.id === step.value);
                    setStep(i, options[(at + 1) % options.length].id);
                  }}>{options.find((o) => o.id === step.value)?.label ?? '—'}</button
                >
              </div>
            {:else}
              <div class="cn-row step-row">
                <span class="cn-row__label">{step.name}</span>
                <span class="off">{setting?.kind === 'none' ? 'No settings' : '—'}</span>
              </div>
            {/if}
          {/each}
        </div>
        <div class="spacer"></div>
        <button type="button" class="cn-btn-quiet cn-tap" onclick={() => (picking = null)}
          >Back to Setup</button
        >
      {:else if picking}
        <h3>{picking === 'basket' ? 'Basket' : 'Puck prep'}</h3>
        <div class="list">
          {#each choices as item (item.id)}
            <PickRow
              label={item.name}
              chosen={item.chosen}
              onclick={() => {
                item.pick();
                // From the puck prep view, a chosen routine shows its steps again.
                picking = picking === 'routine' && shot.setup.routine ? 'prep' : null;
              }}
            />
          {/each}
        </div>
        {#if picking === 'routine'}
          <p class="nudge">
            Shots are easier to repeat with a puck prep routine. Add one in Library › Puck prep.
          </p>
        {/if}
        <!-- Screen 28: the list ends with a way back to Setup, at the foot of the sheet (the routine
             list too, which screen 28 does not draw). -->
        <div class="spacer"></div>
        <button type="button" class="cn-btn-quiet cn-tap" onclick={() => (picking = null)}
          >Back to Setup</button
        >
      {:else}
        {#if temperature}
          <div class="single">
            <SetupRow label={temperature.label} {...rowProps(temperature)} />
          </div>
        {/if}
        {#if pressure.length > 0}
          <h3>Pressure profile</h3>
          <div class="group">
            {#each pressure as f (f.key)}
              {#if f.key === 'flat_pressure'}
                <SetupRow label="Flat" sublabel="Main extraction" {...rowProps(f)} />
              {:else}
                <SetupRow label={f.label} switchable {...rowProps(f)} />
              {/if}
            {/each}
          </div>
        {/if}
        {#if custom.length > 0}
          <div class="group">
            {#each custom as f (f.key)}
              {@const v = shot.setup.features[f.key]}
              {#if f.value.kind === 'number' || f.value.kind === 'seconds'}
                <SetupRow label={f.label} switchable {...rowProps(f)} />
              {:else}
                <ChoiceRow feature={f} value={v} onupdate={(patch) => update(f.key, patch)} />
              {/if}
            {/each}
          </div>
        {/if}
        <button type="button" class="link-row cn-tap" onclick={() => (picking = 'basket')}>
          <span class="strong">Basket</span>
          <span class="end" class:changed={changes.basket}
            >{shot.basketId
              ? (gearNames[shot.basketId] ?? '')
              : 'No basket'}{@render chevron()}</span
          >
        </button>
        <button
          type="button"
          class="link-row prep cn-tap"
          onclick={() => (picking = shot.setup.routine ? 'prep' : 'routine')}
        >
          <span class="prep-text">
            <span class="strong">Puck prep <span class="soft">· {routineName}</span></span>
            <span class="flow" class:changed={changes.routine}>
              {#each shot.setup.routine?.steps ?? [] as step, i (i)}
                {#if i > 0}{@render arrow()}{/if}{step.name}
              {/each}
            </span>
          </span>
          <span class="end">{@render chevron()}</span>
        </button>
      {/if}
    </div>
  {:else}
    <div class="panel tasting">
      <div class="sliders">
        <TasteSlider
          scale="balance"
          title="Balance"
          ariaLabel="Balance, sour to bitter"
          ends={['Sour', 'Balanced', 'Bitter']}
          heading="h3"
          min={-10}
          max={10}
          value={shot.taste.balance}
          onchange={(v) => (shot.taste.balance = v)}
        />
        <TasteSlider
          scale="body"
          title="Body"
          ariaLabel="Body, light to heavy"
          ends={['Light', 'Medium', 'Heavy']}
          heading="h3"
          min={0}
          max={10}
          value={shot.taste.body}
          onchange={(v) => (shot.taste.body = v)}
        />
        <TasteSlider
          scale="sweetness"
          title="Sweetness"
          ariaLabel="Sweetness, low to high"
          ends={['Low', 'Medium', 'High']}
          heading="h3"
          min={0}
          max={10}
          value={shot.taste.sweetness}
          onchange={(v) => (shot.taste.sweetness = v)}
        />
        <TasteSlider
          scale="aftertaste"
          title="Aftertaste"
          ariaLabel="Aftertaste, short to long"
          ends={['Short', 'Medium', 'Long']}
          heading="h3"
          min={0}
          max={10}
          value={shot.taste.aftertaste}
          onchange={(v) => (shot.taste.aftertaste = v)}
        />
      </div>
      <div class="notes-block flavor">
        <h3>
          <button
            type="button"
            class="fold cn-tap"
            aria-expanded={!folded}
            aria-controls="flavor-notes"
            onclick={toggleFolded}
          >
            Flavor notes
            {#if folded && shot.tagIds.length + shot.newTagNames.length > 0}
              <span class="soft">· {shot.tagIds.length + shot.newTagNames.length} chosen</span>
            {/if}
            <svg
              class:open={!folded}
              width="18"
              height="18"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              stroke-width="2"
              stroke-linecap="round"
              aria-hidden="true"><path d="M6 9l6 6 6-6" /></svg
            >
          </button>
        </h3>
        <div id="flavor-notes" class="flavor-body" hidden={folded}>
          <div class="chips" role="group" aria-label="Flavor notes">
            {#each tags as t (t.id)}
              <button
                type="button"
                class="cn-chip chip"
                aria-pressed={shot.tagIds.includes(t.id)}
                onclick={() => toggleTag(t.id)}>{t.name}</button
              >
            {/each}
            {#each shot.newTagNames as name (name)}
              <button
                type="button"
                class="cn-chip chip"
                aria-pressed="true"
                onclick={() => (shot.newTagNames = shot.newTagNames.filter((n) => n !== name))}
                >{name}</button
              >
            {/each}
          </div>
          <!-- Outside the scrolling chips, so it is always in reach. -->
          <div class="add">
            {#if adding}
              <!-- svelte-ignore a11y_autofocus -->
              <input
                class="cn-chip chip new"
                aria-label="New flavor note"
                placeholder="Flavor note"
                maxlength="40"
                autofocus
                bind:value={newName}
                onblur={addOwn}
                onkeydown={(e) => {
                  if (e.key === 'Enter') {
                    e.preventDefault();
                    addOwn();
                  }
                }}
              />
            {:else}
              <button
                type="button"
                class="cn-chip cn-chip--add cn-tap"
                onclick={() => (adding = true)}
              >
                <svg
                  width="14"
                  height="14"
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="currentColor"
                  stroke-width="2.4"
                  stroke-linecap="round"
                  aria-hidden="true"><path d="M12 5v14M5 12h14" /></svg
                >
                Add your own
              </button>
            {/if}
          </div>
        </div>
      </div>
      <div class="notes-block">
        <div class="notes-head">
          <label for="shot-notes" class="strong">Notes</label>
          <span id="notes-hint" class="cn-caption">Just for you · not used in Insights</span>
        </div>
        <textarea
          id="shot-notes"
          aria-describedby="notes-hint"
          placeholder="Anything worth remembering about this shot"
          value={shot.notes ?? ''}
          oninput={(e) => (shot.notes = e.currentTarget.value || null)}></textarea>
      </div>
    </div>
  {/if}
</BottomSheet>

<style>
  .panel {
    flex: 1;
    min-height: 0;
    display: flex;
    flex-direction: column;
    gap: var(--space-3);
  }

  .setup {
    overflow-y: auto;
  }

  h3 {
    margin: 4px 0 0;
    font-size: 15px;
    font-weight: 600;
  }

  .single,
  .group {
    display: flex;
    flex-direction: column;
    gap: 2px;
    border-radius: var(--radius-md);
    overflow: hidden;
    flex: none;
  }

  .link-row {
    flex: none;
    display: flex;
    align-items: center;
    justify-content: space-between;
    gap: var(--space-3);
    min-height: 52px;
    padding: 0 14px;
    border: none;
    border-radius: var(--radius-md);
    background: var(--surface-sheet-field);
    color: var(--ink);
    font-size: 15px;
    text-align: left;
  }

  .link-row.prep {
    min-height: 72px;
  }

  .strong {
    font-size: 15px;
    font-weight: 600;
  }

  .soft {
    font-weight: 400;
    color: var(--ink-muted);
  }

  .end {
    display: inline-flex;
    align-items: center;
    gap: var(--space-2);
    color: var(--ink-muted);
  }

  .prep-text {
    flex: 1;
    min-width: 0;
    display: flex;
    flex-direction: column;
    gap: 4px;
  }

  .flow {
    display: flex;
    align-items: center;
    gap: 6px;
    font-size: 13px;
    color: var(--ink-muted);
    white-space: nowrap;
    overflow: hidden;
  }

  .changed {
    color: var(--sage);
  }

  .nudge {
    margin: var(--space-2) 2px 0;
    font-size: 13px;
    line-height: 1.4;
    color: var(--ink-muted);
  }

  .list {
    display: flex;
    flex-direction: column;
    flex: none;
    gap: 2px;
    border-radius: var(--radius-md);
    overflow: hidden;
  }

  .spacer {
    flex: 1;
  }

  .tasting {
    gap: var(--space-4);
    /* The whole sheet scrolls when it does not fit, so the flavor notes get their room. */
    overflow-y: auto;
    --taste-rail: var(--bg);
    --taste-behind: var(--surface-sheet);
  }

  .sliders {
    display: flex;
    flex-direction: column;
    gap: var(--space-4);
    flex: none;
  }

  .notes-block {
    display: flex;
    flex-direction: column;
    gap: var(--space-2);
  }

  .flavor-body {
    display: flex;
    flex-direction: column;
    gap: var(--space-2);
  }

  .flavor-body[hidden] {
    display: none;
  }

  .fold {
    display: flex;
    align-items: center;
    gap: var(--space-2);
    width: 100%;
    min-height: var(--touch-min);
    margin: -10px 0;
    padding: 0;
    border: none;
    background: transparent;
    color: var(--ink);
    font: inherit;
    text-align: left;
  }

  .fold svg {
    margin-left: auto;
    color: var(--ink-muted);
    transform: rotate(-90deg);
  }

  .fold svg.open {
    transform: none;
  }

  .chips {
    display: flex;
    flex-wrap: wrap;
    align-content: flex-start;
    gap: var(--space-2);
  }

  .add {
    display: flex;
    flex: none;
  }

  .chip:not([aria-pressed='true']) {
    background: var(--surface-sheet-field);
    font-weight: 500;
  }

  .chip.new {
    width: 160px;
    background: var(--surface-sheet-field);
    color: var(--ink);
    font-family: inherit;
    font-size: 16px;
    outline: none;
  }

  .notes-head {
    display: flex;
    justify-content: space-between;
    align-items: baseline;
  }

  textarea {
    flex: none;
    height: 72px;
    padding: 12px 14px;
    border: none;
    border-radius: var(--radius-md);
    background: var(--surface-sheet-field);
    color: var(--ink);
    font-family: inherit;
    font-size: 16px;
    resize: none;
  }

  textarea::placeholder {
    color: var(--ink-muted);
  }

  /* Tighter on shorter screens. */
  @media (max-height: 880px) {
    .tasting,
    .sliders {
      gap: var(--space-2);
    }

    textarea {
      height: 56px;
    }
  }

  .step-row {
    border-radius: 0;
    min-height: 56px;
    padding-right: 14px;
  }

  .off {
    font-size: 13px;
    color: var(--ink-muted);
  }

  /* Screens 29 and 30: the option sits in a pill on the page colour, so it reads as tappable. */
  .choice {
    height: var(--touch-min);
    padding: 0 12px;
    border: none;
    border-radius: var(--radius-pill);
    background: var(--bg);
    color: var(--amber);
    font-size: 15px;
    font-weight: 700;
  }

  .choice.changed {
    color: var(--sage);
  }
</style>
