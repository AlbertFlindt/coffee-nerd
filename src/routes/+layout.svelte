<script lang="ts">
  import '../app.css';
  import { afterNavigate } from '$app/navigation';
  import { onMount } from 'svelte';
  import logo from '../../design-system/logo/coffee-nerd-mark.svg';
  import OfflineLine from '#lib/components/OfflineLine.svelte';
  import { keepForOffline, watchNetwork } from '#lib/offline-status.svelte.ts';
  import type { LayoutProps } from './$types';

  let { children }: LayoutProps = $props();

  // D-219: Home, the Journal and the shot form stay ready for offline use.
  onMount(watchNetwork);
  afterNavigate(keepForOffline);
</script>

<svelte:head>
  <title>Coffee Nerd</title>
  <link rel="icon" href={logo} type="image/svg+xml" />
</svelte:head>

<div class="cn-root app">
  <OfflineLine />
  {@render children()}
</div>

<style>
  /* D-36: the app fills the viewport; a screen fits it and only its lists scroll. */
  .app {
    height: 100dvh;
    overflow: hidden;
    display: flex;
    flex-direction: column;
  }
</style>
