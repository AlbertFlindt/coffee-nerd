<script lang="ts">
  // The Add bean form (screen 9, D-41), also used to edit a bean (D-130). It fits the screen (D-36).
  // "Same as before" (D-126, D-139) and Country (D-133) open sheets; Roast date opens the device's own
  // date picker (D-138).
  import { untrack } from 'svelte';
  import { enhance } from '$app/forms';
  import { resolve } from '$app/paths';
  import BottomSheet from '#lib/components/BottomSheet.svelte';
  import TextField from '#lib/components/TextField.svelte';
  import { PROCESS_LABEL, roastDateText, type Process } from '#lib/domain/bean.ts';
  import type { BeanFormText } from '#lib/domain/bean-form.ts';
  import { countryName, searchCountries } from '#lib/domain/countries.ts';

  let {
    mode,
    beanId,
    deletable = false,
    text,
    today,
    rebuy = null,
    choices = [],
    problems = []
  }: {
    mode: 'add' | 'edit';
    /** The bean being edited: closing goes back to its page (D-130). */
    beanId?: string;
    /** Editing a bean without shots: it can be deleted (D-145). */
    deletable?: boolean;
    text: BeanFormText;
    /** Today in your time zone, "YYYY-MM-DD": no roast date after it (D-138). */
    today: string;
    /** The name of the bean this re-buy repeats (D-139). */
    rebuy?: { name: string } | null;
    /** "Same as before" choices (D-126); picking one opens the form filled from it (?rebuy=). */
    choices?: { id: string; name: string; origin: string }[];
    problems?: string[];
  } = $props();

  // The form keeps what you typed; the page starts it again ({#key}) when a re-buy is picked.
  let values = $state(untrack(() => ({ ...text })));

  let sheet: 'rebuy' | 'country' | 'delete' | null = $state(null);
  let deleting = $state(false);
  let search = $state('');

  const ROAST_LEVELS = [
    ['light', 'Light'],
    ['medium_light', 'Med-light'],
    ['medium', 'Medium'],
    ['dark', 'Dark']
  ] as const;
  const roast = $derived(values.roastDate ? roastDateText(values.roastDate, today) : null);
</script>

<header>
  <a
    class="icon cn-tap"
    href={beanId ? resolve('/library/beans/[id]', { id: beanId }) : resolve('/library/beans')}
    aria-label="Close without saving"
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
  <h1>{mode === 'add' ? 'Add bean' : 'Edit bean'}</h1>
  <span></span>
</header>

<form id="bean-form" class="fields" method="POST" action="?/save" use:enhance>
  {#if mode === 'add'}
    <div class="rebuy">
      <button type="button" class="rebuy-open cn-tap" onclick={() => (sheet = 'rebuy')}>
        <svg
          width="22"
          height="22"
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          stroke-width="2"
          stroke-linecap="round"
          stroke-linejoin="round"
          aria-hidden="true"
          class="cherry"><path d="M4 12a8 8 0 1 0 2.3-5.7L4 8.6M4 4v4.6h4.6M12 8v4l3 2" /></svg
        >
        <span class="rebuy-text">
          {#if rebuy}
            <span class="rebuy-title">Same as {rebuy.name}</span>
            <span class="soft">Only roast date and bag weight are new</span>
          {:else}
            <span class="rebuy-title">Same as before</span>
            <span class="soft">Re-buy a past bean · only roast date is new</span>
          {/if}
        </span>
        {#if !rebuy}
          <svg
            width="16"
            height="16"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            stroke-width="2"
            stroke-linecap="round"
            aria-hidden="true"
            class="soft"><path d="M9 6l6 6-6 6" /></svg
          >
        {/if}
      </button>
      {#if rebuy}
        <a class="icon cn-tap clear" href={resolve('/library/beans/new')} aria-label="Not a re-buy">
          <svg
            width="16"
            height="16"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            stroke-width="2"
            stroke-linecap="round"
            aria-hidden="true"><path d="M6 6l12 12M18 6L6 18" /></svg
          >
        </a>
      {/if}
    </div>
  {/if}
  <input type="hidden" name="rebuyOfId" value={values.rebuyOfId} />

  <TextField
    label="Name"
    id="bean-name"
    name="name"
    hint="Required"
    autocomplete="off"
    bind:value={values.name}
  />
  <TextField
    label="Roaster"
    id="bean-roaster"
    name="roaster"
    plain
    autocomplete="off"
    bind:value={values.roaster}
  />

  <div class="pair">
    <button
      type="button"
      class="field picker cn-tap"
      aria-label="Country, {countryName(values.countryCode) ?? 'not set'}. Tap to choose"
      onclick={() => {
        search = '';
        sheet = 'country';
      }}
    >
      <span class="picker-text">
        <span class="cn-caption">Country</span>
        {#if values.countryCode}
          <span class="value">{countryName(values.countryCode)}</span>
        {:else}
          <span class="value placeholder">Not set</span>
        {/if}
      </span>
      <svg
        width="16"
        height="16"
        viewBox="0 0 24 24"
        fill="none"
        stroke="currentColor"
        stroke-width="2"
        stroke-linecap="round"
        aria-hidden="true"
        class="soft"><path d="M6 9l6 6 6-6" /></svg
      >
    </button>
    <input type="hidden" name="countryCode" value={values.countryCode} />
    <TextField
      label="Region"
      id="bean-region"
      name="region"
      plain
      autocomplete="off"
      bind:value={values.region}
    />
  </div>

  <fieldset>
    <legend>Process</legend>
    <div class="chips">
      {#each Object.entries(PROCESS_LABEL) as [key, label] (key)}
        <button
          type="button"
          class="cn-chip chip"
          aria-pressed={values.process === key}
          onclick={() => (values.process = values.process === key ? '' : (key as Process))}
          >{label}</button
        >
      {/each}
    </div>
    <input type="hidden" name="process" value={values.process} />
  </fieldset>

  <div class="pair">
    <TextField
      label="Variety"
      id="bean-variety"
      name="variety"
      plain
      placeholder="e.g. Heirloom"
      autocomplete="off"
      bind:value={values.variety}
    />
    <TextField
      label="Altitude"
      id="bean-altitude"
      name="altitude"
      plain
      placeholder="e.g. 1,900–2,100 m"
      autocomplete="off"
      bind:value={values.altitude}
    />
  </div>

  <fieldset>
    <legend>Roast level</legend>
    <div class="cn-seg" role="radiogroup" aria-label="Roast level">
      {#each ROAST_LEVELS as [key, label] (key)}
        <button
          type="button"
          role="radio"
          aria-checked={values.roastLevel === key}
          onclick={() => (values.roastLevel = values.roastLevel === key ? '' : key)}>{label}</button
        >
      {/each}
    </div>
    <input type="hidden" name="roastLevel" value={values.roastLevel} />
  </fieldset>

  <div class="pair">
    <!-- D-138: the date input lies over the field, so a tap opens the device's own picker. -->
    <label class="field date cn-tap">
      <span class="cn-caption label">Roast date <span>Required</span></span>
      {#if roast}
        <span class="value">{roast.date}</span>
        <span class="cn-caption">{roast.ago}</span>
      {:else}
        <span class="value placeholder">Not set</span>
      {/if}
      <input
        type="date"
        name="roastDate"
        max={today}
        aria-label="Roast date"
        bind:value={values.roastDate}
      />
    </label>
    <TextField
      label="Bag weight"
      id="bean-weight"
      name="bagWeight"
      plain
      inputmode="decimal"
      placeholder="Optional · g"
      autocomplete="off"
      bind:value={values.bagWeight}
    />
  </div>
</form>

<footer>
  {#each problems as problem (problem)}
    <p class="problem" role="alert">{problem}</p>
  {/each}
  <button class="cn-btn-primary cn-tap-strong" form="bean-form">
    {mode === 'add' ? 'Add bean' : 'Save changes'}
  </button>
  {#if mode === 'edit' && deletable}
    <!-- D-145: only a bean without shots can be deleted; a confirmation asks first. -->
    <button class="cn-btn-quiet cn-tap" type="button" onclick={() => (sheet = 'delete')}
      >Delete bean</button
    >
  {/if}
</footer>

{#if sheet === 'rebuy'}
  <BottomSheet label="Same as before" closeLabel="Close bean list" onclose={() => (sheet = null)}>
    <h2 class="cn-type-heading sheet-title">Same as before</h2>
    <!-- D-126: picking a bean opens the form filled from it (?rebuy=), like the shot form's bean list. -->
    <form
      class="list"
      method="GET"
      action={resolve('/library/beans/new')}
      data-sveltekit-replacestate
    >
      {#each choices as choice (choice.id)}
        <button type="submit" name="rebuy" value={choice.id} class="row cn-tap">
          <span class="row-name">{choice.name}</span>
          {#if choice.origin}<span class="soft">{choice.origin}</span>{/if}
        </button>
      {:else}
        <p class="soft">No beans yet</p>
      {/each}
    </form>
  </BottomSheet>
{:else if sheet === 'delete'}
  <!-- D-145: the confirmation sheet, as for a shot (D-116). -->
  <BottomSheet
    short
    label="Delete this bean"
    closeLabel="Keep the bean"
    onclose={() => (sheet = null)}
  >
    <h2 class="cn-type-heading sheet-title">Delete this bean?</h2>
    <p class="cn-type-body note">It has no shots yet. This cannot be undone.</p>
    <form class="confirm" method="POST" action="?/delete" onsubmit={() => (deleting = true)}>
      <button class="cn-btn-primary cn-tap-strong" type="submit" disabled={deleting}
        >Delete bean</button
      >
      <button class="cn-btn-secondary cn-tap" type="button" onclick={() => (sheet = null)}
        >Keep it</button
      >
    </form>
  </BottomSheet>
{:else if sheet === 'country'}
  <BottomSheet
    label="Choose a country"
    closeLabel="Close country list"
    onclose={() => (sheet = null)}
  >
    <h2 class="cn-type-heading sheet-title">Country</h2>
    <TextField
      label="Search"
      id="country-search"
      plain
      autocomplete="off"
      enterkeyhint="search"
      bind:value={search}
    />
    <div class="list">
      {#each searchCountries(search) as country (country.code)}
        <button
          type="button"
          class="row cn-tap"
          aria-pressed={values.countryCode === country.code}
          onclick={() => {
            values.countryCode = values.countryCode === country.code ? '' : country.code;
            sheet = null;
          }}
        >
          <span class="row-name">{country.name}</span>
        </button>
      {/each}
    </div>
  </BottomSheet>
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
    color: var(--ink);
  }

  .fields {
    flex: 1;
    min-height: 0;
    display: flex;
    flex-direction: column;
    gap: var(--space-3);
    padding: var(--space-1) var(--space-5) var(--space-3);
    overflow: hidden;
  }

  .rebuy {
    position: relative;
    display: flex;
  }

  .rebuy-open {
    flex: 1;
    display: flex;
    align-items: center;
    gap: var(--space-3);
    min-height: 56px;
    padding: 0 14px;
    border-radius: var(--radius-md);
    border: 1.5px dashed var(--line);
    background: transparent;
    color: var(--ink);
    text-align: left;
  }

  .rebuy-text {
    flex: 1;
    display: flex;
    flex-direction: column;
    gap: 2px;
  }

  .rebuy-title {
    font-size: 15px;
    font-weight: 600;
  }

  .rebuy-text .soft {
    font-size: 13px;
  }

  .clear {
    position: absolute;
    right: 4px;
    top: 50%;
    transform: translateY(-50%);
    color: var(--ink-muted);
  }

  .cherry {
    color: var(--cherry);
    flex: none;
  }

  .soft {
    color: var(--ink-muted);
  }

  .pair {
    display: grid;
    grid-template-columns: repeat(2, minmax(0, 1fr));
    gap: 10px;
  }

  .field {
    display: flex;
    flex-direction: column;
    justify-content: center;
    gap: 2px;
    min-height: 56px;
    padding: 0 14px;
    border-radius: var(--radius-md);
    border: none;
    background: var(--surface);
    color: var(--ink);
    text-align: left;
  }

  .picker {
    flex-direction: row;
    align-items: center;
    gap: var(--space-2);
    padding-right: var(--space-3);
  }

  .picker-text {
    flex: 1;
    min-width: 0;
    display: flex;
    flex-direction: column;
    gap: 2px;
  }

  .value {
    font-size: 16px;
    font-weight: 600;
    white-space: nowrap;
    overflow: hidden;
    text-overflow: ellipsis;
  }

  .placeholder {
    font-weight: 400;
    color: var(--ink-muted);
  }

  .date {
    position: relative;
  }

  .date .label {
    display: flex;
    justify-content: space-between;
  }

  .date input {
    position: absolute;
    inset: 0;
    width: 100%;
    height: 100%;
    opacity: 0;
    border: none;
    font-size: 16px;
  }

  .date:focus-within {
    box-shadow: 0 0 0 2px var(--amber);
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

  .chips {
    display: flex;
    flex-wrap: wrap;
    gap: 6px;
  }

  .chip:not([aria-pressed='true']) {
    font-weight: 500;
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
    gap: 2px;
    border-radius: var(--radius-md);
    overflow-y: auto;
  }

  .row {
    display: flex;
    flex-direction: column;
    justify-content: center;
    gap: 2px;
    min-height: 56px;
    padding: 0 14px;
    border: none;
    background: var(--surface-sheet-field);
    color: var(--ink);
    text-align: left;
    text-decoration: none;
  }

  .row-name {
    font-size: 15px;
    font-weight: 600;
  }

  .row .soft {
    font-size: 13px;
  }

  .row[aria-pressed='true'] .row-name {
    color: var(--amber);
  }
</style>
