<script lang="ts">
  import '../app.css';
  import logo from '../../design-system/logo/coffee-nerd-mark.svg';
  import type { LayoutProps } from './$types';

  let { children }: LayoutProps = $props();
</script>

<svelte:head>
  <title>Coffee Nerd</title>
  <link rel="icon" href={logo} type="image/svg+xml" />
</svelte:head>

<div class="cn-root app">
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
