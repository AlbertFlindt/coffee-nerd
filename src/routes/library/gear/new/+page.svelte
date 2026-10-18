<script lang="ts">
  // Add gear (D-147): the kind's page, empty; a step of the step-by-step start with a guide (D-157).
  import BasketForm from '#lib/components/BasketForm.svelte';
  import GrinderForm from '#lib/components/GrinderForm.svelte';
  import MachineForm from '#lib/components/MachineForm.svelte';
  import type { PageProps } from './$types';

  let { data, form }: PageProps = $props();
</script>

<svelte:head><title>Add {data.kind} · Coffee Nerd</title></svelte:head>

{#if data.kind === 'machine'}
  <MachineForm guide={data.guide} problems={form?.problems} />
{:else if data.kind === 'grinder'}
  <GrinderForm guide={data.guide} problems={form?.problems} />
{:else}
  <BasketForm guide={data.guide} machines={data.machines} problems={form?.problems} />
{/if}
