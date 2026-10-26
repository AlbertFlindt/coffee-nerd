<script lang="ts">
  // The Rate sheet (D-111), opened by the dashed Rate block in the Journal and on Home (D-197): the shot as
  // the title, then the score row. A tap on a score saves it; a slide saves where the finger lifts (D-10).
  // It posts to the page's own `?/rate` action and closes once the score is saved. Without a connection
  // the score waits on the phone and the sheet closes as well (D-223).
  import { tick } from 'svelte';
  import { enhance } from '$app/forms';
  import { page } from '$app/state';
  import BottomSheet from './BottomSheet.svelte';
  import ScoreRow from './ScoreRow.svelte';
  import { clockTime } from '../domain/journal';
  import { isWaiting, keepWaiting, unreached } from '../shot-queue.svelte';

  let {
    shot,
    timeZone,
    onclose
  }: {
    shot: { id: string; beanName: string; brewedAt: number; previousScore: number | null };
    timeZone: string;
    onclose: () => void;
  } = $props();

  let score: number | null = $state(null);
  let pressing = false;
  let rateForm: HTMLFormElement | undefined = $state();
  let rateFailed = $state(false);
  const submitScore = async () => {
    if (score === null) return;
    await tick(); // the hidden input carries the new score first
    rateForm?.requestSubmit();
  };
</script>

<BottomSheet short label="Rate the shot" closeLabel="Close without rating" {onclose}>
  <!-- Not designed yet beyond D-111: the shot as the title, then the score row (docs/open-items.md). -->
  <h2 class="cn-type-heading sheet-title">
    {`${shot.beanName} · ${clockTime(shot.brewedAt, timeZone)}`}
  </h2>
  <form
    bind:this={rateForm}
    method="POST"
    action="?/rate"
    data-waits
    use:enhance={async ({ cancel }) => {
      // A shot on the phone takes its score there too, so a later send never undoes it (D-223).
      if (isWaiting(shot.id) && score !== null && page.data.userId) {
        cancel();
        await keepWaiting(
          { kind: 'rate', shotId: shot.id, score, brewedAt: shot.brewedAt },
          page.data.userId
        );
        onclose();
        return;
      }
      return async ({ result, update }) => {
        if (unreached(result) && score !== null && page.data.userId) {
          await keepWaiting(
            { kind: 'rate', shotId: shot.id, score, brewedAt: shot.brewedAt },
            page.data.userId
          );
          onclose();
          return;
        }
        await update();
        // Closes only once the score is saved; otherwise the sheet stays with a message.
        if (result.type === 'success') onclose();
        else rateFailed = true;
      };
    }}
  >
    <input type="hidden" name="shotId" value={shot.id} />
    <input type="hidden" name="score" value={score ?? ''} />
    <div
      role="presentation"
      onpointerdowncapture={() => (pressing = true)}
      onpointerup={() => {
        pressing = false;
        submitScore();
      }}
      onpointercancel={() => (pressing = false)}
    >
      <ScoreRow
        value={score}
        previous={shot.previousScore}
        onchange={(v) => {
          score = v;
          if (!pressing) submitScore();
        }}
      />
    </div>
  </form>
  {#if rateFailed}
    <!-- Not designed yet (docs/open-items.md). -->
    <p class="problem" role="alert">The score could not be saved. Nothing was changed.</p>
  {/if}
</BottomSheet>

<style>
  .sheet-title {
    margin: 4px 0 0;
  }

  .problem {
    margin: 0;
    font-size: 13px;
    color: var(--ink-soft);
  }
</style>
