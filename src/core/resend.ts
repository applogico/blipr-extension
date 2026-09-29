/**
 * When an unsent blip gets another go.
 *
 * The refresh alarm ticks once a minute while any blip is waiting, and each
 * tick decides from stored state alone, since the worker is gone in between.
 * The wait doubles after every miss, 1, 2, 4, 8 then 15 minutes at most, so
 * the seventh and last resend lands about an hour after the failure. A blip
 * older than that is dropped even if late ticks left it fewer tries.
 */
import type { Unsent, Watch } from "./watch.js";

const MINUTE = 60_000;
export const RESEND_TICK_MINUTES = 1;
export const MAX_RESENDS = 7;
export const MAX_WAIT_MINUTES = 15;
export const GIVE_UP_AFTER_MS = 65 * MINUTE;
// Alarms land a little either side of the minute; without this every wait would run a tick long.
const SLACK_MS = 30 * 1_000;

export type ResendStep = "wait" | "send" | "give up";

export function isResending(watch: Pick<Watch, "enabled" | "unsent">): boolean {
  return watch.enabled && watch.unsent !== undefined;
}

export function waitMinutes(attempts: number): number {
  return Math.min(2 ** attempts, MAX_WAIT_MINUTES);
}

export function resendStep(unsent: Unsent, now: number): ResendStep {
  if (now - unsent.firstFailedAt >= GIVE_UP_AFTER_MS) return "give up";
  const wait = waitMinutes(unsent.attempts) * MINUTE - SLACK_MS;
  return now - unsent.lastTriedAt >= wait ? "send" : "wait";
}

/** Whether a resend that just missed was the last one allowed. */
export function isSpent(unsent: Unsent): boolean {
  return unsent.attempts >= MAX_RESENDS;
}
