import type { AttemptLimiter, Clock } from "../ports";

/**
 * Fixed-window limiter for failed pass-code checks. A guard who enters `maxFailures`
 * wrong codes inside `windowMs` is locked out until that window ends. Valid codes never
 * count, so a busy gate isn't slowed down.
 */
export class FixedWindowAttemptLimiter implements AttemptLimiter {
  private readonly windows = new Map<string, { startedAt: number; failures: number }>();

  constructor(
    private readonly clock: Clock,
    private readonly maxFailures = 5,
    private readonly windowMs = 60_000,
  ) {}

  retryAfterSeconds(key: string): number {
    const window = this.current(key);
    if (!window || window.failures < this.maxFailures) return 0;
    const remainingMs = window.startedAt + this.windowMs - this.clock.now().getTime();
    return Math.max(1, Math.ceil(remainingMs / 1000));
  }

  recordFailure(key: string): void {
    const window = this.current(key) ?? { startedAt: this.clock.now().getTime(), failures: 0 };
    window.failures += 1;
    this.windows.set(key, window);
  }

  private current(key: string) {
    const window = this.windows.get(key);
    if (window && this.clock.now().getTime() < window.startedAt + this.windowMs) return window;
    this.windows.delete(key);
    return undefined;
  }
}
