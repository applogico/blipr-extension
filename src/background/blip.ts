// Publishing, with the one retry awaited inline. Nothing is scheduled: Chrome
// stops the worker about thirty seconds after the last handler settles, so a
// cooldown is a stored timestamp and the retry happens while the handler waits.
import { RETRY_DELAY_MS, inCooldown, shouldRetry } from "../core/cooldown.js";
import type { Blip, Occasion } from "../core/message.js";
import { messageFor } from "../core/message.js";
import type { PublishOutcome } from "../core/publish.js";
import { publish } from "../core/publish.js";
import type { Watch, WatchDraft } from "../core/watch.js";
import type { WatchPatch } from "../storage.js";
import { patchWatch } from "../storage.js";

export const TEST_BLIP: Blip = {
  title: "Blipr",
  message: "Test blip. This watch can reach your topic.",
};

export async function attempt(draft: WatchDraft, blip: Blip): Promise<PublishOutcome> {
  for (let tries = 1; ; tries += 1) {
    const outcome = await publish(draft, blip);
    if (outcome.ok || !shouldRetry(tries, outcome.retryable)) return outcome;
    await delay(RETRY_DELAY_MS);
  }
}

export async function fire(watch: Watch, occasion: Occasion): Promise<void> {
  const now = Date.now();
  if (!watch.enabled || inCooldown(watch.lastFiredAt, now)) return;
  // Claim the slot before publishing, so two tabs cannot both send the same blip.
  await patchWatch(watch.id, { lastFiredAt: now });
  await patchWatch(watch.id, recordOf(watch, await attempt(watch, messageFor(watch, occasion))));
}

function recordOf(watch: Watch, outcome: PublishOutcome): WatchPatch {
  if (!outcome.ok) return { lastError: outcome.message };
  return { lastError: undefined, ...(watch.once ? { enabled: false } : {}) };
}

function delay(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}
