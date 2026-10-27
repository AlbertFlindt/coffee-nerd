<script lang="ts">
  import '../app.css';
  import { afterNavigate } from '$app/navigation';
  import { page } from '$app/state';
  import { onMount } from 'svelte';
  import logo from '../../design-system/logo/coffee-nerd-mark.svg';
  import OfflineLine from '#lib/components/OfflineLine.svelte';
  import { keepForOffline, watchNetwork } from '#lib/offline-status.svelte.ts';
  import { watchWaiting } from '#lib/shot-queue.svelte.ts';
  import type { LayoutProps } from './$types';

  let { children }: LayoutProps = $props();

  // D-219: Home, the Journal and the shot form stay ready for offline use.
  onMount(watchNetwork);
  afterNavigate(keepForOffline);
  // D-61: shots saved offline wait on the phone and go to the server once it can be reached.
  onMount(() => watchWaiting(() => page.data.userId));
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
  /*
   * D-36: the app fills the viewport; a screen fits it and only its lists scroll. The height follows the page
   * (html and body are 100%), not 100dvh: in the app installed from Chrome, a page that opens after a form
   * is sent (deleting a shot, a bean, gear) got a 100dvh taller than the screen, which cut off the tab bar.
   */
  .app {
    height: 100%;
    overflow: hidden;
    display: flex;
    flex-direction: column;
  }
</style>
