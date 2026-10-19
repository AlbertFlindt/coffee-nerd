<script lang="ts">
  // The routine builder's page (screen 19): the builder, and the step sheet for "New step" from its insert
  // sheet (D-164). A step made there is inserted where the + was tapped.
  import RoutineBuilder from '#lib/components/RoutineBuilder.svelte';
  import StepSheet from '#lib/components/StepSheet.svelte';
  import type { RoutineItem, StepItem } from '#lib/server/db/puck-prep.ts';

  let {
    routine,
    steps,
    form
  }: {
    routine?: RoutineItem;
    steps: StepItem[];
    form?: { problems?: string[]; stepId?: string } | null;
  } = $props();

  /** Where "New step" was asked for; the step made there goes in at that place. */
  let creatingAt: number | null = $state(null);
  let sheetOpen = $state(false);
  let added: { stepId: string; position: number } | null = $state(null);
  /** A step id already inserted, so a later "New step" does not insert it again. */
  let handled: string | null = null;

  $effect(() => {
    const stepId = form?.stepId;
    if (!stepId || stepId === handled || creatingAt === null) return;
    if (!steps.some((s) => s.id === stepId)) return;
    handled = stepId;
    added = { stepId, position: creatingAt };
    creatingAt = null;
  });

  function newStep(position: number) {
    handled = form?.stepId ?? handled;
    creatingAt = position;
    sheetOpen = true;
  }
</script>

<RoutineBuilder
  {routine}
  {steps}
  problems={form?.stepId ? [] : form?.problems}
  onnewstep={newStep}
  {added}
/>

{#if sheetOpen}
  <StepSheet onclose={() => (sheetOpen = false)} />
{/if}
