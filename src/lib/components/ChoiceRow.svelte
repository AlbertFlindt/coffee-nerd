<script lang="ts">
  // A feature of your own that is on/off or "Pick from a list", as a setup row: its switch, its
  // name, and "On"/"Off" or the chosen option, which moves to the next option on tap. Used on the Setup sheet
  // and in Edit My setup. Numbers and seconds use SetupRow.
  import type { FeatureDefinition, FeatureValue } from '../domain/schemas';

  let {
    feature,
    value,
    onupdate
  }: {
    feature: FeatureDefinition;
    value: FeatureValue;
    onupdate: (patch: Partial<FeatureValue>) => void;
  } = $props();

  const options = $derived(feature.value.kind === 'choice' ? feature.value.options : []);

  function next() {
    const i = options.findIndex((o) => o.id === value.choice);
    onupdate({ choice: options[(i + 1) % options.length].id });
  }
</script>

<div class="cn-row row">
  <button
    type="button"
    class="cn-switch"
    role="switch"
    aria-checked={value.on}
    aria-label={feature.label}
    onclick={() => onupdate({ on: !value.on })}
  ></button>
  <span class="cn-row__label" class:muted={!value.on}>{feature.label}</span>
  {#if feature.value.kind === 'choice' && value.on}
    <button
      type="button"
      class="choice"
      aria-label="{feature.label}, tap for the next option"
      onclick={next}>{options.find((o) => o.id === value.choice)?.label ?? '—'}</button
    >
  {:else}
    <span class="off">{value.on ? 'On' : 'Off'}</span>
  {/if}
</div>

<style>
  .row {
    border-radius: 0;
    min-height: 56px;
    padding-right: 10px;
  }

  .muted {
    font-weight: 500;
    color: var(--ink-muted);
  }

  .off {
    padding-right: 4px;
    font-size: 14px;
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
</style>
