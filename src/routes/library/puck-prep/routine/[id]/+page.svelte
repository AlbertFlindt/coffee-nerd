<script lang="ts">
  // A routine in the builder (screen 19).
  import RoutinePage from '#lib/components/RoutinePage.svelte';
  import type { PageProps } from './$types';

  let { data, form }: PageProps = $props();
</script>

<svelte:head><title>{data.routine.name} · Coffee Nerd</title></svelte:head>

{#key data.routine.id}
  <RoutinePage routine={data.routine} steps={data.steps} {form} />
{/key}
