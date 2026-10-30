<script lang="ts">
  // New routine (screen 19).
  import RoutinePage from '#lib/components/RoutinePage.svelte';
  import type { PageProps } from './$types';

  let { data, form }: PageProps = $props();
</script>

<svelte:head><title>New routine · Coffee Nerd</title></svelte:head>

<RoutinePage steps={data.steps} {form} />
