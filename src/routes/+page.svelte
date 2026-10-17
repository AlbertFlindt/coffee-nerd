<script lang="ts">
  import logo from '../../design-system/logo/coffee-nerd-mark.svg';
</script>

<!-- Placeholder until Home is built in milestone M8 (docs/screens/Home.png). -->
<main>
  <img src={logo} width="64" height="64" alt="" />
  <h1 class="cn-type-display">Coffee Nerd</h1>
  <!-- Until Settings exists (M11), signing out lives here; not designed (docs/open-items.md). -->
  <form method="POST" action="/logout">
    <button class="cn-btn-secondary" type="submit">Sign out</button>
  </form>
</main>

<style>
  main {
    flex: 1;
    display: flex;
    flex-direction: column;
    align-items: center;
    justify-content: center;
    gap: var(--space-3);
    padding: 0 var(--space-5);
  }

  h1 {
    margin: 0;
  }

  form {
    width: 100%;
    margin-top: var(--space-6);
  }
</style>
