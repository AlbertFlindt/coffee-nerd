<script lang="ts">
  import ShotForm from '#lib/components/ShotForm.svelte';
  import type { PageProps } from './$types';

  let { data, form }: PageProps = $props();
</script>

<svelte:head><title>New shot · Coffee Nerd</title></svelte:head>

<!-- A new key per bean (D-94) or Brew next change starts the form from its own prefill. -->
{#key `${data.form.bean.id}:${data.form.prefill.source}`}
  <ShotForm data={data.form} problems={form?.problems} />
{/key}
