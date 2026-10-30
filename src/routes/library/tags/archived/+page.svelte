<script lang="ts">
  // Archived.
  import ArchivedPage from '#lib/components/ArchivedPage.svelte';
  import type { PageProps } from './$types';

  let { data, form }: PageProps = $props();
</script>

<svelte:head><title>Archived · Coffee Nerd</title></svelte:head>

<ArchivedPage area="tags" groups={data.groups} problem={form} />
