<script lang="ts">
  // More (D-21): a bottom sheet with two tabs. Setup: temperature, pressure profile, basket, puck prep
  // (D-22, D-24, D-25), changes since the last shot in sage (D-90). Tasting: body, sweetness, aftertaste,
  // flavor notes and notes (D-23, D-27, D-97, D-101); all start empty (D-11).
  import BottomSheet from './BottomSheet.svelte';
  import SetupRow from './SetupRow.svelte';
  import TasteSlider from './TasteSlider.svelte';
  import type { ShotState } from './shot-state';
  import type { FeatureDefinition, FeatureValue } from '../domain/schemas';
  import type { RoutineNow } from '../domain/prefill';
  import type { SetupChanges } from '../domain/shot-form';

  let {
    shot = $bindable(),
    tab = $bindable(),
    features,
    baskets,
    routines,
    gearNames,
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
    tags: { id: string; name: string }[];
    changes: SetupChanges;
    onclose: () => void;
  } = $props();

  let picking: 'basket' | 'routine' | null = $state(null);
  let adding = $state(false);
  let newName = $state('');

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

  /** What the basket or puck prep picker offers (minimal until the Gear and Puck prep pages, M6–M7). */
  const choices = $derived(
    picking === 'basket'
      ? baskets.map((b) => ({
          id: b.id,
          name: b.name,
          chosen: shot.basketId === b.id,
          pick: () => (shot.basketId = b.id)
        }))
      : routines.map((r) => ({
          id: r.id,
          name: r.name,
          chosen: shot.routineId === r.id,
          pick: () => {
            // D-76: a routine is used as it is now.
            shot.routineId = r.id;
            shot.setup.routine = structuredClone(r.routine);
          }
        }))
  );

  const routineName = $derived(shot.setup.routine?.name ?? 'None');

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

<BottomSheet label="More" closeLabel="Close More" {onclose}>
  <div class="cn-seg cn-tabs tabs" role="tablist" aria-label="More sections">
    <button type="button" role="tab" aria-selected={tab === 'setup'} onclick={() => (tab = 'setup')}
      >Setup</button
    >
    <button
      type="button"
      role="tab"
      aria-selected={tab === 'tasting'}
      onclick={() => (tab = 'tasting')}>Tasting</button
    >
  </div>

  {#if tab === 'setup'}
    <div class="panel setup" role="tabpanel" aria-label="Setup">
      {#if picking}
        <h3>{picking === 'basket' ? 'Basket' : 'Puck prep'}</h3>
        <div class="list">
          {#each choices as item (item.id)}
            <button
              type="button"
              class="pick"
              aria-pressed={item.chosen}
              onclick={() => {
                item.pick();
                picking = null;
              }}>{item.name}</button
            >
          {/each}
        </div>
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
                {@const kind = f.value}
                <div class="cn-row custom">
                  <button
                    type="button"
                    class="cn-switch"
                    role="switch"
                    aria-checked={v.on}
                    aria-label={f.label}
                    onclick={() => update(f.key, { on: !v.on })}
                  ></button>
                  <span class="cn-row__label" class:muted={!v.on}>{f.label}</span>
                  {#if kind.kind === 'choice' && v.on}
                    <button
                      type="button"
                      class="choice"
                      aria-label="{f.label}, tap for the next option"
                      onclick={() => {
                        const i = kind.options.findIndex((o) => o.id === v.choice);
                        update(f.key, { choice: kind.options[(i + 1) % kind.options.length].id });
                      }}>{kind.options.find((o) => o.id === v.choice)?.label ?? '—'}</button
                    >
                  {:else}
                    <span class="off">{v.on ? 'On' : 'Off'}</span>
                  {/if}
                </div>
              {/if}
            {/each}
          </div>
        {/if}
        <button type="button" class="link-row" onclick={() => (picking = 'basket')}>
          <span class="strong">Basket</span>
          <span class="end" class:changed={changes.basket}
            >{shot.basketId ? (gearNames[shot.basketId] ?? '') : 'None'}{@render chevron()}</span
          >
        </button>
        <button type="button" class="link-row prep" onclick={() => (picking = 'routine')}>
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
    <div class="panel tasting" role="tabpanel" aria-label="Tasting">
      <div class="sliders">
        <TasteSlider
          scale="body"
          title="Body"
          ariaLabel="Body, light to heavy"
          ends={['Light', 'Heavy']}
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
          ends={['Low', 'High']}
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
          ends={['Short', 'Long']}
          heading="h3"
          min={0}
          max={10}
          value={shot.taste.aftertaste}
          onchange={(v) => (shot.taste.aftertaste = v)}
        />
      </div>
      <div class="notes-block flavor">
        <h3>Flavor notes</h3>
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
        <!-- Outside the scrolling chips, so it is always in reach (D-97, D-101). -->
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
            <button type="button" class="cn-chip cn-chip--add" onclick={() => (adding = true)}>
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
  .tabs {
    flex: none;
    background: var(--bg);
  }

  .tabs button {
    height: 44px;
    font-size: 15px;
    font-weight: 600;
    color: var(--ink-muted);
  }

  .tabs button[aria-selected='true'] {
    color: var(--on-cream);
  }

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

  .custom {
    border-radius: 0;
    min-height: 56px;
    padding-right: 14px;
  }

  .muted {
    font-weight: 500;
    color: var(--ink-muted);
  }

  .off {
    font-size: 14px;
    color: var(--ink-muted);
  }

  .choice {
    height: 32px;
    padding: 0 10px;
    border: none;
    border-radius: var(--radius-pill);
    background: transparent;
    color: var(--amber);
    font-size: 15px;
    font-weight: 600;
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

  .list {
    display: flex;
    flex-direction: column;
    gap: 2px;
    border-radius: var(--radius-md);
    overflow: hidden;
  }

  .pick {
    min-height: 52px;
    padding: 0 14px;
    border: none;
    background: var(--surface-sheet-field);
    color: var(--ink);
    font-size: 15px;
    text-align: left;
  }

  .pick[aria-pressed='true'] {
    color: var(--amber);
    font-weight: 700;
  }

  .tasting {
    gap: var(--space-4);
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

  .flavor {
    flex: 1;
    min-height: 0;
  }

  .chips {
    display: flex;
    flex-wrap: wrap;
    align-content: flex-start;
    gap: var(--space-2);
    overflow-y: auto;
    min-height: 0;
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
</style>
