<script lang="ts">
  // Edit My setup (screen 13, D-45): the starting point for new beans. Gear in a 2×2 grid of pickers, the
  // default values as −/+ cards (steps from your settings and the grinder, D-07, D-89), the ratio, and the
  // pressure profile as one row that opens the same phase rows as More › Setup (D-24), then your own
  // features as their More › Setup rows (D-161). What shows follows the chosen machine's switched-on
  // features and the grinder's dial. One Save at the bottom; it fits the screen (D-36). Basket and puck prep may be none (D-155). As step 4 of the step-by-step start (D-157) it
  // says so under the title and its button is "Next".
  import { untrack } from 'svelte';
  import { enhance } from '$app/forms';
  import { resolve } from '$app/paths';
  import BottomSheet from './BottomSheet.svelte';
  import ChoiceRow from './ChoiceRow.svelte';
  import SetupRow from './SetupRow.svelte';
  import ValueCard from './ValueCard.svelte';
  import { reconcileFeatures } from '../domain/prefill';
  import {
    validateSetupAgainstMachine,
    type FeatureDefinition,
    type FeatureValue,
    type MachineSpec
  } from '../domain/schemas';
  import { setupParts } from '../domain/shot-form';
  import { decimalsFor, formatRatio, type Thousandths } from '../domain/units';
  import type { Guide } from '../domain/guide';
  import type { MySetupFormData } from '../server/db/my-setup';

  let {
    setup,
    guide = null,
    problems = []
  }: {
    setup: MySetupFormData;
    guide?: Guide | null;
    /** What the server refused, in plain words. */
    problems?: string[];
  } = $props();

  const PHASES = ['flat_pressure', 'preinfusion', 'low_bar_start', 'low_bar_end'];
  const asMachine = (features: FeatureDefinition[]): MachineSpec => ({
    type: 'semi_auto',
    features
  });

  // The form keeps what you set; the page starts it again when it loads again.
  const start = untrack(() => {
    // Nothing chosen yet (a new account, D-157): your only machine, grinder or basket is the choice.
    const only = <T extends { id: string }>(items: T[]) =>
      items.length === 1 ? items[0].id : null;
    const fresh = setup.current.machineId === null;
    const machineId = setup.current.machineId ?? only(setup.machines);
    const machine = setup.machines.find((m) => m.id === machineId);
    return {
      machineId,
      grinderId: setup.current.grinderId ?? only(setup.grinders),
      basketId: fresh ? only(setup.baskets) : setup.current.basketId,
      routineId: setup.current.routineId,
      grind: setup.current.grind,
      dose: setup.current.dose,
      yield: setup.current.yield,
      features: machine
        ? reconcileFeatures(
            asMachine(machine.features),
            setup.current.features,
            setup.current.features
          )
        : {}
    };
  });
  let machineId = $state(start.machineId);
  let grinderId = $state(start.grinderId);
  let basketId = $state(start.basketId);
  let routineId = $state(start.routineId);
  let grind = $state<Thousandths | null>(start.grind);
  let dose = $state<Thousandths | null>(start.dose);
  let yieldAmount = $state<Thousandths | null>(start.yield);
  let features = $state<Record<string, FeatureValue>>(start.features);

  let picking: 'machine' | 'grinder' | 'basket' | 'routine' | 'pressure' | null = $state(null);
  let localProblems: string[] = $state([]);

  const machine = $derived(setup.machines.find((m) => m.id === machineId));
  const grinder = $derived(setup.grinders.find((g) => g.id === grinderId));
  const basket = $derived(setup.baskets.find((b) => b.id === basketId));
  const routine = $derived(setup.routines.find((r) => r.id === routineId));
  const present = $derived((machine?.features ?? []).filter((f) => features[f.key]));
  const temperature = $derived(present.find((f) => f.key === 'temperature'));
  const pressure = $derived(present.filter((f) => PHASES.includes(f.key)));
  // D-161: your own features have a default here too, as the same rows as More › Setup.
  const custom = $derived(present.filter((f) => !f.builtIn));
  const ratio = $derived(formatRatio(yieldAmount, dose));
  const dial = $derived(grinder?.dial);

  const shown = (value: Thousandths | null, step: Thousandths, atLeast = 0) =>
    Math.max(atLeast, value === null ? 0 : decimalsFor(value, step));

  /** "Flat 9.0 bar · Preinfusion 4 s · Low bar start 5 s at 2.0 bar" */
  const summary = $derived(
    setupParts({ features, routine: null }, machine?.features ?? [])
      .filter((part) => PHASES.includes(part.key) && features[part.key]?.on)
      .map((part) => part.text)
      .join(' · ')
  );

  const payload = $derived(
    JSON.stringify({
      machineId,
      grinderId,
      basketId,
      routineId,
      grind,
      dose,
      yield: yieldAmount,
      features
    })
  );

  function update(key: string, patch: Partial<FeatureValue>) {
    features[key] = { ...features[key], ...patch };
  }

  /** D-45: the default values follow the new machine's switched-on features. */
  function chooseMachine(id: string) {
    const next = setup.machines.find((m) => m.id === id);
    machineId = id;
    if (next) features = reconcileFeatures(asMachine(next.features), features, features);
  }

  function rowProps(f: FeatureDefinition) {
    const v = features[f.key];
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
      pressure:
        kind.kind === 'phase' && kind.pressure
          ? { value: v.pressure, ...kind.pressure }
          : undefined,
      ontoggle: (on: boolean) => update(f.key, { on }),
      onvalue: (value: number) => update(f.key, { value }),
      onpressure: (value: number) => update(f.key, { pressure: value })
    };
  }

  /** What the picker offers: the list for the picked kind, with "No basket" / "No puck prep" first (D-155). */
  const choices = $derived.by(() => {
    if (picking === 'machine')
      return setup.machines.map((m) => ({
        id: m.id,
        name: m.name,
        chosen: m.id === machineId,
        pick: () => chooseMachine(m.id)
      }));
    if (picking === 'grinder')
      return setup.grinders.map((g) => ({
        id: g.id,
        name: g.name,
        chosen: g.id === grinderId,
        pick: () => (grinderId = g.id)
      }));
    if (picking === 'basket')
      return [
        { id: 'none', name: 'No basket', chosen: basketId === null, pick: () => (basketId = null) },
        ...setup.baskets.map((b) => ({
          id: b.id,
          name: b.name,
          chosen: b.id === basketId,
          pick: () => (basketId = b.id)
        }))
      ];
    if (picking === 'routine')
      return [
        {
          id: 'none',
          name: 'No puck prep',
          chosen: routineId === null,
          pick: () => (routineId = null)
        },
        ...setup.routines.map((r) => ({
          id: r.id,
          name: r.name,
          chosen: r.id === routineId,
          pick: () => (routineId = r.id)
        }))
      ];
    return [];
  });

  const PICKER_TITLE = {
    machine: 'Machine',
    grinder: 'Grinder',
    basket: 'Basket',
    routine: 'Puck prep'
  } as const;

  /** Not designed: what shows when there is nothing to choose from yet (open items). */
  const EMPTY_NOTE = {
    machine: 'No machines yet. Add one in Library › Gear.',
    grinder: 'No grinders yet. Add one in Library › Gear.',
    basket: '',
    routine: ''
  } as const;

  function check(): boolean {
    // D-78: temperature and flat pressure cannot be switched off, so they wait for a value; the server
    // checks again. The wording is not designed yet (open items).
    const found: string[] = [];
    if (!machine) found.push('Choose a machine');
    if (!grinder) found.push('Choose a grinder');
    if (dose === null || dose <= 0) found.push('Set Dose first.');
    if (grind === null) found.push('Set Grind first.');
    if (machine) {
      for (const p of validateSetupAgainstMachine(
        { features, routine: null },
        asMachine(machine.features)
      )) {
        if (p.problem === 'value_missing' || p.problem === 'cannot_switch_off')
          found.push(`Set ${p.label} first.`);
        else if (p.problem === 'pressure_missing')
          found.push(`Set the pressure for ${p.label} first.`);
      }
    }
    localProblems = found;
    return found.length === 0;
  }

  const shownProblems = $derived(localProblems.length > 0 ? localProblems : problems);
</script>

{#snippet chevron()}
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
{/snippet}

{#snippet picker(kind: 'machine' | 'grinder' | 'basket' | 'routine', title: string, value: string)}
  <button
    type="button"
    class="picker cn-tap"
    aria-haspopup="dialog"
    aria-label="{title}, {value}"
    onclick={() => (picking = kind)}
  >
    <span class="picker-text">
      <span class="cn-label small">{title}</span>
      <span class="picker-value">{value}</span>
    </span>
    {@render chevron()}
  </button>
{/snippet}

<div class="page">
  <div class="above-save">
    <header>
      <a
        class="icon cn-tap"
        href={guide ? resolve('/') : resolve('/library/gear')}
        aria-label={guide ? 'Leave for now' : 'Close without saving'}
      >
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
      <div class="title">
        <h1>My setup</h1>
        <span class="cn-caption"
          >{guide ? `Step ${guide.step} of ${guide.of} · ` : ''}Starting point for new beans</span
        >
      </div>
      <span></span>
    </header>

    <main>
      <h2>Gear</h2>
      <div class="grid">
        {@render picker('machine', 'Machine', machine?.name ?? 'Choose')}
        {@render picker('grinder', 'Grinder', grinder?.name ?? 'Choose')}
        {@render picker('basket', 'Basket', basket?.name ?? 'No basket')}
        {@render picker('routine', 'Puck prep', routine?.name ?? 'No puck prep')}
      </div>

      <h2 class="second">Default values</h2>
      <div class="grid values-grid">
        <ValueCard
          label="Dose"
          value={dose}
          unit="g"
          unitName="gram"
          step={setup.steps.dose}
          decimals={shown(dose, setup.steps.dose, 1)}
          min={setup.steps.dose}
          onchange={(v) => (dose = v)}
        />
        <ValueCard
          label="Yield"
          value={yieldAmount}
          unit="g"
          unitName="gram"
          step={setup.steps.yield}
          decimals={shown(yieldAmount, setup.steps.yield, 1)}
          min={0}
          onchange={(v) => (yieldAmount = v)}
        />
        {#if dial}
          <ValueCard
            label="Grind"
            value={grind}
            step={dial.step}
            decimals={shown(grind, dial.step)}
            min={Math.min(dial.finest, dial.coarsest)}
            max={Math.max(dial.finest, dial.coarsest)}
            onchange={(v) => (grind = v)}
          />
        {/if}
        {#if temperature && temperature.value.kind === 'number'}
          <ValueCard
            label={temperature.label}
            value={features.temperature.value ?? null}
            unit={temperature.value.unit}
            unitName="degree"
            step={temperature.value.step}
            decimals={shown(features.temperature.value ?? null, temperature.value.step)}
            min={temperature.value.min}
            max={temperature.value.max}
            onchange={(v) => v !== null && update('temperature', { value: v })}
          />
        {/if}
      </div>
      <div class="ratio">Ratio <span class="ratio-value">{ratio ?? '—'}</span></div>

      {#if pressure.length > 0}
        <button
          type="button"
          class="profile cn-tap"
          aria-haspopup="dialog"
          onclick={() => (picking = 'pressure')}
        >
          <span class="profile-text">
            <span class="picker-value">Pressure profile</span>
            <span class="cn-label">{summary || 'Not set'}</span>
          </span>
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
        </button>
      {/if}

      {#if custom.length > 0}
        <div class="group">
          {#each custom as f (f.key)}
            {#if f.value.kind === 'number' || f.value.kind === 'seconds'}
              <SetupRow label={f.label} switchable {...rowProps(f)} />
            {:else}
              <ChoiceRow
                feature={f}
                value={features[f.key]}
                onupdate={(patch) => update(f.key, patch)}
              />
            {/if}
          {/each}
        </div>
      {/if}
    </main>

    {#if picking === 'pressure'}
      <BottomSheet
        label="Pressure profile"
        closeLabel="Close pressure profile"
        onclose={() => (picking = null)}
      >
        <h2 class="cn-type-heading sheet-title">Pressure profile</h2>
        <div class="group">
          {#each pressure as f (f.key)}
            {#if f.key === 'flat_pressure'}
              <SetupRow label="Flat" sublabel="Main extraction" {...rowProps(f)} />
            {:else}
              <SetupRow label={f.label} switchable {...rowProps(f)} />
            {/if}
          {/each}
        </div>
      </BottomSheet>
    {:else if picking}
      <BottomSheet
        label={PICKER_TITLE[picking]}
        closeLabel="Close {PICKER_TITLE[picking].toLowerCase()} list"
        onclose={() => (picking = null)}
      >
        <h2 class="cn-type-heading sheet-title">{PICKER_TITLE[picking]}</h2>
        <div class="list">
          {#each choices as item (item.id)}
            <button
              type="button"
              class="pick cn-tap"
              aria-pressed={item.chosen}
              onclick={() => {
                item.pick();
                picking = null;
              }}>{item.name}</button
            >
          {/each}
        </div>
        {#if choices.length === 0}
          <p class="note">{EMPTY_NOTE[picking]}</p>
        {:else if picking === 'routine'}
          <!-- D-155 -->
          <p class="note">
            Shots are easier to repeat with a puck prep routine. Add one in Library › Puck prep.
          </p>
        {/if}
      </BottomSheet>
    {/if}
  </div>

  <footer>
    {#each shownProblems as problem (problem)}
      <p class="problem" role="alert">{problem}</p>
    {/each}
    <form
      method="POST"
      action={guide ? '?guide=1&/save' : '?/save'}
      use:enhance={({ cancel }) => {
        if (!check()) cancel();
      }}
    >
      <input type="hidden" name="payload" value={payload} />
      <button class="cn-btn-primary cn-tap-strong">{guide ? 'Next' : 'Save setup'}</button>
    </form>
  </footer>
</div>

<style>
  .page {
    flex: 1;
    min-height: 0;
    display: flex;
    flex-direction: column;
  }

  /* The sheets stop above Save (D-21). */
  .above-save {
    position: relative;
    flex: 1;
    min-height: 0;
    display: flex;
    flex-direction: column;
  }

  header {
    display: grid;
    grid-template-columns: 48px 1fr 48px;
    align-items: center;
    height: 60px;
    padding: 0 var(--space-2);
  }

  .title {
    display: flex;
    flex-direction: column;
    align-items: center;
  }

  h1 {
    margin: 0;
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
    gap: var(--space-3);
    padding: var(--space-2) var(--space-5) var(--space-3);
    /* D-36: it fits; only on a very short screen does it scroll inside the page. */
    overflow-y: auto;
    scrollbar-width: none;
  }

  main::-webkit-scrollbar {
    display: none;
  }

  h2 {
    margin: 0;
    font-size: 15px;
    font-weight: 600;
  }

  h2.second {
    margin-top: 6px;
  }

  .grid {
    flex: none;
    display: grid;
    grid-template-columns: repeat(2, minmax(0, 1fr));
    gap: 10px;
  }

  .picker {
    display: flex;
    align-items: center;
    gap: 6px;
    min-height: 58px;
    padding: 0 10px 0 14px;
    border: none;
    border-radius: var(--radius-md);
    background: var(--surface);
    color: var(--ink);
    text-align: left;
  }

  .picker :global(svg) {
    flex: none;
    color: var(--ink-muted);
  }

  .picker-text,
  .profile-text {
    flex: 1;
    min-width: 0;
    display: flex;
    flex-direction: column;
    gap: 2px;
  }

  .small {
    font-size: 12px;
    line-height: 16px;
  }

  .picker-value {
    font-size: 15px;
    font-weight: 600;
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
  }

  .ratio {
    margin-top: -2px;
    text-align: center;
    font-size: 13px;
    color: var(--ink-muted);
  }

  .ratio-value {
    color: var(--ink);
    font-weight: 600;
  }

  .profile {
    flex: none;
    display: flex;
    align-items: center;
    gap: var(--space-3);
    min-height: 64px;
    padding: 0 14px;
    border: none;
    border-radius: var(--radius-md);
    background: var(--surface);
    color: var(--ink);
    text-align: left;
  }

  .profile :global(svg) {
    flex: none;
    color: var(--ink-muted);
  }

  .profile .cn-label {
    font-size: 13px;
  }

  footer {
    display: flex;
    flex-direction: column;
    gap: var(--space-2);
    padding: var(--space-2) var(--space-5) var(--space-6);
  }

  .problem {
    margin: 0;
    font-size: 13px;
    color: var(--ink-soft);
  }

  .sheet-title {
    margin: 4px 0 0;
  }

  .note {
    margin: 0;
    font-size: 13px;
    color: var(--ink-soft);
  }

  .group,
  .list {
    display: flex;
    flex-direction: column;
    gap: 2px;
    border-radius: var(--radius-md);
    overflow: hidden;
    flex: none;
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

  /* Edit My setup draws its value cards smaller than the shot form's (screen 13). */
  .values-grid :global(.cn-value-card) {
    gap: 4px;
    padding: 12px;
    border-radius: var(--radius-md);
  }

  .values-grid :global(.cn-value-card__value) {
    font-size: 24px;
    line-height: 30px;
  }
</style>
