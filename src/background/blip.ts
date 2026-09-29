// Publishing, with the one retry awaited inline. Nothing is scheduled: Chrome
// stops the worker about thirty seconds after the last handler settles, so a
// cooldown is a stored timestamp and the retry happens while the handler waits.
// A blip that still never left the machine is stored on the watch, and the
// refresh alarm sends it again later (see core/resend.ts).
import { RETRY_DELAY_MS, inCooldown, shouldRetry } from "../core/cooldown.js";
import type { Blip, Occasion } from "../core/message.js";
import { messageFor } from "../core/message.js";
import type { PublishOutcome } from "../core/publish.js";
import { publish } from "../core/publish.js";
import { isSpent, resendStep } from "../core/resend.js";
import type { Unsent, Watch, WatchDraft } from "../core/watch.js";
import { cooldownSecondsOf } from "../core/watch.js";
import type { WatchPatch } from "../storage.js";
import { getWatch, patchWatch } from "../storage.js";

export const TEST_BLIP: Blip = {
  title: "Blipr",
  message: "Test blip. This watch can reach your topic.",
};

export const GAVE_UP = "Couldn't reach the server. Gave up after an hour.";

export async function attempt(draft: WatchDraft, blip: Blip): Promise<PublishOutcome> {
  for (let tries = 1; ; tries += 1) {
    const outcome = await publish(draft, blip);
    if (outcome.ok || !shouldRetry(tries, outcome.retryable)) return outcome;
    await delay(RETRY_DELAY_MS);
  }
}

export async function fire(watch: Watch, occasion: Occasion): Promise<void> {
  const now = Date.now();
  if (!watch.enabled) return;
  if (inCooldown(watch.lastFiredAt, now, cooldownSecondsOf(watch))) {
    await patchWatch(watch.id, { lastSuppressedAt: now });
    return;
  }
  // Claim the slot before publishing, so two tabs cannot both send the same blip.
  await patchWatch(watch.id, { lastFiredAt: now });
  const blip = messageFor(watch, occasion);
  const outcome = await attempt(watch, blip);
  await patchWatch(watch.id, recordOf(watch, outcome, blip, Date.now()));
}

/** Another go at a blip that never left the machine, from the refresh alarm. */
export async function resend(watch: Watch, now: number): Promise<void> {
  const { unsent } = watch;
  if (!watch.enabled || !unsent) return;
  const step = resendStep(unsent, now);
  if (step === "wait") return;
  if (step === "give up") {
    await patchWatch(watch.id, gaveUp(now));
    return;
  }
  const outcome = await publish(watch, unsent.blip);
  // A fire that landed while this was in flight has already recorded something newer.
  const current = await getWatch(watch.id);
  if (current?.unsent?.firstFailedAt !== unsent.firstFailedAt) return;
  await patchWatch(watch.id, resentRecordOf(watch, unsent, outcome, now));
}

function recordOf(watch: Watch, outcome: PublishOutcome, blip: Blip, now: number): WatchPatch {
  if (outcome.ok) return delivered(watch);
  const unsent: Unsent | undefined = outcome.unreachable
    ? { blip, firstFailedAt: now, lastTriedAt: now, attempts: 0 }
    : undefined;
  return { lastError: outcome.message, lastErrorAt: now, unsent };
}

function resentRecordOf(
  watch: Watch,
  unsent: Unsent,
  outcome: PublishOutcome,
  now: number,
): WatchPatch {
  // The blip went out now, so the row and the cooldown count from here.
  if (outcome.ok) return { ...delivered(watch), lastFiredAt: now };
  if (!outcome.unreachable) {
    return { lastError: outcome.message, lastErrorAt: now, unsent: undefined };
  }
  const next = { ...unsent, attempts: unsent.attempts + 1, lastTriedAt: now };
  if (isSpent(next)) return gaveUp(now);
  return { lastError: outcome.message, lastErrorAt: now, unsent: next };
}

function delivered(watch: Watch): WatchPatch {
  return {
    lastError: undefined,
    lastErrorAt: undefined,
    unsent: undefined,
    ...(watch.once ? { enabled: false } : {}),
  };
}

function gaveUp(now: number): WatchPatch {
  return { lastError: GAVE_UP, lastErrorAt: now, unsent: undefined };
}

function delay(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}
