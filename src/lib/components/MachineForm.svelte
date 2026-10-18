<script lang="ts">
  // The machine page (screen 12): edit a machine (D-44) or add one (D-147, D-158). Switched-on features
  // are exactly what the shot form shows (D-02). Group size takes decimals (D-79).
  import { untrack } from 'svelte';
  import GearFormShell from '#lib/components/GearFormShell.svelte';
  import TextField from '#lib/components/TextField.svelte';
  import { NEW_GEAR, trimmed } from '#lib/domain/gear.ts';
  import type { FeatureDefinition, MachineSpec } from '#lib/domain/schemas.ts';
  import { applyStep, decimalsForStep, formatQuantity } from '#lib/domain/units.ts';

  let {
    name: initialName = '',
    spec: initialSpec,
    isDefault = false,
    problems = []
  }: {
    name?: string;
    /** Without a spec the page adds a machine (D-147). */
    spec?: MachineSpec;
    isDefault?: boolean;
    problems?: string[];
  } = $props();

  const adding = untrack(() => initialSpec === undefined);
  let name = $state(untrack(() => initialName));
  let spec: MachineSpec = $state(untrack(() => initialSpec ?? NEW_GEAR.machine()));

  const TYPES = [
    ['automatic', 'Automatic'],
    ['semi_auto', 'Semi-auto'],
    ['lever', 'Lever'],
    ['manual', 'Manual']
  ] as const;

  const GROUP_STEP = 500; // D-79: 0.5 mm

  function detail({ value }: FeatureDefinition): string {
    switch (value.kind) {
      case 'number':
        return `${value.unit} · steps of ${formatQuantity(value.step, { decimals: decimalsForStep(value.step) })}`;
      case 'seconds':
        return 'seconds';
      case 'phase':
        return value.pressure ? 'seconds · at bar' : 'seconds';
      case 'toggle':
        return 'on / off';
      case 'choice':
        return value.options.map((o) => o.label).join(', ');
    }
  }

  function stepGroup(direction: '+' | '-') {
    // Not set yet: the first tap starts at the most common size (D-158).
    if (spec.groupSizeMm === undefined) {
      spec.groupSizeMm = 58000;
      return;
    }
    spec.groupSizeMm = applyStep(spec.groupSizeMm, GROUP_STEP, direction, {
      min: GROUP_STEP
    });
  }
</script>

<GearFormShell
  kind="machine"
  {adding}
  {isDefault}
  {problems}
  payload={JSON.stringify({ kind: 'machine', name, spec })}
>
  <TextField label="Name" id="gear-name" autocomplete="off" bind:value={name} />

  <fieldset>
    <legend>Type</legend>
    <div class="cn-seg" role="radiogroup" aria-label="Machine type">
      {#each TYPES as [key, label] (key)}
        <button
          type="button"
          role="radio"
          aria-checked={spec.type === key}
          onclick={() => (spec.type = key)}>{label}</button
        >
      {/each}
    </div>
  </fieldset>

  <div class="heading">
    <h2>What it can do</h2>
    <span>Switched-on features appear on the shot form</span>
  </div>

  <div class="features">
    {#each spec.features as feature (feature.key)}
      <div class="feature">
        <div class="text">
          <span class="name">{feature.label}</span>
          <span class="detail">{detail(feature)}</span>
        </div>
        <button
          type="button"
          class="cn-switch"
          role="switch"
          aria-checked={feature.enabled}
          aria-label={feature.label}
          onclick={() => (feature.enabled = !feature.enabled)}
        ></button>
      </div>
    {/each}
    <!-- Not built yet: a later pull request adds the sheet for your own feature (D-46). -->
    <button type="button" class="add" aria-disabled="true" aria-describedby="add-feature-later">
      <svg
        width="18"
        height="18"
        viewBox="0 0 24 24"
        fill="none"
        stroke="currentColor"
        stroke-width="2"
        stroke-linecap="round"
        aria-hidden="true"><path d="M12 5v14M5 12h14" /></svg
      >Add your own feature
      <span id="add-feature-later" class="sr">Not available yet</span>
    </button>
  </div>

  <div class="group">
    <span class="label">Group size</span>
    <button
      type="button"
      class="step cn-tap"
      aria-label="Group size smaller"
      onclick={() => stepGroup('-')}>−</button
    >
    <span class="value">
      {#if spec.groupSizeMm === undefined}<span class="unset">Not set</span>{:else}{trimmed(
          spec.groupSizeMm
        )}<span class="unit">&nbsp;mm</span>{/if}
    </span>
    <button
      type="button"
      class="step cn-tap"
      aria-label="Group size larger"
      onclick={() => stepGroup('+')}>+</button
    >
  </div>
</GearFormShell>

<style>
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

  .heading {
    display: flex;
    flex-direction: column;
    gap: 2px;
    margin-top: var(--space-1);
  }

  h2 {
    margin: 0;
    font-size: 16px;
    font-weight: 600;
  }

  .heading span {
    font-size: 13px;
    color: var(--ink-muted);
  }

  .features {
    display: flex;
    flex-direction: column;
    gap: 2px;
    border-radius: var(--radius-md);
    overflow: hidden;
    flex: none;
  }

  .feature {
    display: flex;
    align-items: center;
    gap: var(--space-3);
    min-height: 58px;
    padding: 0 14px;
    background: var(--surface);
  }

  .text {
    flex: 1;
    display: flex;
    flex-direction: column;
    gap: 2px;
  }

  .name {
    font-size: 15px;
    font-weight: 600;
  }

  .detail {
    font-size: 12px;
    color: var(--ink-muted);
  }

  .cn-switch {
    flex: none;
    /* The visible switch stays 44 × 26; the tap area grows around it. */
    position: relative;
  }

  .cn-switch::before {
    content: '';
    position: absolute;
    inset: -9px -4px;
  }

  .add {
    display: flex;
    align-items: center;
    gap: var(--space-2);
    min-height: 52px;
    padding: 0 14px;
    border: none;
    background: var(--surface);
    color: var(--ink-muted);
    font-size: 14px;
    font-weight: 500;
    text-align: left;
    opacity: 0.6;
    cursor: default;
  }

  .group {
    flex: none;
    display: flex;
    align-items: center;
    gap: var(--space-2);
    min-height: 58px;
    padding: 0 10px 0 14px;
    border-radius: var(--radius-md);
    background: var(--surface);
  }

  .label {
    flex: 1;
    font-size: 15px;
    font-weight: 600;
  }

  .step {
    width: var(--touch-min);
    height: var(--touch-min);
    border-radius: var(--radius-sm);
    border: none;
    background: var(--control-strong);
    color: var(--ink);
    font-size: 20px;
  }

  .value {
    width: 72px;
    text-align: center;
    font-size: 18px;
    font-weight: 600;
  }

  .unset {
    font-size: 14px;
    font-weight: 500;
    color: var(--ink-muted);
  }

  .sr {
    position: absolute;
    width: 1px;
    height: 1px;
    overflow: hidden;
    clip-path: inset(50%);
  }

  .unit {
    font-size: 13px;
    font-weight: 500;
    color: var(--ink-muted);
  }
</style>
