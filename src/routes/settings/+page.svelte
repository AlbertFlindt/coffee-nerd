<script lang="ts">
  // Settings (D-199): opened by the gear on Home. Until Settings is built (M11) it holds only "Sign out",
  // which ends this device's session (D-86). Not designed yet (docs/open-items.md).
  import { resolve } from '$app/paths';
</script>

<svelte:head><title>Settings · Coffee Nerd</title></svelte:head>

<header>
  <a class="back cn-tap" href={resolve('/')} aria-label="Back to Home">
    <svg
      width="22"
      height="22"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      stroke-width="2"
      stroke-linecap="round"
      stroke-linejoin="round"
      aria-hidden="true"><path d="M19 12H5M11 6l-6 6 6 6"></path></svg
    >
  </a>
  <h1 class="cn-type-title">Settings</h1>
</header>

<main>
  <form method="POST" action="/logout">
    <button class="cn-btn-secondary cn-tap" type="submit">Sign out</button>
  </form>
</main>

<style>
  header {
    display: grid;
    grid-template-columns: 48px 1fr;
    align-items: center;
    height: 60px;
    flex: none;
    padding: 0 var(--space-3) 0 var(--space-2);
  }

  .back {
    width: var(--touch-min);
    height: var(--touch-min);
    display: flex;
    align-items: center;
    justify-content: center;
    border-radius: var(--radius-sm);
    color: var(--ink);
  }

  h1 {
    margin: 0;
  }

  main {
    flex: 1;
    padding: var(--space-3) var(--space-5);
  }
</style>
