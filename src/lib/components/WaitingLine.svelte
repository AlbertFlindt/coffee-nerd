<script lang="ts">
  // A shot still on the phone: a muted line with an icon, "Waiting to send" until the
  // server has it, or "Not saved" when the server refused it. Built from design-system parts; the look
  // is approved by screenshot.
  import type { WaitingStatus } from '../domain/waiting';

  let { status }: { status: WaitingStatus } = $props();
</script>

<span class="waiting">
  <svg
    width="14"
    height="14"
    viewBox="0 0 24 24"
    fill="none"
    stroke="currentColor"
    stroke-width="2"
    stroke-linecap="round"
    stroke-linejoin="round"
    aria-hidden="true"
  >
    <circle cx="12" cy="12" r="9" />
    {#if status === 'refused'}
      <path d="M12 7.5v5.5M12 16.5v.01" />
    {:else}
      <path d="M12 7v5l3 2" />
    {/if}
  </svg>
  {status === 'refused' ? 'Not saved' : 'Waiting to send'}
</span>

<style>
  .waiting {
    display: inline-flex;
    align-items: center;
    gap: 5px;
    font-size: 13px;
    color: var(--ink-muted);
  }
</style>
