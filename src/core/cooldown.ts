/**
 * Rate control without a timer.
 *
 * Chrome stops the service worker after about thirty seconds idle and takes
 * every pending `setTimeout` with it, so nothing here schedules anything. A
 * cooldown is a stored timestamp compared against now, and the one retry is
 * awaited inside the message handler that is already keeping the worker alive.
 */
export const RETRY_DELAY_MS = 2_000;
export const MAX_ATTEMPTS = 2;

export function inCooldown(lastFiredAt: number | undefined, now: number, seconds: number): boolean {
  return seconds > 0 && lastFiredAt !== undefined && now - lastFiredAt < seconds * 1_000;
}

export function shouldRetry(attempt: number, retryable: boolean): boolean {
  return retryable && attempt < MAX_ATTEMPTS;
}
