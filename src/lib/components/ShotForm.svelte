<script lang="ts">
  // The shot form (D-14): bean card, the four core values, ratio, balance, score, More, Save. The recipe
  // tag, deltas and earlier score are worked out in the browser on every change (data-model §4.1).
  // With `data.edit` it edits a saved shot (D-57, D-113): "Save changes", back to the shot, and the bean
  // card moves the shot to another bean while keeping the values.
  import { enhance } from '$app/forms';
  import { goto } from '$app/navigation';
  import { resolve } from '$app/paths';
  import { PROCESS_LABEL } from '#lib/domain/bean.ts';
  import { onMount } from 'svelte';
  import { v7 } from 'uuid';
  import BeanCard from './BeanCard.svelte';
  import BottomSheet from './BottomSheet.svelte';
  import MoreSheet from './MoreSheet.svelte';
  import ScoreRow from './ScoreRow.svelte';
  import TasteSlider from './TasteSlider.svelte';
  import ValueCard from './ValueCard.svelte';
  import type { ShotState } from './shot-state';
  import { recipeTagText, type RecipeIdentity } from '../domain/fingerprint';
  import { validateSetupAgainstMachine } from '../domain/schemas';
  import { coreChanges, matchRecipe, setupChanges, setupSummary } from '../domain/shot-form';
  import { decimalsFor, formatRatio } from '../domain/units';
  import type { ShotFormData } from '../server/db/shot-form';

  let { data, problems = [] }: { data: ShotFormData; problems?: string[] } = $props();

  /** "Natural · 12 days" after a bean's name in the bean list (D-134). */
  function beanDetail(b: ShotFormData['openBeans'][number]): string {
    const age = `${b.roastAgeDays} ${b.roastAgeDays === 1 ? 'day' : 'days'}`;
    return b.process ? `${PROCESS_LABEL[b.process]} · ${age}` : age;
  }

  function initial(): ShotState {
    const p = data.prefill;
    const edit = data.edit;
    return {
      // D-61: the id is made here, so sending the same shot twice saves it once.
      id: edit?.shotId ?? v7(),
      beanId: p.beanId,
      machineId: p.machineId,
      grinderId: p.grinderId,
      basketId: p.basketId,
      routineId: p.routineId,
      grind: p.grind,
      dose: p.dose,
      setup: structuredClone(p.setup),
      yield: p.yield,
      time: p.time,
      taste: { ...(edit?.taste ?? p.taste) },
      tagIds: [...(edit?.tagIds ?? [])],
      newTagNames: [],
      notes: edit?.notes ?? null
    };
  }

  let shot: ShotState = $state(initial());
  const back = $derived(
    data.edit ? resolve('/journal/[id]', { id: data.edit.shotId }) : resolve('/')
  );

  // D-113: in edit mode another bean keeps the values; the page loads that bean's recipes to compare with.
  $effect(() => {
    if (data.edit) shot.beanId = data.bean.id;
  });
  function chooseBeanForEdit(beanId: string) {
    sheet = null;
    const shotId = data.edit!.shotId;
    goto(resolve(`/journal/[id]/edit?bean=${beanId}`, { id: shotId }), {
      replace: true,
      reset: false
    });
  }
  let sheet: 'more' | 'bean' | 'delete' | null = $state(null);
  let tab: 'setup' | 'tasting' = $state('setup');
  let saving = $state(false);
  let deleting = $state(false);
  let localProblems: string[] = $state([]);

  const identity: RecipeIdentity = $derived({
    machineId: shot.machineId,
    grinderId: shot.grinderId,
    basketId: shot.basketId,
    routineId: shot.routineId,
    grind: shot.grind,
    dose: shot.dose,
    setup: shot.setup
  });
  const last = $derived(data.lastShot);
  const match = $derived(matchRecipe(identity, data.recipes, last?.recipe ?? null));
  const tagText = $derived(recipeTagText(match));
  const [tagMain, ...tagRest] = $derived(tagText.split(' · '));
  const changes = $derived(
    coreChanges(
      shot,
      last
        ? { grind: last.recipe.grind, dose: last.recipe.dose, yield: last.yield, time: last.time }
        : null
    )
  );
  const setup = $derived(setupChanges(identity, last?.recipe ?? null));
  const ratio = $derived(formatRatio(shot.yield, shot.dose));
  const lastRatio = $derived(last ? formatRatio(last.yield, last.recipe.dose) : null);
  const dial = $derived(data.grinder.dial);
  const shown = (value: number | null, step: number, at_least = 0) =>
    Math.max(at_least, value === null ? 0 : decimalsFor(value, step));

  onMount(() => {
    // Context of use: the screen stays awake while brewing (decision log §2).
    let lock: WakeLockSentinel | null = null;
    const keepAwake = async () => {
      try {
        if (document.visibilityState === 'visible')
          lock = await navigator.wakeLock?.request('screen');
      } catch {
        // Not allowed here (battery saver, older browser): the screen may dim as usual.
      }
    };
    keepAwake();
    document.addEventListener('visibilitychange', keepAwake);
    return () => {
      document.removeEventListener('visibilitychange', keepAwake);
      lock?.release();
    };
  });

  function check(): boolean {
    // A switched-on feature needs its value (D-78); everything else may stay empty (D-11, D-91).
    const machine = { type: 'semi_auto' as const, features: data.machine.features };
    localProblems = validateSetupAgainstMachine(shot.setup, machine)
      .filter((p) => p.problem === 'value_missing' || p.problem === 'pressure_missing')
      .map(
        (p) => `Set ${p.problem === 'pressure_missing' ? 'the pressure for ' : ''}${p.label} first.`
      );
    return localProblems.length === 0;
  }
</script>

<div class="page">
  <div class="above-save">
    <header>
      <a class="back tap" href={back} aria-label="Back without saving">
        <svg
          width="22"
          height="22"
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          stroke-width="2"
          stroke-linecap="round"
          stroke-linejoin="round"
          aria-hidden="true"><path d="M19 12H5M11 6l-6 6 6 6"></path></svg
        >
      </a>
      <h1 class="cn-type-title">{data.edit ? 'Edit shot' : 'New shot'}</h1>
      <span></span>
    </header>

    <main class:compact={data.prefill.source === 'brew_next'}>
      <BeanCard
        title={data.bean.process
          ? `${data.bean.name} · ${PROCESS_LABEL[data.bean.process]}`
          : data.bean.name}
        gear="{data.machine.name} · {data.grinder.name}"
        summary={setupSummary(shot.setup, data.machine.features)}
        tag={{
          reused: match.kind === 'reused',
          text: tagMain,
          detail: tagRest.length ? ` · ${tagRest.join(' · ')}` : undefined
        }}
        brewNext={data.prefill.source === 'brew_next' ? useLastShot : undefined}
        onopen={() => (sheet = 'bean')}
      />

      <section class="core" aria-label="Core values">
        <ValueCard
          label="Grind"
          value={shot.grind}
          step={dial.step}
          decimals={shown(shot.grind, dial.step)}
          min={Math.min(dial.finest, dial.coarsest)}
          max={Math.max(dial.finest, dial.coarsest)}
          change={changes.grind}
          onchange={(v) => v !== null && (shot.grind = v)}
        />
        <ValueCard
          label="Dose"
          value={shot.dose}
          unit="g"
          unitName="gram"
          step={data.steps.dose}
          decimals={shown(shot.dose, data.steps.dose, 1)}
          min={data.steps.dose}
          change={changes.dose}
          onchange={(v) => v !== null && (shot.dose = v)}
        />
        <ValueCard
          label="Yield"
          value={shot.yield}
          unit="g"
          unitName="gram"
          step={data.steps.yield}
          decimals={shown(shot.yield, data.steps.yield, 1)}
          min={0}
          change={changes.yield}
          onchange={(v) => (shot.yield = v)}
        />
        <ValueCard
          label="Time"
          value={shot.time}
          unit="s"
          unitName="second"
          step={data.steps.time}
          decimals={shown(shot.time, data.steps.time, 1)}
          min={0}
          change={changes.time}
          onchange={(v) => (shot.time = v)}
        />
      </section>

      <div class="ratio">
        Ratio <span class="ratio-value" class:changed={last !== null && ratio !== lastRatio}
          >{ratio ?? '—'}</span
        >
      </div>

      <section class="taste" aria-label="Taste">
        <TasteSlider
          scale="balance"
          title="Balance"
          ariaLabel="Balance, sour to bitter"
          ends={['Sour', 'Balanced', 'Bitter']}
          min={-10}
          max={10}
          value={shot.taste.balance}
          onchange={(v) => (shot.taste.balance = v)}
        />
        <ScoreRow
          value={shot.taste.score}
          previous={match.kind === 'reused' ? match.lastScore : null}
          onchange={(v) => (shot.taste.score = v)}
        />
      </section>

      <button
        type="button"
        class="more tap"
        aria-expanded={sheet === 'more'}
        onclick={() => (sheet = 'more')}
      >
        More
        <svg
          width="18"
          height="18"
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          stroke-width="2"
          stroke-linecap="round"
          aria-hidden="true"><path d="M6 9l6 6 6-6"></path></svg
        >
      </button>
    </main>

    {#if sheet === 'more'}
      <MoreSheet
        bind:shot
        bind:tab
        features={data.machine.features}
        baskets={data.baskets}
        routines={data.routines}
        gearNames={data.gearNames}
        tags={data.tags}
        changes={setup}
        onclose={() => (sheet = null)}
      />
    {:else if sheet === 'bean'}
      <BottomSheet
        label="Choose a bean"
        closeLabel="Close bean list"
        onclose={() => (sheet = null)}
      >
        <h2 class="cn-type-heading sheet-title">Open beans</h2>
        {#if data.edit}
          <!-- D-113: editing, another bean keeps the values entered. -->
          <div class="beans">
            {#each data.openBeans as b (b.id)}
              <button
                type="button"
                class="bean tap"
                aria-pressed={b.id === data.bean.id}
                onclick={() => chooseBeanForEdit(b.id)}
              >
                {b.name}<span class="soft">&nbsp;· {beanDetail(b)}</span>
              </button>
            {/each}
          </div>
        {:else}
          <!-- D-94: picking a bean opens the form for it, from its own starting values. -->
          <form class="beans" method="GET" action={resolve('/shot/new')}>
            {#each data.openBeans as b (b.id)}
              <button
                type="submit"
                name="bean"
                value={b.id}
                class="bean tap"
                aria-pressed={b.id === data.bean.id}
                onclick={() => (sheet = null)}
              >
                {b.name}<span class="soft">&nbsp;· {beanDetail(b)}</span>
              </button>
            {/each}
          </form>
        {/if}
      </BottomSheet>
    {:else if sheet === 'delete'}
      <!-- D-116: deleting asks first. The confirmation is not designed yet (docs/open-items.md). -->
      <BottomSheet
        short
        label="Delete this shot"
        closeLabel="Keep the shot"
        onclose={() => (sheet = null)}
      >
        <h2 class="cn-type-heading sheet-title">Delete this shot?</h2>
        <p class="delete-note cn-type-body">
          It is removed from the Journal and from every average. This cannot be undone.
        </p>
        <form
          method="POST"
          action="?/delete"
          class="delete-actions"
          onsubmit={() => (deleting = true)}
        >
          <button class="cn-btn-primary tap-strong" type="submit" disabled={deleting}
            >Delete shot</button
          >
          <button class="cn-btn-secondary tap" type="button" onclick={() => (sheet = null)}
            >Keep it</button
          >
        </form>
      </BottomSheet>
    {/if}
  </div>

  <footer>
    {#each [...localProblems, ...problems] as problem (problem)}
      <p class="problem" role="alert">{problem}</p>
    {/each}
    <form
      method="POST"
      action="?/save"
      use:enhance={({ cancel }) => {
        if (!check()) return cancel();
        saving = true;
        return async ({ update }) => {
          await update();
          saving = false;
        };
      }}
    >
      <input type="hidden" name="shot" value={JSON.stringify(shot)} />
      <button class="cn-btn-primary tap-strong" type="submit" disabled={saving}
        >{data.edit ? 'Save changes' : 'Save shot'}</button
      >
      {#if data.edit}
        <!-- D-116: the edit form ends with "Delete shot". -->
        <button class="delete cn-type-section tap" type="button" onclick={() => (sheet = 'delete')}
          >Delete shot</button
        >
      {/if}
    </form>
  </footer>
</div>

{#snippet useLastShot()}
  <form method="POST" action="?/useLastShot">
    <button type="submit" class="use-last tap">Use last shot recipe</button>
  </form>
{/snippet}

<style>
  /* D-116: a quiet action next to Save; it asks before deleting. */
  .delete {
    width: 100%;
    height: var(--touch-min);
    margin-top: var(--space-1);
    border: none;
    border-radius: var(--radius-md);
    background: none;
    color: var(--ink-muted);
  }

  .delete-note {
    margin: 0;
    color: var(--ink-soft);
  }

  .delete-actions {
    display: flex;
    flex-direction: column;
    gap: var(--space-2);
  }

  .page {
    flex: 1;
    min-height: 0;
    display: flex;
    flex-direction: column;
  }

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
    flex: none;
  }

  h1 {
    margin: 0;
    text-align: center;
  }

  .back {
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
    gap: var(--space-4);
    padding: 4px var(--space-5) var(--space-4);
    /* Last resort on very short screens: the form scrolls inside its area, never over Save (D-36). */
    overflow-y: auto;
  }

  main.compact {
    gap: var(--space-3);
    padding-bottom: var(--space-3);
  }

  .core {
    display: grid;
    grid-template-columns: repeat(2, minmax(0, 1fr));
    gap: var(--space-3);
  }

  .ratio {
    margin-top: -4px;
    text-align: center;
    font-size: 14px;
    color: var(--ink-muted);
  }

  .ratio-value {
    color: var(--ink);
    font-weight: 600;
  }

  .ratio-value.changed {
    color: var(--sage);
  }

  .taste {
    display: flex;
    flex-direction: column;
    gap: var(--space-4);
  }

  .more {
    display: flex;
    align-items: center;
    justify-content: space-between;
    min-height: 52px;
    padding: 0 var(--space-4);
    border: none;
    border-radius: var(--radius-md);
    background: var(--surface);
    color: var(--ink);
    font-size: 15px;
    font-weight: 500;
  }

  .more svg {
    color: var(--ink-muted);
  }

  footer {
    flex: none;
    padding: var(--space-2) var(--space-5) var(--space-6);
  }

  .problem {
    margin: 0 0 var(--space-2);
    font-size: 14px;
    color: var(--ink);
  }

  .use-last {
    height: var(--touch-min);
    padding: 0 12px;
    border: none;
    border-radius: 22px;
    background: var(--control);
    color: var(--ink);
    font-size: 13px;
    font-weight: 600;
    white-space: nowrap;
  }

  .sheet-title {
    margin: 4px 0 0;
  }

  .beans {
    display: flex;
    flex-direction: column;
    gap: 2px;
    border-radius: var(--radius-md);
    overflow-y: auto;
  }

  .bean {
    min-height: 56px;
    padding: 0 14px;
    border: none;
    background: var(--surface-sheet-field);
    color: var(--ink);
    font-size: 15px;
    font-weight: 600;
    text-align: left;
  }

  .bean[aria-pressed='true'] {
    color: var(--amber);
  }

  .soft {
    font-weight: 400;
    color: var(--ink-muted);
  }

  /*
   * D-36: screens adapt to the device. The reference is 412 × 915; a phone browser with its address bar
   * leaves less (a Pixel 8a in Chrome: about 412 × 780), so spacing tightens in two steps.
   */
  @media (max-height: 880px) {
    main,
    main.compact {
      gap: var(--space-2);
      padding-bottom: var(--space-2);
    }

    .page :global(.cn-score button) {
      height: var(--touch-min);
    }

    .page :global(.cn-value-card) {
      padding: var(--space-3);
      gap: var(--space-1);
    }

    .page :global(.cn-steppers) {
      margin-top: 0;
    }

    .taste {
      gap: var(--space-2);
    }

    .more {
      min-height: var(--touch-min);
    }

    footer {
      padding-bottom: var(--space-4);
    }
  }

  @media (max-height: 760px) {
    header {
      height: 48px;
    }

    .page :global(.cn-value-card) {
      padding: var(--space-2) var(--space-3);
    }

    footer {
      padding-top: var(--space-1);
      padding-bottom: var(--space-3);
    }
  }
</style>
