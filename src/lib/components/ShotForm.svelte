<script lang="ts">
  // The shot form: bean card, the four core values, ratio, score, Setup and Tasting side by side,
  // Save. The recipe tag, deltas and earlier score are worked out in the browser on every
  // change (docs/SPEC.md §4.1).
  // With `data.edit` it edits a saved shot: "Save changes", back to the shot, and the bean
  // card moves the shot to another bean while keeping the values.
  // `origin` is where "+" was pressed, or for an edit whether the shot was opened from Home: Back and
  // Save return there.
  // With `waiting` it changes a shot still on the phone: Save keeps it waiting with the
  // change, Delete removes it from the phone, and "Discard change" drops a waiting edit. With
  // `pending`, the edit page starts from the change waiting for the shot. Without a connection, Save keeps the shot or the edit on the
  // phone and returns as online.
  import { enhance } from '$app/forms';
  import { afterNavigate, beforeNavigate, goto } from '$app/navigation';
  import { resolve } from '$app/paths';
  import { page } from '$app/state';
  import { closeAll } from '#lib/back-closes.ts';
  import { PROCESS_LABEL } from '#lib/domain/bean.ts';
  import { onMount } from 'svelte';
  import { v7 } from 'uuid';
  import BeanCard from './BeanCard.svelte';
  import BottomSheet from './BottomSheet.svelte';
  import ConfirmDialog from './ConfirmDialog.svelte';
  import MoreSheet from './MoreSheet.svelte';
  import PickRow from './PickRow.svelte';
  import ScoreRow from './ScoreRow.svelte';
  import ValueCard from './ValueCard.svelte';
  import type { ShotState } from './shot-state';
  import { recipeTagText, type RecipeIdentity } from '../domain/fingerprint';
  import { reconcileFeatures } from '../domain/prefill';
  import { validateSetupAgainstMachine } from '../domain/schemas';
  import { coreChanges, matchRecipe, setupChanges, setupSummary } from '../domain/shot-form';
  import { decimalsFor, formatNumber, formatRatio } from '../domain/units';
  import type { Origin } from '../domain/origin';
  import {
    startWithPending,
    waitingFormQuery,
    type WaitingEntry,
    type WaitingShow
  } from '../domain/waiting';
  import {
    deleteWaiting,
    dropWaiting,
    keepWaiting,
    putBackWaiting,
    showSavedOnPhone,
    unreached
  } from '../shot-queue.svelte';
  import type { ShotFormData } from '../server/db/shot-form';
  import { draftForm, fitsForm } from '../domain/draft';
  import { dropDraft, openDraft, saveDraft } from '../shot-draft';

  let {
    data,
    problems = [],
    origin = { from: 'home', filters: '' },
    waiting = null,
    pending = null
  }: {
    data: ShotFormData;
    problems?: string[];
    origin?: { from: Origin; filters: string };
    waiting?: WaitingEntry | null;
    pending?: WaitingEntry | null;
  } = $props();

  const NOT_SAVED_WAITING =
    'Not saved: the server did not take this shot. Change it and save again, or delete it.';

  /** "Natural · 12 days" after a bean's name in the bean list. */
  function beanDetail(b: ShotFormData['openBeans'][number]): string {
    const age = `${b.roastAgeDays} ${b.roastAgeDays === 1 ? 'day' : 'days'}`;
    return b.process ? `${PROCESS_LABEL[b.process]} · ${age}` : age;
  }

  function initial(): ShotState {
    if (waiting?.shot) return structuredClone(waiting.shot);
    return startWithPending(saved(), data.edit ? pending : null);
  }

  // What is being entered is kept on the phone as a draft, for this form: a new shot from its
  // bean and prefill, or one shot's own form.
  function draftOf() {
    return {
      ownerId: page.data.userId as string | undefined,
      form: draftForm(data.edit?.shotId ?? waiting?.shotId ?? null),
      basis: data.edit || waiting ? data.bean.id : `${data.bean.id}:${data.prefill.source}`
    };
  }
  function restored(start: ShotState): ShotState | null {
    const { ownerId, form, basis } = draftOf();
    return ownerId ? openDraft(ownerId, form, basis, start) : null;
  }
  let draftEnded = false;
  // Another bean while editing stays in the same form, with its draft.
  let switchingBean = false;
  // Leaving the form ends the draft, also with the phone's own back gesture; closing the app or
  // reloading keeps it.
  beforeNavigate(({ type }) => {
    if (type !== 'leave' && !switchingBean) endDraft();
  });
  // Still on this form afterwards (the bean already chosen, picked again): it keeps its draft again.
  afterNavigate(() => {
    switchingBean = false;
    draftEnded = false;
    const { ownerId, form, basis } = draftOf();
    if (ownerId) saveDraft(ownerId, form, basis, $state.snapshot(shot), start);
  });
  /** Save and Back end the draft. */
  function endDraft() {
    draftEnded = true;
    const { ownerId, form } = draftOf();
    if (ownerId) dropDraft(ownerId, form);
  }

  function saved(): ShotState {
    const p = data.prefill;
    const edit = data.edit;
    return {
      // The id is made here, so sending the same shot twice saves it once.
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

  const start = initial();
  const kept = restored(start);
  const draft = kept && fitsForm(kept, start) ? kept : null;
  let shot: ShotState = $state(draft ?? structuredClone(start));
  $effect(() => {
    const now = $state.snapshot(shot);
    const { ownerId, form, basis } = draftOf();
    if (ownerId && !draftEnded) saveDraft(ownerId, form, basis, now, start);
  });
  // A change the server did not take says so, with the server's reasons.
  const refused = $derived([waiting, pending].find((e) => e?.status === 'refused') ?? null);
  const notSaved = $derived(refused ? [NOT_SAVED_WAITING, ...(refused.problems ?? [])] : []);
  // A change to a saved shot that waits or was not saved can be dropped from the phone.
  const discardable = $derived(waiting?.kind === 'edit' ? waiting : data.edit ? pending : null);
  const back = $derived(
    data.edit
      ? origin.from === 'home'
        ? resolve('/journal/[id]?from=home', { id: data.edit.shotId })
        : resolve('/journal/[id]', { id: data.edit.shotId })
      : origin.from === 'journal'
        ? origin.filters
          ? resolve(`/journal?${origin.filters}`)
          : resolve('/journal')
        : resolve('/')
  );

  // In edit mode another bean keeps the values; the page loads that bean's recipes to compare with.
  $effect(() => {
    if (data.edit || waiting) shot.beanId = data.bean.id;
  });
  async function chooseBeanForEdit(beanId: string) {
    // The bean sheet's history entry goes first: the form's own entry is the one replaced.
    await closeAll();
    switchingBean = true;
    // The draft goes with the new bean: a waiting shot's form opens again for it.
    const { ownerId, form, basis } = draftOf();
    if (ownerId) saveDraft(ownerId, form, basis, { ...$state.snapshot(shot), beanId }, start);
    if (waiting) {
      goto(resolve(`/shot/new${waitingFormQuery(waiting.shotId, beanId, origin.from)}`), {
        replaceState: true
      });
      return;
    }
    const shotId = data.edit!.shotId;
    const from = origin.from === 'home' ? '&from=home' : '';
    goto(resolve(`/journal/[id]/edit?bean=${beanId}${from}`, { id: shotId }), {
      replace: true,
      reset: false
    });
  }
  let sheet: 'setup' | 'tasting' | 'bean' | 'gear' | 'delete' | null = $state(null);
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
        ? {
            grind: last.recipe.grind,
            // Compared with the dose the last shot was brewed with.
            dose: last.dose ?? last.recipe.dose,
            yield: last.yield,
            time: last.time
          }
        : null
    )
  );
  const setup = $derived(setupChanges(identity, last?.recipe ?? null));

  /** What the Journal and Home show of the shot while it waits on the phone. */
  function waitingShow(): WaitingShow {
    return {
      beanName: data.bean.name,
      grindStep: dial.step,
      steps: data.steps,
      recipeTag:
        match.kind === 'reused'
          ? { kind: 'reused', shotCount: match.shotCount }
          : { kind: 'new', changes: match.changes },
      previousScore: match.kind === 'reused' ? match.lastScore : null
    };
  }
  const ratio = $derived(formatRatio(shot.yield, shot.dose));
  const lastRatio = $derived(last ? formatRatio(last.yield, last.dose ?? last.recipe.dose) : null);
  // The machine and grinder can be switched for this shot; features and grind control follow.
  const machine = $derived(data.machines.find((m) => m.id === shot.machineId) ?? data.machines[0]);
  const grinder = $derived(data.grinders.find((g) => g.id === shot.grinderId) ?? data.grinders[0]);
  const dial = $derived(grinder.dial);

  function chooseMachine(id: string) {
    sheet = null;
    if (id === shot.machineId) return;
    const next = data.machines.find((m) => m.id === id)!;
    shot.machineId = id;
    // Values both machines share stay; new features start from My setup (docs/SPEC.md §4.2).
    shot.setup.features = reconcileFeatures(next, shot.setup.features, data.defaultFeatures);
  }

  function chooseGrinder(id: string) {
    sheet = null;
    shot.grinderId = id;
  }

  // A gentle hint while the dose is outside the basket's dose range; it never blocks saving.
  const basket = $derived(data.baskets.find((b) => b.id === shot.basketId));
  const doseHint = $derived.by(() => {
    const range = basket?.doseRange;
    if (!basket || !range || (shot.dose >= range.from && shot.dose <= range.to)) return null;
    return `${basket.name} holds ${formatNumber(range.from, 1)}–${formatNumber(range.to, 1)} g`;
  });
  const shown = (value: number | null, step: number, at_least = 0) =>
    Math.max(at_least, value === null ? 0 : decimalsFor(value, step));

  onMount(() => {
    // A shot's draft made with another bean opens with that bean again.
    if (
      draft &&
      (data.edit || waiting) &&
      draft.beanId !== data.bean.id &&
      data.openBeans.some((b) => b.id === draft.beanId)
    )
      chooseBeanForEdit(draft.beanId);
    // Context of use: the screen stays awake while brewing.
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
    // A switched-on feature needs its value; everything else may stay empty.
    const spec = { type: 'semi_auto' as const, features: machine.features };
    localProblems = validateSetupAgainstMachine(shot.setup, spec)
      .filter((p) => p.problem === 'value_missing' || p.problem === 'pressure_missing')
      .map(
        (p) => `Set ${p.problem === 'pressure_missing' ? 'the pressure for ' : ''}${p.label} first.`
      );
    // After switching the grinder, the grind may be outside its range (as Edit My setup says).
    if (
      shot.grind < Math.min(dial.finest, dial.coarsest) ||
      shot.grind > Math.max(dial.finest, dial.coarsest)
    )
      localProblems.push('Grind must be within the grinder’s range');
    return localProblems.length === 0;
  }
</script>

<div class="page">
  <div class="above-save">
    <header>
      <a class="back cn-tap" href={back} aria-label="Back without saving" onclick={endDraft}>
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
      <h1 class="cn-type-title">{data.edit || waiting ? 'Edit shot' : 'New shot'}</h1>
      <span></span>
    </header>

    <main class:compact={data.prefill.source === 'brew_next'}>
      <BeanCard
        title={data.bean.process
          ? `${data.bean.name} · ${PROCESS_LABEL[data.bean.process]}`
          : data.bean.name}
        gear="{machine.name} · {grinder.name}"
        summary={setupSummary(shot.setup, machine.features)}
        tag={{
          reused: match.kind === 'reused',
          text: tagMain,
          detail: tagRest.length ? ` · ${tagRest.join(' · ')}` : undefined
        }}
        brewNext={data.prefill.source === 'brew_next' ? useLastShot : undefined}
        onopen={() => (sheet = 'bean')}
        ongear={() => (sheet = 'gear')}
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
      {#if doseHint}<p class="dose-hint">{doseHint}</p>{/if}

      <!-- Balance lives in the Tasting sheet; the form keeps the score. -->
      <section class="taste" aria-label="Taste">
        <ScoreRow
          value={shot.taste.score}
          previous={match.kind === 'reused' ? match.lastScore : null}
          onchange={(v) => (shot.taste.score = v)}
        />
      </section>

      <!-- Setup and Tasting side by side, each opening its own sheet. -->
      <div class="sheets">
        {#each [['setup', 'Setup'], ['tasting', 'Tasting']] as const as [key, label] (key)}
          <button
            type="button"
            class="more cn-tap"
            aria-expanded={sheet === key}
            onclick={() => (sheet = key)}
          >
            {label}
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
        {/each}
      </div>
    </main>

    {#if sheet === 'setup' || sheet === 'tasting'}
      <MoreSheet
        bind:shot
        tab={sheet}
        features={machine.features}
        baskets={data.baskets}
        routines={data.routines}
        gearNames={data.gearNames}
        stepSettings={data.stepSettings}
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
        <h2 class="sheet-title">Open beans</h2>
        {#if data.edit || waiting}
          <!-- Editing, another bean keeps the values entered. -->
          <div class="beans">
            {#each data.openBeans as b (b.id)}
              <button
                type="button"
                class="bean cn-tap"
                aria-pressed={b.id === data.bean.id}
                onclick={() => chooseBeanForEdit(b.id)}
              >
                {b.name}<span class="soft">&nbsp;· {beanDetail(b)}</span>
              </button>
            {/each}
          </div>
        {:else}
          <!-- Picking a bean opens the form for it, from its own starting values. -->
          <form class="beans" method="GET" action={resolve('/shot/new')}>
            {#if origin.from === 'journal'}<input type="hidden" name="from" value="journal" />{/if}
            {#each data.openBeans as b (b.id)}
              <button
                type="submit"
                name="bean"
                value={b.id}
                class="bean cn-tap"
                aria-pressed={b.id === data.bean.id}
                onclick={() => (sheet = null)}
              >
                {b.name}<span class="soft">&nbsp;· {beanDetail(b)}</span>
              </button>
            {/each}
          </form>
        {/if}
      </BottomSheet>
    {:else if sheet === 'gear'}
      <!-- Another machine or grinder for this shot (screen 27). -->
      <BottomSheet
        short
        label="Choose machine and grinder"
        closeLabel="Close gear list"
        onclose={() => (sheet = null)}
      >
        <h2 class="sheet-title">Machine</h2>
        <div class="pick-list">
          {#each data.machines as m (m.id)}
            <PickRow
              label={m.name}
              chosen={m.id === shot.machineId}
              onclick={() => chooseMachine(m.id)}
            />
          {/each}
        </div>
        <h2 class="sheet-title">Grinder</h2>
        <div class="pick-list">
          {#each data.grinders as g (g.id)}
            <PickRow
              label={g.name}
              chosen={g.id === shot.grinderId}
              onclick={() => chooseGrinder(g.id)}
            />
          {/each}
        </div>
      </BottomSheet>
    {:else if sheet === 'delete'}
      <!-- Deleting asks first, in a dialog built ahead of the canvas. -->
      <ConfirmDialog
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
          data-waits={waiting ? '' : undefined}
          onsubmit={async (event) => {
            deleting = true;
            // A saved shot's delete is sent as a page of its own: its draft stays until signing out, and
            // its edit page no longer opens. Offline it changes nothing.
            if (!waiting) return;
            endDraft();
            // A shot that is only on the phone is removed from it.
            event.preventDefault();
            await deleteWaiting(waiting.shotId);
            await goto(back);
          }}
        >
          <button class="cn-btn-danger cn-tap-strong" type="submit" disabled={deleting}
            >Delete shot</button
          >
          <button class="cn-btn-primary cn-tap-strong" type="button" onclick={() => (sheet = null)}
            >Keep it</button
          >
        </form>
      </ConfirmDialog>
    {/if}
  </div>

  <footer>
    {#each [...localProblems, ...problems, ...notSaved] as problem (problem)}
      <p class="problem" role="alert">{problem}</p>
    {/each}
    <form
      method="POST"
      action="?/save"
      data-waits
      use:enhance={async ({ cancel }) => {
        if (!check()) return cancel();
        // A shot kept on the phone is brewed when Save is pressed.
        const brewedAt = Date.now();
        const ownerId = page.data.userId;
        if (waiting) {
          // A shot still on the phone stays there with the change, and keeps its brew time.
          cancel();
          if (!ownerId) return;
          saving = true;
          const change = { kind: 'new' as const, shot, show: waitingShow(), fromWaiting: true };
          await keepWaiting({ ...change, brewedAt: waiting.brewedAt }, ownerId);
          endDraft();
          await goto(back);
          return;
        }
        saving = true;
        // The form holds the change that waited, so it is dropped first, once any send of it is
        // done; without a connection it waits again with this change, and as it was if refused.
        const dropped = data.edit ? await dropWaiting(shot.id) : null;
        return async ({ result, update }) => {
          if (unreached(result) && ownerId) {
            // No connection, so the shot waits on the phone; the page returns as online.
            // An edit keeps the shot's brew time, so it is sent in brew order.
            const kind = data.edit ? ('edit' as const) : ('new' as const);
            const at = data.edit ? data.edit.brewedAt : brewedAt;
            await keepWaiting({ kind, shot, brewedAt: at, show: waitingShow() }, ownerId);
            endDraft();
            if (data.edit) {
              // The shot's own page shows it as it was: the Journal shows the change waiting.
              await goto(origin.from === 'home' ? resolve('/') : resolve('/journal'));
            } else {
              showSavedOnPhone();
              await goto(back);
            }
            return;
          }
          // Refused or failed: the change that waited is not lost when the form is left.
          if (dropped && result.type !== 'redirect') await putBackWaiting(dropped);
          if (result.type === 'redirect') endDraft();
          await update();
          saving = false;
        };
      }}
    >
      <input type="hidden" name="shot" value={JSON.stringify(shot)} />
      <input type="hidden" name="from" value={origin.from} />
      <button class="cn-btn-primary cn-tap-strong" type="submit" disabled={saving}
        >{data.edit || waiting ? 'Save changes' : 'Save shot'}</button
      >
      {#if discardable}
        <!-- The shot stays as the server has it; it can be deleted once the change is gone. -->
        <button
          class="cn-btn-quiet delete cn-tap"
          type="button"
          disabled={saving}
          onclick={async () => {
            saving = true;
            await dropWaiting(discardable.shotId);
            endDraft();
            await goto(back, { invalidateAll: true });
          }}>Discard change</button
        >
      {:else if data.edit || waiting?.kind === 'new'}
        <!-- The edit form ends with "Delete shot"; a waiting edit of a saved shot is deleted
             on the shot's own page. -->
        <button class="cn-btn-quiet delete cn-tap" type="button" onclick={() => (sheet = 'delete')}
          >Delete shot</button
        >
      {/if}
    </form>
  </footer>
</div>

{#snippet useLastShot()}
  <form method="POST" action="?/useLastShot">
    <input type="hidden" name="from" value={origin.from} />
    <button type="submit" class="use-last cn-tap">Use last shot recipe</button>
  </form>
{/snippet}

<style>
  /* A quiet action next to Save; it asks before deleting. */
  .delete {
    margin-top: var(--space-1);
  }

  /* Like the confirmations drawn on the canvas (screens 35, 40): the line close under the question. */
  .delete-note {
    margin: -8px 0 8px;
    font-size: 14px;
    line-height: 1.45;
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
    /* Last resort on very short screens: the form scrolls inside its area, never over Save. */
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

  .dose-hint {
    margin: -12px 0 0;
    text-align: center;
    font-size: 13px;
    color: var(--ink-muted);
  }

  .taste {
    display: flex;
    flex-direction: column;
    gap: var(--space-4);
  }

  .sheets {
    display: grid;
    grid-template-columns: 1fr 1fr;
    gap: var(--space-3);
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

  /* Screen 29: problem lines sit centred above Save. */
  .problem {
    margin: 0 0 var(--space-2);
    text-align: center;
    font-size: 13px;
    line-height: 1.4;
    color: var(--ink-soft);
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
    font-size: 19px;
    line-height: 24px;
    font-weight: 700;
  }

  .pick-list {
    display: flex;
    flex-direction: column;
    gap: 2px;
    border-radius: var(--radius-md);
    overflow: hidden;
    flex: none;
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
   * Screens adapt to the device. The reference is 412 × 915; a phone browser with its address bar
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
