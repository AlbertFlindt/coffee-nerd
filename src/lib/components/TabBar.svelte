<script lang="ts">
  // The tab bar on tab screens (D-30): Home · Journal · + · Library · Insights. The amber + is the only way
  // to add a shot (D-31). Library opens Beans until the Library page exists (D-124); Insights is dimmed and
  // does nothing until its page exists (D-114).
  import { resolve } from '$app/paths';

  let { current }: { current: 'home' | 'journal' | 'library' } = $props();
</script>

<nav class="cn-tabbar bar" aria-label="Main">
  <a href={resolve('/')} aria-current={current === 'home' ? 'page' : undefined}>
    <svg
      width="22"
      height="22"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      stroke-width="1.8"
      stroke-linecap="round"
      stroke-linejoin="round"
      aria-hidden="true"
      ><path d="M4 10.5 12 4l8 6.5V20a1 1 0 0 1-1 1h-4v-6h-6v6H5a1 1 0 0 1-1-1z" /></svg
    >Home</a
  >
  <a href={resolve('/journal')} aria-current={current === 'journal' ? 'page' : undefined}>
    <svg
      width="22"
      height="22"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      stroke-width="1.8"
      stroke-linecap="round"
      stroke-linejoin="round"
      aria-hidden="true"><path d="M8 6h12M8 12h12M8 18h12M4 6h.01M4 12h.01M4 18h.01" /></svg
    >Journal</a
  >
  <!-- The prefill must be current when the form opens (D-03, D-43): load on tap, not on hover. -->
  <a
    class="cn-plus cn-tap-strong"
    href={resolve('/shot/new')}
    aria-label="New shot"
    data-sveltekit-preload-data="tap"
  >
    <svg
      width="26"
      height="26"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      stroke-width="2.4"
      stroke-linecap="round"
      aria-hidden="true"><path d="M12 5v14M5 12h14" /></svg
    ></a
  >
  <a href={resolve('/library/beans')} aria-current={current === 'library' ? 'page' : undefined}>
    <svg
      width="22"
      height="22"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      stroke-width="1.8"
      stroke-linecap="round"
      stroke-linejoin="round"
      aria-hidden="true"
      ><path d="M4 20V5a1 1 0 0 1 1-1h3v16M10 20V4h4v16M16 20l2.5-15.5 3.5.6L19.5 20.5" /></svg
    >Library</a
  >
  <a class="later" aria-disabled="true">
    <svg
      width="22"
      height="22"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      stroke-width="1.8"
      stroke-linecap="round"
      stroke-linejoin="round"
      aria-hidden="true"><path d="M4 20h16M7 16v-5M12 16V7M17 16v-8" /></svg
    >Insights</a
  >
</nav>

<style>
  .bar {
    flex: none;
  }

  /* Touch targets of at least 44 px (CLAUDE.md); icon and label stay centred. */
  .bar a {
    min-height: var(--touch-min);
    justify-content: center;
  }

  /* D-114: not built yet; shown so the bar keeps its final shape. */
  .later {
    opacity: 0.4;
    cursor: default;
  }
</style>
