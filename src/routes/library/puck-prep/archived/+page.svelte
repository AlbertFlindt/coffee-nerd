<script lang="ts">
  // Archived (D-188).
  import ArchivedPage from '#lib/components/ArchivedPage.svelte';
  import type { PageProps } from './$types';

  let { data }: PageProps = $props();
</script>

<svelte:head><title>Archived · Coffee Nerd</title></svelte:head>

<ArchivedPage area="puck-prep" groups={data.groups} />
