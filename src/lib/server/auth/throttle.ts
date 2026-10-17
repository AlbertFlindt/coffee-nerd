// Slows down password guessing: after 5 wrong passwords within 15 minutes, sign-in waits a minute.
// Kept in memory: one process serves the one account (D-59, D-60).

const WINDOW = 15 * 60_000;
const MAX_FAILURES = 5;
const WAIT = 60_000;

export class SignInThrottle {
  private failures: number[] = [];

  recordFailure(now: number): void {
    this.failures = [...this.failures.filter((t) => now - t < WINDOW), now];
  }

  reset(): void {
    this.failures = [];
  }

  /** Milliseconds to wait before the next attempt; 0 when sign-in is allowed. */
  retryAfter(now: number): number {
    const recent = this.failures.filter((t) => now - t < WINDOW);
    if (recent.length < MAX_FAILURES) return 0;
    return Math.max(0, recent[recent.length - 1] + WAIT - now);
  }
}
