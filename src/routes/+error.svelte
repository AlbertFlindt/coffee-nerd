<script lang="ts">
  // A page that could not open, e.g. one the phone has not kept for offline use. Built from
  // design-system parts, not designed yet.
  import { page } from '$app/state';
  import { resolve } from '$app/paths';
</script>

<svelte:head><title>Coffee Nerd</title></svelte:head>

<main>
  <h1 class="cn-type-title">This page could not open</h1>
  <p>{page.error?.message ?? 'Something went wrong.'}</p>
  <a class="cn-btn-secondary cn-tap" href={resolve('/')}>Back to Home</a>
</main>

<style>
  main {
    flex: 1;
    display: flex;
    flex-direction: column;
    gap: var(--space-4);
    padding: var(--space-6) var(--space-5);
  }

  h1,
  p {
    margin: 0;
  }

  a {
    display: flex;
    align-items: center;
    justify-content: center;
    text-decoration: none;
  }
</style>
