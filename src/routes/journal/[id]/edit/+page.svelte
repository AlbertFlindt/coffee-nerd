<script lang="ts">
  import ShotForm from '#lib/components/ShotForm.svelte';
  import type { PageProps } from './$types';

  let { data, form }: PageProps = $props();
</script>

<svelte:head><title>Edit shot · Coffee Nerd</title></svelte:head>

<!-- No key on the bean: switching it while editing keeps the values entered (D-113). -->
<ShotForm data={data.form} problems={form?.problems} origin={data.origin} />
